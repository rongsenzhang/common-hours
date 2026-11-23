// Uses fixed public examples, the real server implementation and the real Responses API.
// The credential is supplied only to this process. Logs contain no prompts, replies or credentials.
import { readFile } from "node:fs/promises";
import { matchCommunityCase } from "../site/community-case.js";
import { exerciseProfile, EXERCISE_CASE_TEXT } from "../site/exercise-engine.js";
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
  let answer;
  try {
    answer = await answerLive({ message, history, roles, apiKey, model: DEFAULT_MODEL });
    requireResult(answer.provider === "openai" && answer.model === DEFAULT_MODEL);
    requireResult(typeof answer.text === "string" && answer.text.trim());
    requireResult(Array.isArray(answer.matches) && Array.isArray(answer.toConfirm));
    expected(answer);
    history.push({
      user: message, text: answer.text, matches: answer.matches, toConfirm: answer.toConfirm,
      ...(answer.caseProfile && {caseProfile: answer.caseProfile}),
    });
    console.log("PASS", label);
    return answer;
  } catch (error) {
    const reason = error instanceof LiveError && safeErrorCodes.has(error.code)
      ? error.code : "unexpected_outcome";
    // Only these bounded, server-validated enums/numbers and fictional catalogue
    // IDs are logged. Never print visitor text, provider content or request data.
    const facts = answer ? JSON.stringify({
      profile: answer.caseProfile ?? null, recommended: answer.matches, pending: answer.toConfirm,
    }) : "";
    throw new Error(`${label}: ${reason} ${facts}`);
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
  const cases = [];
  const expectProfile = (expected) => answer => {
    const profile = answer.caseProfile;
    requireResult(profile && profile.days.length === expected.days.length
      && expected.days.every(day => profile.days.includes(day)));
    for (const key of ["period", "mode", "maxMiles", "clearance", "individual", "digital"]) {
      requireResult(profile[key] === expected[key]);
    }
    const ranked = matchCommunityCase(roles, expected, {limit: Infinity});
    const recs = new Map(ranked.recommendations.map(row => [row.role.id,row.points]));
    const pending = new Set(ranked.pending.map(row => row.role.id));
    requireResult(answer.matches.length === Math.min(3, recs.size)
      && answer.matches.every((id, index) => recs.get(id) === ranked.recommendations[index].points));
    requireResult(answer.toConfirm.length === Math.min(3, pending.size)
      && answer.toConfirm.every(id => pending.has(id)));
  };
  await checkTurn("Case A, submitted profile", EXERCISE_CASE_TEXT.A, cases, expectProfile(exerciseProfile("A")));
  await checkTurn("Case B as a change to the volunteer", EXERCISE_CASE_TEXT.B, cases, expectProfile(exerciseProfile("B")));
  await checkTurn("change the travel radius in natural language",
    "Keep the rest, but I could get to a venue five miles away now.", cases,
    expectProfile({...exerciseProfile("B"), maxMiles: 5}));

  const coaching = [];
  await checkTurn("an undecided volunteer gets a discovery question",
    "I'd like to help out, but I have no idea what I'd be good at. Could you help me work that out?", coaching,
    (reply) => { noRoles(reply); requireResult(/[?？]/u.test(reply.text)); });
  const found = await checkTurn("skills and constraints lead to actionable roles",
    "I like helping one person at a time learn to use a phone. I can only volunteer online on weekday evenings.", coaching,
    reply => {
      expectProfile({...exerciseProfile("A"), mode:"online", maxMiles:null})(reply);
      requireResult(reply.matches.slice(0, 2).every(id => {
        const facts = roles.find(item => item.id === id).caseFacts;
        return facts.individualEvidence && facts.digitalEvidence;
      }));
      requireResult(reply.matches.every(id => ["remote","hybrid"].includes(roles.find(role => role.id === id).mode)));
    });
  await checkTurn("why the work suits the volunteer", "Why did you choose these for me?", coaching, reply => {
    requireResult(reply.matches.length > 0 && reply.matches.every(id => found.matches.includes(id)));
    requireResult(Object.values(reply.evidence).some(item => item.sourceQuote && item.userQuote));
  });
  await checkTurn("an unsupported exact time needs confirmation",
    "One more thing, I can only start at exactly 6:35pm. Which role guarantees that start time?", coaching, noRoles);
  const chinese = [];
  await checkTurn("Chinese guided discovery", "我想尝试做志愿者，但不知道自己能做什么。", chinese,
    reply => { noRoles(reply); requireResult(/[?？]/u.test(reply.text)); });
  const chineseFound = await checkTurn("Chinese volunteer skills stay soft while logistics remain hard",
    "朋友经常叫我教他们用手机。我喜欢一次帮一个人，而且我只能在工作日晚上线上参加。", chinese,
    reply => expectProfile({...exerciseProfile("A"), mode:"online", maxMiles:null})(reply));
  await checkTurn("Chinese personalised recommendation explanation", "我说的哪些经验和这些岗位的工作有关？", chinese, reply => {
    requireResult(reply.matches.some(id => chineseFound.matches.includes(id)));
    requireResult(Object.values(reply.evidence).some(item => item.sourceQuote && item.userQuote));
  });
  console.log("Verified fifteen real OpenAI turns with", DEFAULT_MODEL);
}

checkLiveResponses().catch((error) => {
  // The only messages that leave checkLiveResponses are our own fixed diagnostics.
  console.error(error.message);
  process.exitCode = 1;
});
