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

// Only the listed activity supplies preference evidence. In particular, the
// words "online forms" describe an activity, not permission to work remotely.
export function exerciseEvidence(role) {
  return {
    individual: role.activity.match(/\b(?:individually|one to one)\b/i)?.[0] ?? null,
    digital: role.activity.match(/\b(?:get online|online forms|smartphone basics)\b/i)?.[0] ?? null,
  };
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
function checkRequirements(role, profile) {
  const [schedule, location] = role.whenWhere.split(" · ");
  const [day, period] = schedule.split(" ");
  const online = location === "online";
  const conflicts = [];
  const checks = [];
  if (!profile.days.includes(day) || (profile.period !== "any" && profile.period !== period)) {
    conflicts.push(`The listed time (${schedule}) is outside your availability.`);
  }
  if (online && profile.mode === "in-person") {
    conflicts.push("This role takes place online. You selected in-person volunteering only.");
  } else if (!online && profile.mode === "online") {
    conflicts.push("This role takes place in person. You selected online volunteering only.");
  } else if (!online) {
    const miles = location.match(/^(\d+(?:\.\d+)?) miles?$/);
    if (!miles) {
      checks.push(`Ask the host for the venue distance to check your ${profile.maxMiles}-mile limit. The record gives no distance.`);
    } else if (Number(miles[1]) > profile.maxMiles) {
      conflicts.push(`The venue is ${location} away, beyond your ${profile.maxMiles}-mile travel limit.`);
    }
  }
  if (role.requirement === "Verified safeguarding clearance") {
    if (profile.clearance === "none") {
      conflicts.push("This role requires verified safeguarding clearance and you selected no clearance.");
    } else if (profile.clearance === "unknown") {
      checks.push("Ask the coordinator to verify that your safeguarding clearance is valid for this role.");
    }
  }
  return {conflicts, checks};
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

export function matchExercise(profile) {
  validateProfile(profile);
  const eligible = [];
  const pending = [];
  const excluded = [];
  for (const role of exerciseRoles) {
    const {conflicts, checks} = checkRequirements(role, profile);
    if (conflicts.length) {
      excluded.push({role, fit: null, points: null, reasons: conflicts});
    } else if (checks.length) {
      pending.push({role, fit: null, points: null, reasons: checks});
    } else {
      eligible.push(role);
    }
  }

  // Feasibility-only comparison uses the same volunteer input and the same gates.
  const baseline = eligible.slice(0, 3).map(role => ({
    role, fit: "Feasible", points: null, reasons: ["Meets the stated requirements. Listed in source order."],
  }));
  // Stable sort preserves source order for tied scores, including no preferences.
  const ranked = eligible.map(role => scorePreferences(role, profile)).sort((a, b) => b.points - a.points);
  const recommendations = ranked.filter(row => row.fit !== "No stated interest match").slice(0, 3);
  const other = ranked.filter(row => !recommendations.includes(row));
  return {recommendations, pending, excluded, other, baseline};
}
