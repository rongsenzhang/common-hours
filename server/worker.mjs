import catalog from "../site/data/catalog.json" with { type: "json" };
import { answerLive, DEFAULT_MODEL, LiveError, validateTurn } from "./live.mjs";

const ORIGIN = "https://rongsenzhang.github.io";
const OWNER_REPO = "rongsenzhang/common-hours";
const MAX_BYTES = 32 * 1024;
const MINUTE = 60_000;
const DAY = 86_400_000;
const DAILY = 250;
const PER_NETWORK = 8;
const roles = catalog.opportunities;

function response(request, status, body, extra = {}) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
    ...extra,
  };
  if (request.headers.get("Origin") === ORIGIN)
    headers["Access-Control-Allow-Origin"] = ORIGIN;
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

async function readTurn(request) {
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new LiveError("media_type", 415, "Send the chat request as JSON.");
  }
  const tooLong = () =>
    new LiveError(
      "body_too_large",
      413,
      "The conversation is too large to send.",
    );
  if (Number(request.headers.get("Content-Length")) > MAX_BYTES)
    throw tooLong();
  if (!request.body)
    throw new LiveError("invalid_request", 400, "Please enter a question.");
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0,
    timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    reader.cancel().catch(() => {});
  }, 8000);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (timedOut)
        throw new LiveError(
          "body_timeout",
          408,
          "Please try sending the question again.",
        );
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        reader.cancel().catch(() => {});
        throw tooLong();
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  let body;
  try {
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  } catch {
    throw new LiveError("invalid_request", 400, "Please send valid JSON.");
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !["message", "history"].includes(k))
  ) {
    throw new LiveError(
      "invalid_request",
      400,
      "Expected a message and optional recent turns.",
    );
  }
  return validateTurn(body, roles);
}

// Aggregate public v4 /24s and v6 /64s. The edge supplies CF-Connecting-IP and the
// Worker sends only the prefix to its private object for transient hashing.
export function networkPrefix(value) {
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (ipv4 && ipv4.slice(1).every((part) => Number(part) <= 255)) {
    return "4:" + ipv4.slice(1, 4).map(Number).join(".");
  }
  if (!value || !/^[0-9a-f:.]+$/i.test(value) || !value.includes(":"))
    return "shared";
  try {
    const host = new URL("https://[" + value + "]").hostname.slice(1, -1);
    const [left, right] = host.split("::");
    const a = left ? left.split(":") : [];
    const b = right ? right.split(":") : [];
    const expanded = [...a, ...Array(8 - a.length - b.length).fill("0"), ...b];
    // IPv4-mapped IPv6 addresses must share the corresponding IPv4 quota.
    if (
      expanded.slice(0, 5).every((p) => p === "0") &&
      expanded[5] === "ffff"
    ) {
      const part = parseInt(expanded[6], 16);
      return (
        "4:" + [part >> 8, part & 255, parseInt(expanded[7], 16) >> 8].join(".")
      );
    }
    return "6:" + expanded.slice(0, 4).join(":");
  } catch {
    return "shared";
  }
}

async function digest(salt, prefix) {
  const key = await crypto.subtle.importKey(
    "raw",
    salt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hash = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(prefix)),
  );
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

// One named object globally arbitrates both limits. No prompt, conversation, address
// or raw network prefix is written to its database. Provider work runs outside it.
export class ChatQuota {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS days (day INTEGER PRIMARY KEY, used INTEGER NOT NULL, salt BLOB NOT NULL)",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS events (stamp INTEGER NOT NULL, bucket TEXT NOT NULL)",
    );
  }

  cleanup(now) {
    this.sql.exec("DELETE FROM events WHERE stamp <= ?", now - MINUTE);
    this.sql.exec(
      "DELETE FROM days WHERE day < ?",
      Math.floor((now - MINUTE) / DAY),
    );
  }

  async alarm() {
    const now = Date.now();
    this.cleanup(now);
    const first = this.sql
      .exec("SELECT MIN(stamp) AS stamp FROM events")
      .one().stamp;
    if (first !== null) await this.ctx.storage.setAlarm(first + MINUTE + 1);
  }

  async reserve(prefix) {
    // blockConcurrencyWhile also covers asynchronous Web Crypto and the UTC transition.
    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now(),
        day = Math.floor(now / DAY);
      this.cleanup(now);
      let row = this.sql
        .exec("SELECT used,salt FROM days WHERE day=?", day)
        .toArray()[0];
      if (!row) {
        const salt = crypto.getRandomValues(new Uint8Array(32));
        this.sql.exec(
          "INSERT INTO days(day,used,salt) VALUES(?,0,?)",
          day,
          salt,
        );
        row = { used: 0, salt };
      }
      if (row.used >= DAILY)
        return Math.max(1, Math.ceil(((day + 1) * DAY - now) / 1000));
      const bucket = await digest(row.salt, prefix);
      let previous = bucket;
      if (now % DAY < MINUTE) {
        const old = this.sql
          .exec("SELECT salt FROM days WHERE day=?", day - 1)
          .toArray()[0];
        if (old) previous = await digest(old.salt, prefix);
      }
      const usage = this.sql
        .exec(
          "SELECT COUNT(*) AS used,MIN(stamp) AS first FROM events WHERE bucket IN (?,?)",
          bucket,
          previous,
        )
        .one();
      if (usage.used >= PER_NETWORK)
        return Math.max(1, Math.ceil((usage.first + MINUTE - now) / 1000));
      this.ctx.storage.transactionSync(() => {
        this.sql.exec(
          "INSERT INTO events(stamp,bucket) VALUES(?,?)",
          now,
          bucket,
        );
        this.sql.exec("UPDATE days SET used=used+1 WHERE day=?", day);
      });
      if ((await this.ctx.storage.getAlarm()) === null)
        await this.ctx.storage.setAlarm(now + MINUTE + 1);
      return 0;
    });
  }

  async fetch(request) {
    if (request.method !== "POST") return new Response(null, { status: 405 });
    const prefix = await request.text();
    if (!/^(?:shared|[46]:[\da-f:.]{1,35})$/.test(prefix))
      return new Response(null, { status: 400 });
    const wait = await this.reserve(prefix);
    return new Response(null, {
      status: wait ? 429 : 204,
      headers: wait ? { "Retry-After": String(wait) } : {},
    });
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const model = env.OPENAI_MODEL || DEFAULT_MODEL;
    const validModel =
      typeof model === "string" && /^gpt-[a-z0-9.-]{1,100}$/.test(model);
    const configured = Boolean(
      typeof env.OPENAI_API_KEY === "string" &&
        env.OPENAI_API_KEY.trim() &&
        env.CHAT_QUOTA &&
        validModel &&
        env.OWNER_REPO === OWNER_REPO,
    );
    if (pathname === "/api/status" && request.method === "GET") {
      return response(request, 200, {
        service: "common-hours-live",
        configured,
        provider: "openai",
        model: validModel ? model : DEFAULT_MODEL,
        owner_repo: OWNER_REPO,
      });
    }
    if (pathname !== "/api/chat")
      return response(request, 404, { error: "not_found" });
    if (request.headers.get("Origin") !== ORIGIN)
      return response(request, 403, { error: "origin_denied" });
    if (request.method === "OPTIONS") {
      const headers = (
        request.headers.get("Access-Control-Request-Headers") || ""
      )
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      if (
        request.headers.get("Access-Control-Request-Method") !== "POST" ||
        headers.some((h) => !["content-type", "accept"].includes(h))
      ) {
        return response(request, 403, { error: "preflight_denied" });
      }
      return response(request, 204, null, {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Max-Age": "600",
      });
    }
    if (request.method !== "POST")
      return response(
        request,
        405,
        { error: "method_not_allowed" },
        { Allow: "POST, OPTIONS" },
      );
    if (!configured)
      return response(request, 503, { error: "service_unavailable" });
    try {
      const turn = await readTurn(request);
      const budget = env.CHAT_QUOTA.get(env.CHAT_QUOTA.idFromName("global-v1"));
      const quota = await budget.fetch("https://quota.internal/reserve", {
        method: "POST",
        body: networkPrefix(request.headers.get("CF-Connecting-IP") || ""),
      });
      if (quota.status === 429)
        return response(
          request,
          429,
          { error: "usage_limit" },
          { "Retry-After": quota.headers.get("Retry-After") || "60" },
        );
      if (quota.status !== 204)
        return response(request, 503, { error: "service_unavailable" });
      const reply = await answerLive({
        ...turn,
        roles,
        model,
        apiKey: env.OPENAI_API_KEY,
        signal: request.signal,
      });
      return response(request, 200, reply);
    } catch (error) {
      if (error instanceof LiveError)
        return response(
          request,
          error.status,
          { error: error.code },
          error.status === 429 ? { "Retry-After": "60" } : {},
        );
      return response(request, 503, { error: "service_unavailable" });
    }
  },
};
