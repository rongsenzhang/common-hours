// OpenAI interprets the conversation. The same record checks used by Discover
// decide whether each suggested role qualifies or needs a host to confirm it.
import { matchOpportunities } from "../site/engine.js";
import { matchCommunityCase } from "../site/community-case.js";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const periods = ["any", "daytime", "evening"];
const modes = ["either", "in-person", "online"];
const clearances = ["unknown", "none", "verified"];
const choice = (values) => ({ type: "string", enum: values });

export function communityProfileSchema() {
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
  return { anyOf: [
    { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
    { type: "null" },
  ] };
}

export function validCommunityProfile(profile, known) {
  return profile && Array.isArray(profile.days) && profile.days.every(day => days.includes(day))
    && new Set(profile.days).size === profile.days.length
    && periods.includes(profile.period) && modes.includes(profile.mode)
    && (profile.maxMiles === null || (Number.isFinite(profile.maxMiles) && profile.maxMiles >= 0))
    && clearances.includes(profile.clearance)
    && (profile.verifiedRoleId === null || (profile.clearance === "verified" && known.has(profile.verifiedRoleId)))
    && ["individual", "digital", "stepFree"].every(key => typeof profile[key] === "boolean");
}

function describeProfile(profile, zh) {
  const say = (en, cn) => zh ? cn : en;
  const orderedDays = days.filter(day => profile.days.includes(day));
  let schedule = orderedDays.map(day => zh ? "周" + "一二三四五六日"[days.indexOf(day)] : day).join(zh ? "、" : ", ");
  if (orderedDays.length === 7) schedule = say("any day", "任何一天");
  if (!schedule) schedule = say("no available days", "暂时没有可参加的日期");
  if (orderedDays.join() === days.slice(0, 5).join()) schedule = say("weekdays", "工作日");
  if (orderedDays.join() === days.slice(5).join()) schedule = say("weekends", "周末");
  if (profile.period !== "any") {
    schedule += say(" in the " + profile.period, profile.period === "evening" ? "晚间" : "白天");
  }
  const constraints = [schedule, {
    either: say("online or in person", "远程或现场"),
    "in-person": say("in person only", "仅现场"),
    online: say("online only", "仅远程"),
  }[profile.mode]];
  if (profile.maxMiles !== null && profile.mode !== "online") {
    constraints.push(say(`up to ${profile.maxMiles} miles from the demo starting point for venue visits`,
      `从虚构起点到活动场地最多 ${profile.maxMiles} 英里`));
  }
  if (profile.stepFree) constraints.push(say("step-free venue access", "现场须有无台阶通道"));
  if (profile.clearance === "none") constraints.push(say("no safeguarding clearance", "尚无保护审查证明"));
  if (profile.clearance === "unknown") constraints.push(say("safeguarding clearance unconfirmed", "保护审查状态待核实"));
  const preferences = [];
  if (profile.individual) preferences.push(say("one-to-one support", "一对一支持"));
  if (profile.digital) preferences.push(say("using digital skills", "运用数字技能"));
  const interests = preferences.length
    ? say(" I prioritised " + preferences.join(" and ") + ".", " 我优先考虑" + preferences.join("与") + "。") : "";
  return say("I checked " + constraints.join(", ") + ".", "我采用的条件是：" + constraints.join("、") + "。") + interests;
}

export function checkedEvidence(plan, role, userMessages) {
  const item = plan.role_evidence.find(row => row.role_id === role.id);
  if (!item || !plan.candidate_ids.includes(role.id)) return "";
  const quote = item.quote.trim(), userQuote = item.user_quote.trim();
  const sources = [role.summary, ...role.tasks, role.caseFacts?.individualEvidence, role.caseFacts?.digitalEvidence];
  if (quote.length < 8 || !sources.some(source => source?.includes(quote))) return "";
  const fromUser = userQuote.length >= 2 && userMessages.some(source => source.includes(userQuote));
  if (plan.language === "zh") return fromUser
    ? `你提到“${userQuote}”。岗位说明中与此相符的内容是“${quote}”。`
    : `AI 从岗位说明中选出的依据是“${quote}”。`;
  return fromUser
    ? `You mentioned “${userQuote}”. The relevant part of the listing is “${quote}”.`
    : `The part of the listing I picked out for you is “${quote}”.`;
}

export function previousRoles(history) {
  const turn = [...history].reverse().find(item => item.matches.length || item.toConfirm.length);
  return turn ? [...turn.matches, ...turn.toConfirm] : [];
}

export function suggestedQuestion(plan) {
  const question = plan.follow_up.trim();
  return /[?？]$/u.test(question) && !/[<>]|https?:/iu.test(question) ? question : "";
}

export function communityAnswer(plan, roles, result, {message, history}) {
  const zh = plan.language === "zh";
  const say = (en, cn) => zh ? cn : en;
  const profile = plan.case_profile;
  const wantsDetails = ["explain", "detail"].includes(plan.intent);
  const preferenceOrder = new Map(plan.candidate_ids.map((id, index) => [id, index]));
  let candidates = roles;
  if (wantsDetails) {
    const previous = previousRoles(history);
    const ids = plan.candidate_ids.length ? plan.candidate_ids : previous;
    candidates = roles.filter(role => ids.includes(role.id)
      && (plan.intent !== "explain" || previous.includes(role.id)));
  } else if (plan.activity.trim()) {
    candidates = roles.filter(role => preferenceOrder.has(role.id));
    const topical = matchOpportunities(candidates, {query:plan.activity, time:"any", mode:"any", stepFree:false});
    candidates = [...topical.matches, ...topical.review].map(row => row.opportunity);
  }
  if (plan.intent === "more") {
    const shown = new Set();
    for (const turn of [...history].reverse()) {
      if (!turn.matches.length && !turn.toConfirm.length) continue;
      for (const id of [...turn.matches, ...turn.toConfirm]) shown.add(id);
      if (!/(?:\bmore\b|\bother\b|\balternative|\bnext\b|更多|其他|别的)/iu.test(turn.user)) break;
    }
    candidates = candidates.filter(role => !shown.has(role.id));
  }

  const ranked = matchCommunityCase(candidates, profile, {limit: Infinity});
  const userMessages = [message, ...history.map(turn => turn.user)];
  // Eligibility, confirmation status and strength of evidence take precedence.
  // For equally strong feasible alternatives OpenAI's semantic ranking can
  // personalise the shortlist. Unnominated alternatives retain the stable
  // order from the shared matcher. Never hide a stronger role by omission.
  const modelOrder = row => preferenceOrder.get(row.role.id) ?? roles.length;
  const withinTier = (a, b) => b.points - a.points || modelOrder(a) - modelOrder(b);
  for (const [group, rows] of [["matches", ranked.recommendations], ["toConfirm", ranked.pending]]) {
    for (const {role, fit, reasons} of rows.sort(withinTier).slice(0, 3)) {
      result[group].push(role.id);
      const evidence = checkedEvidence(plan, role, userMessages);
      result.details[role.id] = [evidence, role.summary, fit, ...reasons].filter(Boolean).join("\n");
    }
  }
  const intro = describeProfile(profile, zh);
  let outcome = result.matches.length
    ? say("The matching roles below meet the recorded requirements.", "下列匹配岗位符合已核实的条件。")
    : say("I found no confirmed match for these conditions.", "在这些条件下，没有找到已核实的匹配岗位。");
  if (result.toConfirm.length) outcome += say(" The host needs to check the details under “To confirm”.", " 请向主办方核实“待确认”中的条件。");
  if (wantsDetails && ranked.excluded.length) {
    const {role, reasons} = ranked.excluded[0];
    outcome += " " + role.title + " — " + reasons[0];
  }
  return {...result, caseProfile: profile, text: [intro, outcome, suggestedQuestion(plan)].filter(Boolean).join(" ")};
}
