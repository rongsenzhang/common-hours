import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker, { ChatQuota } from "../server/worker.mjs";

const ORIGIN = "https://rongsenzhang.github.io";
function bodyRequest(body, extra = {}, method = "POST", url = "/api/chat") {
  return new Request("https://worker.example" + url, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json", ...extra },
    body,
    duplex: "half",
  });
}

function makeEnv() {
  return { OPENAI_API_KEY: "unit-only", OWNER_REPO: "rongsenzhang/common-hours" };
}

test("health reports public configuration only and restricted browser preflight", async (t) => {
  const provider = t.mock.method(globalThis, "fetch", () => assert.fail("Unexpected provider request"));
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
  assert.equal(provider.mock.callCount(), 0);
});

test("schema, content type, declared and streamed bytes are checked before calling OpenAI", async (t) => {
  const provider = t.mock.method(globalThis, "fetch", () => assert.fail("Unexpected provider request"));
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
  assert.equal(provider.mock.callCount(), 0);
});

test("accepted requests invoke the configured provider for every turn even beyond the former limits", async (t) => {
  const env = makeEnv();
  const provider = t.mock.method(globalThis, "fetch", async (url, options) => {
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
      required_activity_ref: null,
      role_evidence: [],
      follow_up: "",
      activity: "",
      reply: "",
    };
    return Response.json({
      status: "completed",
      model: JSON.parse(options.body).model,
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: JSON.stringify(plan) }],
        },
      ],
    });
  });
  let reply;
  for (let i = 0; i < 251; i++) {
    reply = await worker.fetch(
      bodyRequest('{"message":"Are you Gemini?"}', { "CF-Connecting-IP": "192.0.2.1" }),
      env,
    );
    assert.equal(reply.status, 200);
  }
  assert.equal(provider.mock.callCount(), 251);
  assert.equal(reply.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const result = await reply.json();
  assert.equal(result.provider, "openai");
  assert.match(result.text, /OpenAI/);
  assert.deepEqual(result.matches, []);
  assert(!JSON.stringify(result).includes("unit-only"));
});

test("a provider rate limit remains distinguishable from an application limit", async (t) => {
  t.mock.method(globalThis, "fetch", () => new Response(null, { status: 429 }));
  const reply = await worker.fetch(bodyRequest('{"message":"Hello"}'), makeEnv());
  assert.equal(reply.status, 429);
  assert.deepEqual(await reply.json(), { error: "provider_busy" });
});

test("the retired quota object accepts legacy calls and finishes pending expiry alarms", async (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec("CREATE TABLE events (stamp INTEGER, bucket TEXT); CREATE TABLE days (day INTEGER, used INTEGER, salt BLOB)");
  const now = Date.UTC(2026, 10, 24, 12);
  const minute = 60_000;
  const day = Math.floor(now / 86_400_000);
  t.mock.method(Date, "now", () => now);
  db.prepare("INSERT INTO events VALUES (?, 'expired'), (?, 'recent')").run(now - minute, now);
  db.prepare("INSERT INTO days VALUES (?, 250, x'01'), (?, 10, x'02')").run(day - 1, day);
  let nextAlarm;
  const quota = new ChatQuota({
    storage: {
      sql: {
        exec(statement, ...args) {
          const query = db.prepare(statement);
          if (query.columns().length) return { one: () => query.get(...args) };
          query.run(...args);
        },
      },
      async setAlarm(when) { nextAlarm = when; },
    },
  });
  const reply = await quota.fetch(new Request("https://internal/reserve", { method: "POST" }));
  assert.equal(reply.status, 204);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events").get().n, 2);
  await quota.alarm();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM days").get().n, 1);
  assert.equal(nextAlarm, now + minute + 1);
});
