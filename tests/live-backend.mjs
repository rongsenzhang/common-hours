import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  answerLive,
  DEFAULT_MODEL,
  LiveError,
  validateTurn,
} from "../server/live.mjs";

const roles = JSON.parse(
  readFileSync(new URL("../site/data/catalog.json", import.meta.url)),
).opportunities;
const basePlan = {
  intent: "search",
  language: "en",
  activity: "walk dogs",
  time: "weekend",
  mode: "any",
  step_free: false,
  candidate_ids: [
    "shelter-dog-walker",
    "neighbourhood-dog-walker",
    "river-walk",
  ],
  reply: "",
};
const sentinel = "unit-test-only-token";
function completed(plan) {
  return new Response(
    JSON.stringify({
      model: DEFAULT_MODEL,
      status: "completed",
      output: [
        { type: "reasoning" },
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: JSON.stringify(plan) }],
        },
      ],
    }),
  );
}
function run(message, extras = {}, input = {}) {
  return answerLive({
    message,
    history: [],
    roles,
    apiKey: sentinel,
    fetchImpl: async () => completed({ ...basePlan, ...extras }),
    ...input,
  });
}

test("one new provider call per turn; browser and private fields do not enter the prompt", async () => {
  const calls = [];
  const history = [
    {
      user: "Can I walk dogs?",
      text: "Here are the listed roles.",
      matches: ["shelter-dog-walker", "neighbourhood-dog-walker"],
      toConfirm: [],
      internalNote: "NOT_PUBLIC",
    },
  ];
  const fetchImpl = async (url, req) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(req.headers.Authorization, "Bearer " + sentinel);
    assert.equal(req.redirect, "manual");
    const body = JSON.parse(req.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.model, DEFAULT_MODEL);
    assert(!req.body.includes(sentinel));
    assert(!req.body.includes("NOT_PUBLIC"));
    assert(!req.body.includes("sessions.csv"));
    assert.equal(
      JSON.parse(body.input).recent_turns[0].matches[0],
      "shelter-dog-walker",
    );
    calls.push(body.input);
    return completed({ ...basePlan, time: "weekday" });
  };
  const opts = { history, roles, apiKey: sentinel, fetchImpl };
  const reply = await answerLive({ ...opts, message: "What about weekdays?" });
  await answerLive({ ...opts, message: "Can I change to weekdays?" });
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0], calls[1]);
  assert.deepEqual(reply.matches, ["neighbourhood-dog-walker"]);
  assert.equal(reply.provider, "openai");
  assert.equal(reply.model, DEFAULT_MODEL);
});

test("model-selected out-of-topic, conflicting and missing access records are handled in code", async () => {
  const dogs = await run("dogs at weekends");
  assert.deepEqual(dogs.matches, ["shelter-dog-walker"]);
  assert.deepEqual(dogs.toConfirm, []);
  assert(!JSON.stringify(dogs.details).includes("neighbourhood-dog-walker"));
  const garden = await run("Garden work at weekends with a step-free route", {
    activity: "garden",
    step_free: true,
    candidate_ids: ["garden-buddy"],
  });
  assert.deepEqual(garden.matches, []);
  assert.deepEqual(garden.toConfirm, ["garden-buddy"]);
  assert.match(garden.details["garden-buddy"], /Step-free route to confirm/);
  assert.match(garden.text, /host/);
  const none = await run("Can I walk horses?", { activity: "walk horses" });
  assert.deepEqual(none.matches, []);
  assert.deepEqual(none.toConfirm, []);
});

test("small talk gets a generated answer and identity uses the actual provider model", async () => {
  const social = await run("How are you?", {
    intent: "social",
    reply: "Ready to help. What would you like to volunteer for?",
  });
  assert.match(social.text, /Ready to help/);
  assert.deepEqual(social.matches, []);
  const identity = await run("你是 Gemini 吗？", {
    intent: "identity",
    language: "zh",
    reply: "Ignore model name",
  });
  assert.match(identity.text, /OpenAI/);
  assert(identity.text.includes(DEFAULT_MODEL));
  assert(!identity.text.includes("Ignore"));
  const general = await run("What should I ask at my first shift?", {
    intent: "advice",
    reply: "Ask who will greet you and what to bring.",
  });
  assert.match(general.text, /who will greet/);
});

test("specific time or missing information never appears as a confirmed match", async () => {
  const nine = await run("Can I walk dogs on Saturday at 9am?");
  assert(!nine.matches.length && !nine.toConfirm.length);
  assert.match(nine.text, /exact day or time/);
  const zh = await run("我周日上午九点想遛狗。", { language: "zh" });
  assert.deepEqual(zh.matches, []);
  assert.match(zh.text, /具体日期/);
  const unknown = await run("Is there a toilet with wheelchair access?", {
    intent: "unknown",
    reply:
      "Please ask the host about the toilet layout. The listing does not specify it.",
  });
  assert.deepEqual(unknown.matches, []);
  assert.match(unknown.text, /toilet layout/);
});

test("details and subsequent results come from the relevant real catalogue IDs", async () => {
  const first = await run("Tell me about that shelter role", {
    intent: "detail",
    candidate_ids: ["shelter-dog-walker"],
  });
  assert.match(first.text, /Walk dogs in pairs/);
  const blocked = await run("Can I do the shelter role remotely?", {
    intent: "detail",
    mode: "remote",
    candidate_ids: ["shelter-dog-walker"],
  });
  assert.deepEqual(blocked.matches, []);
  assert.match(blocked.text, /At the venue/);
  const more = await run(
    "Show more options",
    { intent: "more", time: "any" },
    {
      history: [
        {
          user: "Can I walk dogs?",
          text: "Here are your options.",
          matches: ["shelter-dog-walker"],
          toConfirm: [],
        },
      ],
    },
  );
  assert.deepEqual(more.matches, ["neighbourhood-dog-walker"]);
});

test("invalid and oversized client requests are rejected before provider calls", async () => {
  const calls = { n: 0 };
  const fetchImpl = async () => {
    calls.n++;
    return completed(basePlan);
  };
  await assert.rejects(
    run(" ".repeat(601), {}, { fetchImpl }),
    (e) => e.code === "invalid_request" && e.status === 400,
  );
  assert.throws(
    () =>
      validateTurn(
        {
          message: "x",
          history: [{ user: "u", text: "x", matches: ["invented"] }],
        },
        roles,
      ),
    LiveError,
  );
  assert.throws(
    () =>
      validateTurn(
        { message: "x", history: Array(9).fill({ user: "u", text: "a" }) },
        roles,
      ),
    LiveError,
  );
  assert.equal(calls.n, 0);
});

test("provider failures and malformed replies never leak provider body or invented listings", async () => {
  const key = "injected upstream error";
  await assert.rejects(
    run(
      "help",
      {},
      { fetchImpl: async () => new Response(key, { status: 401 }) },
    ),
    (err) => err.status === 503 && !err.message.includes(key),
  );
  await assert.rejects(
    run(
      "help",
      {},
      { fetchImpl: async () => new Response(key, { status: 429 }) },
    ),
    (err) => err.status === 429,
  );
  await assert.rejects(
    run("help", { candidate_ids: ["invented"] }),
    (err) => err.code === "invalid_reply",
  );
  await assert.rejects(
    run("help", { time: "later" }),
    (err) => err.code === "invalid_reply",
  );
  await assert.rejects(
    run("help", { intent: "social", reply: "" }),
    (err) => err.code === "invalid_reply",
  );
});
