import catalog from "../site/data/catalog.json" with { type: "json" };
import { answerLive, DEFAULT_MODEL, LiveError, validateTurn } from "./live.mjs";

const ORIGIN = "https://rongsenzhang.github.io";
const OWNER_REPO = "rongsenzhang/common-hours";
const MAX_BYTES = 32 * 1024;
const MINUTE = 60_000;
const DAY = 86_400_000;
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

// Retain the v1 Durable Object for in-flight requests and alarms from earlier
// deployments. New chat traffic goes directly to the configured provider.
export class ChatQuota {
  constructor(ctx) {
    this.storage = ctx.storage;
  }

  fetch(request) {
    return new Response(null, { status: request.method === "POST" ? 204 : 405 });
  }

  async alarm() {
    const now = Date.now();
    const sql = this.storage.sql;
    sql.exec("DELETE FROM events WHERE stamp <= ?", now - MINUTE);
    sql.exec("DELETE FROM days WHERE day < ?", Math.floor((now - MINUTE) / DAY));
    const first = sql.exec("SELECT MIN(stamp) AS stamp FROM events").one().stamp;
    if (first !== null) await this.storage.setAlarm(first + MINUTE + 1);
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
