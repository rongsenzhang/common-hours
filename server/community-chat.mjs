// OpenAI interprets the conversation. The same record checks used by Discover
// decide whether each suggested role qualifies or needs a host to confirm it.
import { matchCommunityCase } from "../site/community-case.js";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const periods = ["any", "daytime", "evening"];
const modes = ["either", "in-person", "online"];
const clearances = ["unknown", "none", "verified"];
const choice = (values) => ({ type: "string", enum: values });

export function communityProfileSchema(required = false) {
  const properties = {
    days: { type: "array", items: choice(days) },
    period: choice(periods),
    mode: choice(modes),
    maxMiles: { type: ["number", "null"] },
    clearance: choice(clearances),
    verifiedRoleId: { type: ["string", "null"] },
    individual: { type: "boolean" },
    digital: { type: "boolean" },
    stepFree: { type: "boolean" },
  };
  const profile = {type: "object", properties, required: Object.keys(properties), additionalProperties: false};
  return required ? profile : {anyOf: [profile, {type:"null"}]};
}

export { validCommunityProfile } from "../site/community-case.js";

function describeProfile(profile) {
  const orderedDays = days.filter(day => profile.days.includes(day));
  let schedule = orderedDays.join(", ");
  if (orderedDays.length === 7) schedule = "any day";
  if (!schedule) schedule = "no available days";
  if (orderedDays.join() === days.slice(0, 5).join()) schedule = "weekdays";
  if (orderedDays.join() === days.slice(5).join()) schedule = "weekends";
  if (profile.period !== "any") {
    schedule += " in the " + profile.period;
  }
  const constraints = [schedule, {
    either: "online or in person",
    "in-person": "in person only",
    online: "online only",
  }[profile.mode]];
  if (profile.maxMiles !== null && profile.mode !== "online") {
    constraints.push(`up to ${profile.maxMiles} miles from the demo starting point for venue visits`);
  }
  if (profile.stepFree) constraints.push("step-free venue access");
  if (profile.clearance === "none") constraints.push("no safeguarding clearance");
  if (profile.clearance === "unknown") constraints.push("safeguarding clearance unconfirmed");
  const preferences = [];
  if (profile.individual) preferences.push("one-to-one support");
  if (profile.digital) preferences.push("using digital skills");
  const interests = preferences.length
    ? " I prioritised " + preferences.join(" and ") + "." : "";
  return "I checked " + constraints.join(", ") + "." + interests;
}

// Give the provider stable references into the volunteer's actual words.
// The same ordered excerpts are used in the request and to render its reply.
export function visitorExcerpts({history, message}) {
  return [...history.map(turn => turn.user), message].flatMap(text =>
    (text.match(/[^\p{Sentence_Terminal}\n]+\p{Sentence_Terminal}*/gu) || []).flatMap(sentence =>
      (sentence.match(/[\s\S]{1,175}(?:\s|$)|[\s\S]{1,175}/gu) || [])
        .map(chunk => chunk.trim()).filter(Boolean)));
}

const listExplanationQuestions = [
  /^why (?:this|that) (?:short)?list(?:[?.!\s]+reasons?)?$/iu,
  /^(?:please )?(?:(?:tell|give|show) me (?:your |the )?|explain (?:your |the )?)?reason(?:s|ing)?(?: (?:for|behind) (?:this|the) (?:short)?list)?$/iu,
  /^why(?: these| those| this| that)?(?: roles?| ones?)?(?: for me)?$|^why do these roles suit me$/iu,
  /^why (?:did you (?:choose|pick|recommend|suggest)|are|would) (?:these|those|this|that)(?: roles?| ones?)?(?: (?:for me|a good fit|suit me|good for me))?$/iu,
  /^(?:why|explain why)\b.{0,165}\b(?:exercise|recruitment)[ -](?:role|tag|label|task)/iu,
];

export function isListExplanation(message) {
  const text = message.trim().replace(/[?.!]+$/u, "").trim();
  return listExplanationQuestions.some(pattern => pattern.test(text));
}

// Scope switches and requests to explain a result are commands, not evidence of interests.
export function isSourceInstruction(text) {
  return /^(?:please )?(?:(?:switch|go|return) (?:back )?to|use|search|look (?:only )?at|(?:just )?focus on|back to|list|show)(?: (?:only|all|the|our|these|those|full|community|wider|original|supplied|matching|recruitment|exercise|seven|7|100|one hundred|roles?|records?|catalog(?:ue)?|pack|instead|again|from|in)){1,20}[.!?]*$/iu.test(text.trim());
}

export function checkedEvidence(plan, role, excerpts) {
  const item = plan.role_evidence.find(row => row.role_id === role.id);
  if (!item || !plan.candidate_ids.includes(role.id)) return null;
  const listingFields = {summary: role.summary, individualEvidence: role.caseFacts?.individualEvidence,
    digitalEvidence: role.caseFacts?.digitalEvidence, ...Object.fromEntries(role.tasks.map((task, i) => [`task_${i}`, task]))};
  const quote = listingFields[item.listing_source];
  if (typeof quote !== "string" || !quote.trim()) return null;
  const userQuote = Number.isInteger(item.visitor_source) ? excerpts[item.visitor_source] : null;
  const commandOnly = /^(?:(?:run|show|use|try|switch to)\s+)?case [ab]$/iu;
  const fromUser = typeof userQuote === "string" && userQuote.length > 1
    && !isSourceInstruction(userQuote) && !isListExplanation(userQuote)
    && !commandOnly.test(userQuote.trim().replace(/[?!.]+$/u, ""));
  // Model prose is allowed only as an explicitly subjective fit judgement.
  // Venue, clearance, numbers, availability and application facts come from
  // structured records and are rendered separately below.
  const reason = item.reason.trim();
  const forbidden = /[<>@\d£$€]|https?:|www\.|\b(?:miles?|hours?|weekdays?|weekends?|evenings?|daytime|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|dbs|clearance|safeguarding|eligible|eligibility|guarantee\w*|certif\w*|pay|paid|salary|booking|application|accessible|accessibility|step-free|unpaid|funding|transport|remote|onsite|venue|postcode)\b/iu;
  const personal = /^(?:You might enjoy|This could suit you|Your interest in)/iu.test(reason);
  return {sourceQuote: quote, userQuote: fromUser ? userQuote : null,
    reason: fromUser && personal && !forbidden.test(reason) ? reason : null};
}

export function explainEvidence(evidence) {
  if (!evidence) return "";
  const {sourceQuote, userQuote, reason} = evidence;
  return [reason, userQuote ? `You mentioned “${userQuote}”.` : "", `The listing says “${sourceQuote}”.`].filter(Boolean).join(" ");
}

export function lastDisplayedTurn(history) {
  return history.findLast(item => item.matches.length || item.toConfirm.length);
}

export function previousRoles(history) {
  const turn = lastDisplayedTurn(history);
  return turn ? [...turn.matches, ...turn.toConfirm] : [];
}

export function suggestedQuestion(plan) {
  const question = plan.follow_up.trim();
  return /\?$/u.test(question) && !/[<>]|https?:/iu.test(question) ? question : "";
}

export function communityAnswer(plan, roles, result, {message, history}) {
  const profile = plan.case_profile;
  const wantsDetails = ["explain", "detail"].includes(plan.intent);
  const preferenceOrder = new Map(plan.candidate_ids.map((id, index) => [id, index]));
  const excerpts = visitorExcerpts({message, history});
  const explicitTask = Number.isInteger(plan.required_activity_ref) && Boolean(excerpts[plan.required_activity_ref]);
  if (plan.required_activity_ref !== null && !explicitTask && !wantsDetails) {
    return {...result, caseProfile: profile, text: "Which specific activity would you like me to look for?"};
  }
  let candidates = roles;
  if (wantsDetails) {
    const previous = previousRoles(history);
    const ids = plan.candidate_ids.length ? plan.candidate_ids : previous;
    candidates = roles.filter(role => ids.includes(role.id)
      && (plan.intent !== "explain" || previous.includes(role.id)));
  } else if (explicitTask) {
    // A specific extra task must be supported by the visitor's words and an
    // actual listing excerpt. A strength (in any language) is a signal for
    // ranking, never an English keyword condition on the entire catalogue.
    candidates = roles.filter(role => preferenceOrder.has(role.id) && checkedEvidence(plan, role, excerpts));
  }
  if (plan.intent === "more") {
    const shown = new Set();
    for (const turn of [...history].reverse()) {
      if (!turn.matches.length && !turn.toConfirm.length) continue;
      for (const id of [...turn.matches, ...turn.toConfirm]) shown.add(id);
      if (!/(?:\bmore\b|\bother\b|\balternative|\bnext\b)/iu.test(turn.user)) break;
    }
    candidates = candidates.filter(role => !shown.has(role.id));
  }

  const ranked = matchCommunityCase(candidates, profile, {limit: Infinity});
  // Eligibility, confirmation status and strength of evidence take precedence.
  // For equally strong feasible alternatives OpenAI's semantic ranking can
  // personalise the shortlist. Unnominated alternatives retain the stable
  // order from the shared matcher. Never hide a stronger role by omission.
  const modelOrder = row => preferenceOrder.get(row.role.id) ?? roles.length;
  const withinTier = (a, b) => b.points - a.points || modelOrder(a) - modelOrder(b);
  for (const [group, rows] of [["matches", ranked.recommendations], ["toConfirm", ranked.pending]]) {
    for (const {role, fit, reasons} of rows.sort(withinTier).slice(0, 3)) {
      result[group].push(role.id);
      const evidence = checkedEvidence(plan, role, excerpts);
      if (evidence) result.evidence[role.id] = evidence;
      result.details[role.id] = [explainEvidence(evidence), role.summary, fit, ...reasons].filter(Boolean).join("\n");
    }
  }
  const intro = describeProfile(profile);
  let outcome = result.matches.length
    ? "The matching roles below meet the recorded requirements."
    : "I found no confirmed match for these conditions.";
  if (result.toConfirm.length) outcome += " The host needs to check the details under “To confirm”.";
  if (wantsDetails && ranked.excluded.length) {
    const {role, reasons} = ranked.excluded[0];
    outcome += " " + role.title + " — " + reasons[0];
  }
  return {...result, caseProfile: profile, text: plan.comparison ?? [intro, outcome, suggestedQuestion(plan)].filter(Boolean).join(" ")};
}
