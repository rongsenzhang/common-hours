// Uses five fixed public examples, the real server implementation and the real Responses API.
// The credential is supplied only to this process. Logs contain no prompts, replies or credentials.
import { readFile } from "node:fs/promises";
import { answerLive, DEFAULT_MODEL, LiveError } from "../server/live.mjs";

const roles = JSON.parse(
  await readFile(new URL("../site/data/catalog.json", import.meta.url), "utf8"),
).opportunities;
const apiKey = process.env.OPENAI_API_KEY;
const safeErrorCodes = new Set([
  "invalid_request", "provider_unavailable", "invalid_reply", "provider_busy", "provider_timeout",
]);

function requireResult(condition) {
  if (!condition) throw new Error("Unexpected outcome");
}

async function checkTurn(label, message, history, expected) {
  try {
    const answer = await answerLive({ message, history, roles, apiKey, model: DEFAULT_MODEL });
    requireResult(answer.provider === "openai" && answer.model === DEFAULT_MODEL);
    requireResult(typeof answer.text === "string" && answer.text.trim());
    requireResult(Array.isArray(answer.matches) && Array.isArray(answer.toConfirm));
    expected(answer);
    history.push({
      user: message, text: answer.text, matches: answer.matches, toConfirm: answer.toConfirm,
    });
    console.log("PASS", label);
  } catch (error) {
    const reason = error instanceof LiveError && safeErrorCodes.has(error.code)
      ? error.code : "unexpected_outcome";
    throw new Error(`${label}: ${reason}`);
  }
}

async function checkLiveResponses() {
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY for the live smoke run.");
  const conversation = [];
  const noRoles = (reply) => requireResult(reply.matches.length === 0 && reply.toConfirm.length === 0);
  await checkTurn("weekend dog walk", "Can I walk dogs at weekends?", conversation,
    ({ matches, toConfirm }) => requireResult(
      matches.length === 1 && matches[0] === "shelter-dog-walker" && toConfirm.length === 0));
  await checkTurn("greeting", "How are you?", conversation, noRoles);
  await checkTurn("assistant identity", "Are you Gemini?", conversation, (reply) => {
    noRoles(reply);
    requireResult(reply.text.toLowerCase().includes("openai"));
  });
  await checkTurn("weekday refinement after small talk", "What about weekdays instead?", conversation,
    ({ matches, toConfirm }) => requireResult(
      matches.length === 1 && matches[0] === "neighbourhood-dog-walker" && toConfirm.length === 0));
  await checkTurn("garden access needs host confirmation",
    "I want to help at the community garden at weekends. I need a step-free route to the beds.", [],
    ({ matches, toConfirm }) => requireResult(
      !matches.includes("garden-buddy") && toConfirm.includes("garden-buddy")));
  console.log("Verified five real OpenAI turns with", DEFAULT_MODEL);
}

checkLiveResponses().catch((error) => {
  // The only messages that leave checkLiveResponses are our own fixed diagnostics.
  console.error(error.message);
  process.exitCode = 1;
});
