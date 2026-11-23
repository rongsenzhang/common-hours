import test from "node:test";
import assert from "node:assert/strict";
import {
  chatEndpoint,
  requestLiveReply,
  liveFailureMessage,
} from "../site/live-chat.js";
import { renderChat } from "../site/chat-view.js";

const roles = [
  {
    id: "garden",
    title: "Garden volunteer",
    organisation: "Garden",
    area: "Salford",
    summary: "Plant seedlings.",
  },
];
const reply = {
  provider: "openai",
  model: "test-model",
  text: "The host still needs to confirm access.",
  matches: [],
  toConfirm: ["garden"],
  details: { garden: "Access awaits confirmation." },
};
const base = {
  endpoint: "https://example.test/chat",
  message: "Can I grow food?",
  turns: [],
  roles,
};
const json = (data) => Response.json(data);

test("public configuration permits HTTPS and local HTTP during local development", () => {
  assert.equal(
    chatEndpoint(
      { endpoint: "https://assistant.example/api/chat" },
      "https://example.com",
    ),
    "https://assistant.example/api/chat",
  );
  assert.equal(
    chatEndpoint({ endpoint: "/api/chat" }, "https://example.com/app/"),
    "https://example.com/api/chat",
  );
  assert.equal(
    chatEndpoint(
      { endpoint: "http://localhost:8787/api/chat" },
      "http://127.0.0.1:8000",
    ),
    "http://localhost:8787/api/chat",
  );
  for (const endpoint of [
    null,
    "",
    "file:///tmp/chat",
    "http://assistant.example/api/chat",
    "http://localhost:8787/api/chat",
    "https://user:password@example.com/chat",
    "https://example.com/chat?x=1",
  ]) {
    assert.equal(chatEndpoint({ endpoint }, "https://example.com"), null);
  }
});

test("sends only the last eight completed AI turns and preserves the provider metadata from the gateway", async () => {
  const turns = Array.from({ length: 10 }, (_, i) => ({
    input: "turn " + i,
    reply,
  }));
  turns.push({
    input: "private local message",
    reply: { text: "local", matches: [], toConfirm: [] },
  });
  let request;
  const actual = await requestLiveReply({
    ...base,
    turns,
    fetchImpl: async (_url, init) => {
      request = init;
      return json(reply);
    },
  });
  assert.deepEqual(actual, reply);
  const sent = JSON.parse(request.body);
  assert.deepEqual(
    sent.history.map((row) => row.user),
    Array.from({ length: 8 }, (_, i) => "turn " + (i + 2)),
  );
  assert.deepEqual(sent.history[0], {
    user: "turn 2",
    text: reply.text,
    matches: [],
    toConfirm: ["garden"],
  });
  assert.equal(request.method, "POST");
  assert.equal(request.credentials, "omit");
  assert.equal(Object.hasOwn(request.headers, "Authorization"), false);
});

test("unknown card IDs, duplicate cards, invalid provider and invalid formats are never shown as live", async () => {
  for (const data of [
    { ...reply, matches: ["imaginary"] },
    { ...reply, matches: ["garden"] },
    { ...reply, provider: "local" },
    { ...reply, text: "" },
    { ...reply, matches: null },
  ]) {
    await assert.rejects(
      requestLiveReply({ ...base, fetchImpl: async () => json(data) }),
      { kind: "invalid" },
    );
  }
  await assert.rejects(
    requestLiveReply({
      ...base,
      fetchImpl: async () => new Response("<html>offline</html>"),
    }),
    { kind: "invalid" },
  );
});

test("service failure, client cancellation and timeout cannot be mistaken for model output", async () => {
  const wait = async (_url, { signal }) =>
    new Promise((_res, rej) =>
      signal.addEventListener("abort", () => rej(new Error("aborted")), {
        once: true,
      }),
    );
  await assert.rejects(
    requestLiveReply({ ...base, fetchImpl: wait, timeoutMs: 5 }),
    { kind: "timeout" },
  );
  const cancel = new AbortController();
  const pending = requestLiveReply({
    ...base,
    fetchImpl: wait,
    signal: cancel.signal,
  });
  cancel.abort();
  await assert.rejects(pending, { kind: "cancelled" });
  await assert.rejects(
    requestLiveReply({
      ...base,
      fetchImpl: async () => new Response("", { status: 429 }),
    }),
    { kind: "busy" },
  );
  assert.match(liveFailureMessage("busy", "周末遛狗"), /使用上限/);
});

test("the pre-send disclosure matches the selected mode and labels are escaped", () => {
  const local = renderChat([], roles);
  assert.match(local, /questions stay in this tab/);
  assert.doesNotMatch(local, /Live AI uses OpenAI/);
  const live = renderChat(
    [{ input: "<script>", reply: { ...reply, text: "<b>unsafe</b>" } }],
    roles,
    { mode: "live", liveAvailable: true, pending: "what next?" },
  );
  assert.match(live, /up to eight recent turns/);
  assert.ok(live.indexOf("Sending a message") < live.indexOf('id="chat-form"'));
  assert.match(live, /Waiting for OpenAI/);
  assert.match(live, /data-cancel-chat/);
  assert.match(live, /OpenAI · test-model/);
  assert.doesNotMatch(live, /<script>|<b>unsafe/);
});

test("a live follow-up preserves checked volunteer constraints while keeping unrelated response fields out of history", async () => {
  const profile = {days: ["Tue"], period: "evening", maxMiles: 3, mode: "in-person",
    clearance: "unknown", verifiedRoleId: null, individual: true, digital: true, stepFree: false};
  const first = await requestLiveReply({...base, fetchImpl: async () =>
    json({...reply, caseProfile: {...profile, unrelated: "ignore"}})});
  let body;
  await requestLiveReply({...base, turns: [{input: "Case B", reply: first}], fetchImpl: async (_url, opts) => {
    body = JSON.parse(opts.body);
    return json(reply);
  }});
  assert.deepEqual(body.history[0].caseProfile, profile);
  await assert.rejects(requestLiveReply({...base, fetchImpl: async () =>
    json({...reply, caseProfile: {...profile, maxMiles: -1}})}), {kind: "invalid"});
});
