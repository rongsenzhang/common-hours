// Source fields, in the order supplied in the recruitment exercise.
// IDs are local identifiers. The activity tags below are our interpretations.
export const exerciseRoles = [
  {
    id: "digital-access-buddy",
    title: "Digital access buddy",
    activity: "Support adults individually to get online and use everyday services",
    whenWhere: "Wed evening · online",
    requirement: "None listed",
  },
  {
    id: "community-cafe-host",
    title: "Community café host",
    activity: "Welcome visitors and serve refreshments",
    whenWhere: "Tue daytime · 1 mile",
    requirement: "None listed",
  },
  {
    id: "youth-reading-mentor",
    title: "Youth reading mentor",
    activity: "Support young readers, one to one",
    whenWhere: "Thu evening · 2 miles",
    requirement: "Verified safeguarding clearance",
  },
  {
    id: "food-parcel-packer",
    title: "Food parcel packer",
    activity: "Pack parcels alongside a small team",
    whenWhere: "Tue evening · 2 miles",
    requirement: "None listed",
  },
  {
    id: "conversation-partner",
    title: "Conversation partner",
    activity: "Help adults practise English individually",
    whenWhere: "Mon evening · 5 miles",
    requirement: "None listed",
  },
  {
    id: "form-filling-volunteer",
    title: "Form-filling volunteer",
    activity: "Help people individually with online forms",
    whenWhere: "Thu evening · in person, distance not recorded",
    requirement: "None listed",
  },
  {
    id: "digital-skills-facilitator",
    title: "Digital skills facilitator",
    activity: "Lead a group session on smartphone basics",
    whenWhere: "Fri evening · 1 mile",
    requirement: "None listed",
  },
];

// Verbatim volunteer statements from the candidate exercise.
export const EXERCISE_CASE_TEXT = {
  A: "I’d like to help people one to one, ideally using the digital support skills I already have. I can only volunteer on weekday evenings. Online is fine, but I can’t travel more than three miles. I don’t know if my safeguarding clearance is valid for a new role.",
  B: "The same volunteer can no longer volunteer online. Everything else stays the same.",
};

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function exerciseProfile(caseId = "A") {
  if (caseId !== "A" && caseId !== "B") throw new RangeError("Unknown exercise case.");
  return {
    mode: caseId === "B" ? "in-person" : "either",
    days: days.slice(0, 5),
    period: "evening",
    maxMiles: 3,
    clearance: "unknown",
    individual: true,
    digital: true,
  };
}

// Additional wording probes for the reviewer and tests; none is an opportunity.
// The expected labels are recorded separately from the matcher's actual output.
export const exerciseLanguageExamples = [
  {text: "Help someone use their phone in a one-to-one session.", individual: true, digital: true},
  {text: "Sit with one person at a time to practise English.", individual: true, digital: false},
  {text: "Teach a group how to use a smartphone.", individual: false, digital: true},
  {text: "Welcome visitors and answer the phone at reception.", individual: false, digital: false},
  {text: "Group workshops only. No one-to-one support or help with online forms.", individual: false, digital: false},
  {text: "Give one-to-one support with reading, but do not help with online forms.", individual: true, digital: false},
];

// Return the exact supporting phrase so the interpretation can be inspected.
// Negation is local to a clause. Unrecognised phrasing supplies no evidence.
function affirmedPhrase(clause, pattern, precedingContext) {
  const match = pattern.exec(clause);
  if (!match) return null;
  const before = clause.slice(0, match.index);
  const after = clause.slice(match.index + match[0].length);
  if (precedingContext && !precedingContext.test(before)) return null;
  if (/\b(?:no|not|never|without|cannot|\w+n['’]t|rather than|instead of)\b/i.test(before)) return null;
  if (/^(?:\s+(?:help|work|sessions?|support|assistance))?\s+(?:is|are|will be)\s+(?:not|unavailable|excluded)\b/i.test(after)) return null;
  return match[0];
}

// Activity language is evidence of interests only. "Online forms" cannot set
// participation mode. Giving help with a device differs from merely using one.
export function exerciseEvidence(role) {
  const evidence = {individual: null, digital: null};
  const helping = /\b(?:help|support|teach|show|assist|guide|coach|tutor|mentor)\b/i;
  for (const clause of role.activity.split(/[.,;:!?]|\b(?:but|however|whereas)\b/i)) {
    evidence.individual ??= affirmedPhrase(clause, /\b(?:one[\s\-\u2010\u2011](?:to|on)[\s\-\u2010\u2011]one|one person at a time)\b/i);
    evidence.individual ??= affirmedPhrase(clause, /\bindividually\b/i, helping);
    evidence.digital ??= affirmedPhrase(clause,
      /\b(?:get online|(?:online|digital) forms?|forms? online|smartphone basics|use (?:a|their) (?:smartphone|phone|tablet))\b/i, helping);
    evidence.digital ??= affirmedPhrase(clause, /\bsmartphone basics\b/i, /\blead\b/i);
  }
  return evidence;
}

function validateProfile(profile) {
  if (!["either", "in-person", "online"].includes(profile.mode)
      || !["evening", "daytime", "any"].includes(profile.period)
      || !["none", "unknown", "verified"].includes(profile.clearance)
      || !Array.isArray(profile.days) || !profile.days.every(day => days.includes(day))
      || !Number.isFinite(profile.maxMiles) || profile.maxMiles < 0
      || typeof profile.individual !== "boolean" || typeof profile.digital !== "boolean") {
    throw new RangeError("Check the exercise inputs before matching.");
  }
}

// A known conflict makes the role unavailable even if another field needs a check.
// We only suggest a follow-up when resolving it could make the role feasible.
export function checkExerciseRequirements(role, profile, formFillingMiles = null) {
  const [schedule, location] = role.whenWhere.split(" · ");
  const [day, period] = schedule.split(" ");
  const online = location === "online";
  const conflicts = [];
  const checks = [];
  let distanceNote = null;
  if (!profile.days.includes(day) || (profile.period !== "any" && profile.period !== period)) {
    conflicts.push(`The listed time (${schedule}) is outside your availability.`);
  }
  if (online && profile.mode === "in-person") {
    conflicts.push("This role takes place online. You selected in-person volunteering only.");
  } else if (!online && profile.mode === "online") {
    conflicts.push("This role takes place in person. You selected online volunteering only.");
  } else if (!online) {
    const listedMiles = location.match(/^(\d+(?:\.\d+)?) miles?$/);
    const scenario = role.id === "form-filling-volunteer" && formFillingMiles !== null;
    const recordedDistance = listedMiles ? Number(listedMiles[1]) : null;
    const miles = scenario ? formFillingMiles : recordedDistance;
    if (miles === null) {
      checks.push(`Ask the host for the venue distance to check your ${profile.maxMiles}-mile limit. The record gives no distance.`);
    } else if (miles > profile.maxMiles) {
      const fact = scenario ? `The hypothetical venue distance is ${miles} miles` : `The venue is ${location} away`;
      conflicts.push(`${fact}, beyond your ${profile.maxMiles}-mile travel limit.`);
    } else if (scenario) {
      distanceNote = `The hypothetical venue distance is ${miles} miles, within your ${profile.maxMiles}-mile travel limit.`;
    }
  }
  const requirement = role.requirement?.trim() ?? "";
  if (/^(?:verified safeguarding clearance|safeguarding clearance must be verified)\.?$/i.test(requirement)) {
    if (profile.clearance === "none") {
      conflicts.push("This role requires verified safeguarding clearance and you selected no clearance.");
    } else if (profile.clearance === "unknown") {
      checks.push("Ask the coordinator to verify that your safeguarding clearance is valid for this role.");
    }
  } else if (!/^none listed\.?$/i.test(requirement)) {
    checks.push("Ask the coordinator to clarify the role’s requirement before recommending it.");
  }
  return {conflicts, checks, distanceNote};
}

// Each supported preference earns one point, regardless of repeated wording.
// "I’d like" and "ideally" are modelled as preferences in both presets.
function scorePreferences(role, profile) {
  const selected = Number(profile.individual) + Number(profile.digital);
  const evidence = exerciseEvidence(role);
  const reasons = [];
  const supported = [];
  if (profile.individual && evidence.individual) supported.push("one-to-one work");
  if (profile.digital && evidence.digital) supported.push("digital support");
  const points = supported.length;
  if (points) reasons.push("Fits your preference for " + supported.join(" and ") + ".");

  let fit = "Feasible";
  if (selected === 0) {
    reasons.push("Meets the stated requirements. No activity preferences are selected.");
  } else if (points === selected) {
    fit = "Strong fit";
  } else if (points === 0) {
    fit = "No stated interest match";
    reasons.push("Meets the stated requirements. The activity describes none of your selected interests.");
  } else {
    fit = "Partial fit";
    if (profile.individual && !evidence.individual) {
      reasons.push("Individual support is not listed.");
    } else {
      reasons.push("The listing does not mention digital support.");
    }
  }
  return {role, fit, points, reasons};
}

export function matchExercise(profile, {formFillingMiles = null} = {}) {
  validateProfile(profile);
  if (![null, 2, 5].includes(formFillingMiles)) {
    throw new RangeError("Choose the supplied unknown distance or a 2- or 5-mile scenario.");
  }
  const eligible = [];
  const pending = [];
  const excluded = [];
  for (const role of exerciseRoles) {
    const {conflicts, checks, distanceNote} = checkExerciseRequirements(role, profile, formFillingMiles);
    if (conflicts.length) {
      excluded.push({role, fit: null, points: null, reasons: conflicts});
    } else if (checks.length) {
      pending.push({role, fit: null, points: null, reasons: checks});
    } else {
      eligible.push({role, distanceNote});
    }
  }

  // Feasibility-only comparison uses the same volunteer input and the same gates.
  const baseline = eligible.slice(0, 3).map(({role}) => ({
    role, fit: "Feasible", points: null, reasons: ["Meets the stated requirements. Listed in source order."],
  }));
  // Stable sort preserves source order for tied scores, including no preferences.
  const ranked = eligible.map(({role, distanceNote}) => {
    const row = scorePreferences(role, profile);
    if (distanceNote) row.reasons.push(distanceNote);
    return row;
  }).sort((a, b) => b.points - a.points);
  const recommendations = ranked.filter(row => row.fit !== "No stated interest match").slice(0, 3);
  const other = ranked.filter(row => !recommendations.includes(row));
  return {recommendations, pending, excluded, other, baseline};
}
