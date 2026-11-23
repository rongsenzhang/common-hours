import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker, { ChatQuota, networkPrefix } from "../server/worker.mjs";

const ORIGIN = "https://rongsenzhang.github.io";
function bodyRequest(body, extra = {}, method = "POST", url = "/api/chat") {
  return new Request("https://worker.example" + url, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json", ...extra },
    body,
    duplex: "half",
  });
}

function makeEnv(quotaStatus = 204) {
  const reservations = [];
  const stub = {
    async fetch(url, { body }) {
      reservations.push(body);
      return new Response(null, {
        status: quotaStatus,
        headers: quotaStatus === 429 ? { "Retry-After": "31" } : {},
      });
    },
  };
  return {
    reservations,
    OPENAI_API_KEY: "unit-only",
    OWNER_REPO: "rongsenzhang/common-hours",
    CHAT_QUOTA: {
      idFromName: (n) => {
        assert.equal(n, "global-v1");
        return "one";
      },
      get: (id) => {
        assert.equal(id, "one");
        return stub;
      },
    },
  };
}

test("health reports public configuration only and restricted browser preflight", async () => {
  const env = makeEnv();
  const status = await worker.fetch(
    new Request("https://worker.example/api/status"),
    env,
  );
  const health = await status.json();
  assert.equal(health.service, "common-hours-live");
  assert(health.configured);
  assert.equal(health.provider, "openai");
  assert(!JSON.stringify(health).includes("unit-only"));
  const disabled = await worker.fetch(
    new Request("https://worker.example/api/status"),
    { ...env, OPENAI_API_KEY: "" },
  );
  assert.equal((await disabled.json()).configured, false);
  const pre = new Request("https://worker.example/api/chat", {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type",
    },
  });
  const allowed = await worker.fetch(pre, env);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const bad = await worker.fetch(
    bodyRequest('{"message":"test"}', { Origin: "https://unrelated.example" }),
    env,
  );
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(
    (
      await worker.fetch(
        new Request("https://worker.example/api/chat", {
          method: "POST",
          body: "{}",
        }),
        env,
      )
    ).status,
    403,
  );
  assert.deepEqual(env.reservations, []);
});

test("schema, content type, declared and streamed bytes checked before reserving any provider budget", async () => {
  const env = makeEnv();
  for (const [body, status] of [
    ["not-json", 400],
    ["{}", 400],
    ['{"message":"hello","apiKey":"bogus"}', 400],
    ['{"message":"x","history":[{}]}', 400],
    ['"oops"', 400],
    ['{"message":"' + "a".repeat(1201) + '"}', 400],
  ]) {
    assert.equal((await worker.fetch(bodyRequest(body), env)).status, status);
  }
  assert.equal(
    (
      await worker.fetch(
        bodyRequest("{}", { "content-type": "text/plain" }),
        env,
      )
    ).status,
    415,
  );
  assert.equal(
    (await worker.fetch(bodyRequest("{}", { "content-length": "33000" }), env))
      .status,
    413,
  );
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(16 * 1024));
      c.enqueue(new Uint8Array(16 * 1024 + 1));
      c.close();
    },
  });
  assert.equal((await worker.fetch(bodyRequest(stream), env)).status, 413);
  const invalidUtf8 = new Uint8Array([123, 34, 255, 34, 125]);
  assert.equal((await worker.fetch(bodyRequest(invalidUtf8), env)).status, 400);
  assert.deepEqual(env.reservations, []);
});

test("a reservation sees only the normalized edge network and denial makes no OpenAI request", async (t) => {
  const env = makeEnv(429),
    spy = t.mock.method(globalThis, "fetch", async () => {
      throw Error("unexpected collaborator");
    });
  const reply = await worker.fetch(
    bodyRequest('{"message":"How are you?"}', {
      "CF-Connecting-IP": "192.0.2.200",
      "X-Forwarded-For": "203.0.113.1",
    }),
    env,
  );
  assert.equal(reply.status, 429);
  assert.equal(reply.headers.get("Retry-After"), "31");
  assert.deepEqual(env.reservations, ["4:192.0.2"]);
  assert.equal(spy.mock.calls.length, 0);
  assert.equal(networkPrefix("::ffff:192.0.2.200"), "4:192.0.2");
  assert.equal(
    networkPrefix("2001:db8:a:0:1234::1"),
    networkPrefix("2001:0db8:000a:0000::2"),
  );
  assert.equal(networkPrefix(""), "shared");
  assert.equal(networkPrefix("not a client address"), "shared");
});

test("accepted requests invoke the configured provider and expose only normalized fields", async (t) => {
  const env = makeEnv();
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.headers.Authorization, "Bearer unit-only");
    const plan = {
      intent: "identity",
      language: "en",
      time: "any",
      mode: "any",
      step_free: false,
      candidate_ids: [],
      case_profile: null,
      changed_fields: null,
      required_activity_quote: "",
      role_evidence: [],
      follow_up: "",
      activity: "",
      reply: "",
    };
    return Response.json({
      status: "completed",
      model: "gpt-5.4-mini-2026-03-17",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: JSON.stringify(plan) }],
        },
      ],
    });
  });
  const r = await worker.fetch(
    bodyRequest('{"message":"Are you Gemini?"}'),
    env,
  );
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const result = await r.json();
  assert.equal(result.provider, "openai");
  assert.match(result.text, /OpenAI/);
  assert.deepEqual(result.matches, []);
  assert(!JSON.stringify(result).includes("unit-only"));
});

function createObject(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  let queue = Promise.resolve(),
    alarm = null;
  const ctx = {
    blockConcurrencyWhile(fn) {
      const next = queue.then(fn);
      queue = next.catch(() => {});
      return next;
    },
    storage: {
      sql: {
        exec(statement, ...bindings) {
          const stmt = db.prepare(statement);
          const values = stmt.columns().length
            ? stmt.all(...bindings)
            : (stmt.run(...bindings), []);
          return {
            toArray: () => values,
            one: () => {
              assert.equal(values.length, 1);
              return values[0];
            },
          };
        },
      },
      transactionSync(fn) {
        db.exec("BEGIN");
        try {
          const v = fn();
          db.exec("COMMIT");
          return v;
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        }
      },
      getAlarm: async () => alarm,
      setAlarm: async (when) => {
        alarm = when;
      },
    },
  };
  return { quota: new ChatQuota(ctx), db, ctx };
}

test("atomic rolling network limit also holds across UTC midnight, with salts and idle clean-up", async (t) => {
  let now = Date.UTC(2026, 10, 20, 23, 59, 45);
  t.mock.method(Date, "now", () => now);
  const { quota, db, ctx } = createObject(t);
  const first = await Promise.all(
    Array.from({ length: 16 }, () => quota.reserve("4:192.0.2")),
  );
  assert.equal(first.filter((v) => v === 0).length, 8);
  assert(first.filter(Boolean).every((wait) => wait === 60));
  now += 20_000;
  assert.equal(await quota.reserve("4:192.0.2"), 40);
  assert.equal(await quota.reserve("4:198.51.100"), 0);
  now += 41_000;
  assert.equal(await quota.reserve("4:192.0.2"), 0);
  assert(
    db
      .prepare("SELECT bucket FROM events")
      .all()
      .every((r) => /^[0-9a-f]{64}$/.test(r.bucket)),
  );
  const before = db.prepare("SELECT COUNT(*) AS n FROM events").get().n;
  assert.equal(before, 2);
  assert(await ctx.storage.getAlarm());
  now += 61_000;
  await quota.alarm();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events").get().n, 0);
});

test("global daily cap is atomic across distinct network groups", async (t) => {
  let now = Date.UTC(2026, 10, 20, 12);
  t.mock.method(Date, "now", () => now);
  const { quota, db } = createObject(t);
  const waits = await Promise.all(
    Array.from({ length: 260 }, (_, i) => quota.reserve("6:2001:db8:" + i)),
  );
  assert.equal(waits.filter((v) => v === 0).length, 250);
  assert.equal(Math.max(...waits), 12 * 60 * 60);
  assert.equal(db.prepare("SELECT SUM(used) as n FROM days").get().n, 250);
  now += 12 * 60 * 60 * 1000;
  assert.equal(await quota.reserve("6:2001:db8:251"), 0);
});
