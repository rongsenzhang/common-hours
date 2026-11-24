// Uses fixed public examples, the real server implementation and the real Responses API.
// The credential is supplied only to this process. Logs contain no prompts, replies or credentials.
import { readFile } from "node:fs/promises";
import { matchCommunityCase } from "../site/community-case.js";
import { exerciseProfile, EXERCISE_CASE_TEXT } from "../site/exercise-engine.js";
import { answerLive, DEFAULT_MODEL, LiveError, matchesRequestedModel } from "../server/live.mjs";

const roles = JSON.parse(
  await readFile(new URL("../site/data/catalog.json", import.meta.url), "utf8"),
).opportunities;
const apiKey = process.env.OPENAI_API_KEY;
const safeErrorCodes = new Set([
  "invalid_request", "provider_unavailable", "invalid_reply", "provider_busy", "provider_timeout",
]);

class VerificationFailure extends Error {}

// Include actionable API diagnostics while keeping upstream text and credentials out of CI logs.
const publicProviderCodes = new Set([
  "model_not_found", "insufficient_permissions", "invalid_api_key", "insufficient_quota",
  "rate_limit_exceeded", "unsupported_parameter", "unsupported_value", "invalid_json_schema",
]);

function requireResult(condition, criterion = "unexpected_outcome") {
  if (!condition) throw new VerificationFailure(criterion);
}

async function checkTurn(label, message, history, expected) {
  let answer;
  let upstreamFailure = "";
  async function observeProvider(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = (await response.clone().json().catch(() => null))?.error;
      upstreamFailure = `OpenAI HTTP ${response.status}`;
      if (publicProviderCodes.has(error?.code)) upstreamFailure += " " + error.code;
    }
    return response;
  }
  try {
    answer = await answerLive({ message, history, roles, apiKey, model: DEFAULT_MODEL, fetchImpl: observeProvider });
    requireResult(answer.provider === "openai" && matchesRequestedModel(answer.model), "unexpected_model");
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
      ? error.code : error instanceof VerificationFailure ? error.message : "unexpected_outcome";
    // Only these bounded, server-validated enums/numbers and fictional catalogue
    // IDs are logged. Never print visitor text, provider content or request data.
    const facts = answer ? JSON.stringify({
      profile: answer.caseProfile ?? null, recommended: answer.matches, pending: answer.toConfirm,
      evidence: Object.entries(answer.evidence ?? {}).map(([id, item]) =>
        [id, Boolean(item.sourceQuote), Boolean(item.userQuote), Boolean(item.reason)]),
    }) : "";
    throw new Error([label + ":", reason, upstreamFailure, facts].filter(Boolean).join(" "));
  }
}

const noRoles = (reply) => requireResult(reply.matches.length === 0 && reply.toConfirm.length === 0);

function expectIdentity(reply) {
  noRoles(reply);
  requireResult(reply.text.toLowerCase().includes("openai"));
}

const sameProfile = (first, next) => {
  requireResult(first && next && first.days.length === next.days.length && first.days.every(day => next.days.includes(day)));
  for (const key of ["period","mode","maxMiles","clearance","individual","digital","stepFree","verifiedRoleId"]) {
    requireResult(first[key] === next[key], "changed_" + key);
  }
};
const expectProfile = (expected, {openEnded = false} = {}) => answer => {
  const profile = answer.caseProfile;
  requireResult(profile && profile.days.length === expected.days.length
    && expected.days.every(day => profile.days.includes(day)), "profile_days");
  for (const key of ["period", "mode", "maxMiles", "clearance", "individual", "digital"]) {
    requireResult(profile[key] === expected[key], "profile_" + key);
  }
  const ranked = matchCommunityCase(roles, expected, {limit: Infinity});
  const recs = new Map(ranked.recommendations.map(row => [row.role.id,row.points]));
  const pending = new Set(ranked.pending.map(row => row.role.id));
  const maxConfirmed = Math.min(3, recs.size);
  const maxPending = Math.min(3, pending.size);
  if (openEnded) {
    requireResult(answer.matches.length >= 1 && answer.matches.length <= maxConfirmed);
    requireResult(answer.toConfirm.length <= maxPending);
  } else {
    requireResult(answer.matches.length === maxConfirmed && answer.toConfirm.length === maxPending);
  }
  requireResult(new Set([...answer.matches, ...answer.toConfirm]).size === answer.matches.length + answer.toConfirm.length);
  requireResult(answer.matches.every((id, index) => recs.has(id) && recs.get(id) === ranked.recommendations[index].points));
  requireResult(answer.toConfirm.every(id => pending.has(id)));
};

function expectPersonalExplanation(original, answer) {
  sameProfile(original.caseProfile, answer.caseProfile);
  requireResult(original.matches.length > 0 && original.matches.length === answer.matches.length, "explanation_count");
  requireResult(original.matches.every(id => answer.matches.includes(id) && answer.evidence[id]?.sourceQuote), "explanation_listing_evidence");
  requireResult(original.matches.some(id => answer.evidence[id]?.userQuote), "explanation_volunteer_evidence");
}

async function checkDogWalkConversation() {
  const conversation = [];
  await checkTurn("weekend dog walk", "Can I walk dogs at weekends?", conversation,
    ({ matches, toConfirm }) => requireResult(
      matches.length === 1 && matches[0] === "shelter-dog-walker" && toConfirm.length === 0));
  await checkTurn("greeting", "How are you?", conversation, noRoles);
  await checkTurn("assistant identity", "Are you Gemini?", conversation, expectIdentity);
  await checkTurn("weekday refinement after small talk", "What about weekdays instead?", conversation,
    ({ matches, toConfirm }) => requireResult(
      matches.length === 1 && matches[0] === "neighbourhood-dog-walker" && toConfirm.length === 0));
}

async function checkGardenAccess() {
  await checkTurn("garden access needs host confirmation",
    "I want to help at the community garden at weekends. I need a step-free route to the beds.", [],
    ({ matches, toConfirm }) => requireResult(
      !matches.includes("garden-buddy") && toConfirm.includes("garden-buddy"), "unconfirmed_garden_route"));
}

async function checkSuppliedCases() {
  const cases = [];
  await checkTurn("Case A, submitted profile", EXERCISE_CASE_TEXT.A, cases, expectProfile(exerciseProfile("A")));
  await checkTurn("Case B as a change to the volunteer", EXERCISE_CASE_TEXT.B, cases, expectProfile(exerciseProfile("B")));
  await checkTurn("change the travel radius in natural language",
    "Keep the rest, but I could get to a venue five miles away now.", cases,
    expectProfile({...exerciseProfile("B"), maxMiles: 5}));
}

async function checkEnglishCoaching() {
  const coaching = [];
  await checkTurn("an undecided volunteer gets a discovery question",
    "I'd like to help out, but I have no idea what I'd be good at. Could you help me work that out?", coaching,
    (reply) => { noRoles(reply); requireResult(/[?？]/u.test(reply.text)); });
  const found = await checkTurn("skills and constraints lead to actionable roles",
    "I like helping one person at a time learn to use a phone. I can only volunteer online on weekday evenings.", coaching,
    reply => {
      expectProfile({...exerciseProfile("A"), mode:"online", maxMiles:null}, {openEnded:true})(reply);
      requireResult(reply.matches.slice(0, 2).every(id => {
        const facts = roles.find(item => item.id === id).caseFacts;
        return facts.individualEvidence && facts.digitalEvidence;
      }));
      requireResult(reply.matches.every(id => ["remote","hybrid"].includes(roles.find(role => role.id === id).mode)));
    });
  await checkTurn("why the work suits the volunteer", "Why did you choose these for me?", coaching,
    reply => expectPersonalExplanation(found, reply));
  await checkTurn("an unsupported exact time needs confirmation",
    "One more thing, I can only start at exactly 6:35pm. Which role guarantees that start time?", coaching, reply => {
      noRoles(reply); requireResult(/6[:.]35\s*pm/iu.test(reply.text) && /host/iu.test(reply.text));
    });
}

async function checkChineseCoaching() {
  const chinese = [];
  await checkTurn("Chinese guided discovery", "我想尝试做志愿者，但不知道自己能做什么。", chinese,
    reply => { noRoles(reply); requireResult(/[?？]/u.test(reply.text)); });
  const chineseFound = await checkTurn("Chinese volunteer skills stay soft while logistics remain hard",
    "朋友经常叫我教他们用手机。我喜欢一次帮一个人，而且我只能在工作日晚上线上参加。", chinese,
    reply => expectProfile({...exerciseProfile("A"), mode:"online", maxMiles:null}, {openEnded:true})(reply));
  await checkTurn("Chinese personalised recommendation explanation", "我说的哪些经验和这些岗位的工作有关？", chinese,
    reply => expectPersonalExplanation(chineseFound, reply));
}

async function checkLiveResponses() {
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY for the live smoke run.");
  if (process.argv.includes("--preflight")) {
    await checkTurn("flagship access and structured response", "Are you Gemini?", [], expectIdentity);
    return;
  }
  const failures = [];
  for (const scenario of [checkDogWalkConversation, checkGardenAccess, checkSuppliedCases, checkEnglishCoaching, checkChineseCoaching]) {
    try {
      await scenario();
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (failures.length) throw new Error(failures.join("\n"));
  console.log("Verified fifteen real OpenAI turns with", DEFAULT_MODEL);
}

checkLiveResponses().catch((error) => {
  // The only messages that leave checkLiveResponses are our own fixed diagnostics.
  console.error(error.message);
  process.exitCode = 1;
});
