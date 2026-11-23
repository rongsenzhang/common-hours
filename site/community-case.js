// Discover and the live assistant share this decision function. All facts come
// from the community listing. Distances are relative to the fictional case
// volunteer's starting point; no browser location or geocoding is involved.
export { suppliedExerciseCaseId as communityCaseId } from "./exercise-chat.js";

const week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdays = week.slice(0, 5);
const weekend = week.slice(5);

function checkTime(role, profile, confirmed, missing, conflicts) {
  if (!profile.days.length) {
    conflicts.push("There are no available days in the volunteer profile.");
    return;
  }
  const slots = role.caseFacts?.slots ?? [];
  if (slots.length) {
    const slot = slots.find(({day, period}) => profile.days.includes(day)
      && (profile.period === "any" || period === profile.period));
    if (slot) confirmed.push(`${slot.day} ${slot.period} fits the volunteer’s availability.`);
    else conflicts.push("None of the listed sessions fits the volunteer’s days and time of day.");
    return;
  }
  const possibleDays = role.time === "weekday" ? weekdays : role.time === "weekend" ? weekend : week;
  if (!possibleDays.some(day => profile.days.includes(day))) {
    conflicts.push("The published days are outside the volunteer’s availability.");
  } else if (profile.period !== "any" || !possibleDays.every(day => profile.days.includes(day))) {
    missing.push("Ask the host which day and time the session takes place.");
  }
}

function checkParticipation(role, profile, confirmed, missing, conflicts) {
  const remote = role.mode === "remote" || role.mode === "hybrid";
  const onsite = role.mode === "onsite" || role.mode === "hybrid";
  const knownMode = remote || onsite;
  if (profile.mode !== "in-person" && remote) {
    confirmed.push("The remote route is available and requires no travel.");
    return;
  }
  if (knownMode && ((profile.mode === "online" && !remote) || (profile.mode === "in-person" && !onsite))) {
    conflicts.push(profile.mode === "online" ? "Attendance is in person." : "This role is remote only.");
    return;
  }
  if (!knownMode && profile.mode !== "either") {
    missing.push(`Ask the host whether ${profile.mode === "online" ? "remote" : "in-person"} participation is available.`);
  }
  if (profile.mode === "online") return;

  const miles = role.caseFacts?.distanceMiles;
  // When the route is unknown, an out-of-range or inaccessible venue can
  // still leave a remote route to check for a volunteer who accepts either.
  const possibleRemote = !knownMode && profile.mode === "either";
  if (profile.maxMiles !== null) {
    if (!Number.isFinite(miles)) {
      missing.push(possibleRemote ? "Confirm a remote option or the venue distance."
        : "Confirm the distance from the volunteer’s starting point to the venue.");
    } else if (miles > profile.maxMiles) {
      if (possibleRemote) missing.push(`The venue is ${miles} miles away. Ask whether a remote route is available.`);
      else conflicts.push(`The venue is ${miles} miles away, beyond the ${profile.maxMiles}-mile limit.`);
    } else {
      confirmed.push(`The venue is ${miles} ${miles === 1 ? "mile" : "miles"} away, within the ${profile.maxMiles}-mile limit.`);
    }
  } else if (onsite) {
    confirmed.push("The host offers in-person participation.");
  }
  if (!profile.stepFree) return;
  if (role.stepFree === "yes") confirmed.push("The host lists a step-free venue route.");
  else if (role.stepFree === "no" && !possibleRemote) conflicts.push("The venue route includes steps.");
  else missing.push(possibleRemote ? "Confirm a remote option or a step-free venue route."
    : "Ask the host to confirm a step-free venue route.");
}

function evaluate(role, profile) {
  const facts = role.caseFacts ?? {};
  const confirmed = [], missing = [], conflicts = [];
  checkTime(role, profile, confirmed, missing, conflicts);
  checkParticipation(role, profile, confirmed, missing, conflicts);
  if (facts.clearance === "required") {
    if (profile.clearance === "none") {
      conflicts.push("The role requires safeguarding clearance and the volunteer has none.");
    } else if (profile.clearance !== "verified" || profile.verifiedRoleId !== role.id) {
      missing.push("Ask the coordinator to verify safeguarding clearance for this specific role.");
    } else {
      confirmed.push("Safeguarding clearance is confirmed for this role.");
    }
  } else if (facts.clearance === "none-listed") {
    confirmed.push("No safeguarding clearance requirement is listed.");
  } else {
    missing.push("Ask the host whether this role requires safeguarding clearance.");
  }
  const interests = [];
  if (profile.individual && facts.individualEvidence) interests.push(`One-to-one work (“${facts.individualEvidence}”).`);
  if (profile.digital && facts.digitalEvidence) interests.push(`Digital support (“${facts.digitalEvidence}”).`);
  const points = interests.length;
  const selected = Number(profile.individual) + Number(profile.digital);
  if (points > 0 && profile.individual && !facts.individualEvidence) interests.push("The listing gives no evidence of one-to-one work.");
  if (points > 0 && profile.digital && !facts.digitalEvidence) interests.push("The listing gives no evidence of digital support.");
  const reasons = [...interests, ...confirmed];
  let group, fit;
  if (conflicts.length) {
    group = "excluded"; fit = "Ruled out";
  } else if (selected && !points) {
    group = "other"; fit = "No stated interest match";
  } else if (missing.length) {
    group = "pending"; fit = "Needs confirmation";
  } else {
    group = "recommendations";
    fit = !selected ? "Feasible" : points === selected ? "Strong fit" : "Partial fit";
  }
  return {group, row: {role, points, fit, reasons: [...conflicts, ...missing, ...reasons]}};
}

export function matchCommunityCase(roles, profile, {limit = 3} = {}) {
  if (!Array.isArray(profile.days) || !profile.days.every(day => week.includes(day))
      || !["daytime", "evening", "any"].includes(profile.period)
      || !["online", "in-person", "either"].includes(profile.mode)
      || !(profile.maxMiles === null || (Number.isFinite(profile.maxMiles) && profile.maxMiles >= 0))
      || !["none", "unknown", "verified"].includes(profile.clearance)
      || typeof profile.individual !== "boolean" || typeof profile.digital !== "boolean") {
    throw new RangeError("Check the volunteer’s community matching conditions.");
  }
  const result = {recommendations: [], pending: [], excluded: [], other: []};
  for (const role of roles) {
    const {group, row} = evaluate(role, profile);
    result[group].push(row);
  }
  const compare = (a, b) => b.points - a.points || a.role.title.localeCompare(b.role.title, "en")
    || a.role.id.localeCompare(b.role.id, "en");
  result.recommendations.sort(compare);
  result.pending.sort(compare);
  if (limit !== Infinity) result.other.push(...result.recommendations.splice(limit));
  return result;
}
