import { matchOpportunities } from "./engine.js";
import {
  activityEvidence,
  inferActivity,
  topicTokens,
} from "./assistant-topics.js";

const blank = { query: "", time: "any", mode: "any", stepFree: false };
const units = {
  time: {
    weekday: "Weekdays",
    weekend: "Weekends",
    flexible: "Weekdays or weekends",
  },
  mode: {
    onsite: "At the venue",
    remote: "From home",
    hybrid: "At the venue or from home",
  },
};
const fieldName = {
  time: "the schedule",
  mode: "where you can take part",
  stepFree: "the step-free route",
};

function parseQuestion(question) {
  let rest = question
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/i'd/g, "i would")
    .replace(/i'm/g, "i am");
  const changes = {};
  const take = (pattern, key, value) => {
    if (!pattern.test(rest)) return false;
    rest = rest.replace(pattern, " ");
    changes[key] = value;
    return true;
  };
  if (
    !take(
      /\b(?:any (?:day|time)|flexible (?:days|schedule)|(?:weekdays? or weekends?)|weekdays? (?:or|and) weekends?|weekends? (?:or|and) weekdays?|either day|any day of the week)\b/g,
      "time",
      "any",
    )
  ) {
    if (!take(/\b(?:not|no|except) (?:on )?weekends?\b/g, "time", "weekday")) {
      take(/\bweekends?\b/g, "time", "weekend");
    }
    if (!take(/\b(?:not|no|except) (?:on )?weekdays?\b/g, "time", "weekend")) {
      take(/\b(?:weekdays?|during the week)\b/g, "time", "weekday");
    }
  }
  if (
    !take(
      /\b(?:either (?:location|setting)|any (?:location|setting)|(?:remote|from home) or (?:onsite|in person)|(?:onsite|in person) or (?:remote|from home))\b/g,
      "mode",
      "any",
    )
  ) {
    if (!take(/\b(?:not|no) (?:remote|from home)\b/g, "mode", "onsite")) {
      take(
        /\b(?:remotely|remote|(?:from|at) home|home[- ]based|online only|volunteer online)\b/g,
        "mode",
        "remote",
      );
    }
    take(
      /\b(?:on[- ]?site|in[- ]person|at (?:a|the) venue)\b/g,
      "mode",
      "onsite",
    );
  }
  if (
    !take(
      /\b(?:no longer (?:need|require)|(?:don't|do not) (?:need|require)) (?:a )?(?:step[- ]free|level)(?: (?:access|route|entrance))?\b/g,
      "stepFree",
      false,
    )
  ) {
    take(
      /\b(?:step[- ]free|level access|no stairs|no steps|without (?:stairs|steps)|(?:avoid|cannot (?:use|climb)|can't (?:use|climb)) (?:stairs|steps))(?: (?:venue )?(?:access|route|entrance))?\b/g,
      "stepFree",
      true,
    );
  }
  // On-device matching uses an English vocabulary. Unknown words in other scripts
  // must not disappear when the rest of a question is parsed for search filters.
  const unsupportedScript = /(?!\p{Script=Latin})\p{Letter}/u.test(rest);
  // Catalogue records cover broad weekday/weekend windows, mode and step-free access.
  // Other explicit restrictions need the host's input before recommendations are safe.
  const unverified =
    /\b(?:saturday|sunday|monday|tuesday|wednesday|thursday|friday|mornings?|evenings?|afternoons?|night|wheelchair|accessibility|accessible toilets?|parking|hearing loop|allerg(?:y|ies|ic)|under[- ]?\d+|age[sd]?|years? old|near me|within|miles?|kilometres?|paid|pay|salary|expenses|dbs|children|childcare|booking|vacanc(?:y|ies)|tomorrow|today)\b|\d[:.]\d{2}|\b\d+\s*(?:am|pm|hours?)\b/i.test(
      rest,
    );
  const negative =
    /\b(?:not|no|never|without|avoid|hate|cannot|can't|don't|cannot|except|dislike|allergic)\b/.test(
      rest,
    );
  return {
    changes,
    tokens: topicTokens(rest),
    unsupportedScript,
    unverified,
    negative,
  };
}

function roleDescription(role, issues) {
  const facts = [units.time[role.time], units.mode[role.mode]].filter(Boolean);
  if (role.time === "unknown")
    facts.push("Schedule unconfirmed");
  if (role.mode === "unknown")
    facts.push("Participation mode unconfirmed");
  if (role.mode !== "remote" && role.stepFree === "unknown")
    facts.push("Step-free route unconfirmed");
  if (role.mode !== "remote" && role.stepFree === "no")
    facts.push("Steps on the venue route");
  if (role.mode !== "remote" && role.stepFree === "yes")
    facts.push("Step-free venue route");
  const unknown = issues
    .map((i) => fieldName[i.field])
    .filter(Boolean)
    .join(" and ");
  const note = unknown && `Ask the host to confirm ${unknown}.`;
  return [role.summary, facts.length ? facts.join(" · ") + "." : "", note]
    .filter(Boolean)
    .join(" ");
}

/** Return grounded plain text and catalogue IDs. One turn contains at most three listings.
 * The caller owns per-session state. No searches or conversations leave the browser. */
export function answerVolunteerQuestion(message, roles, previousState = null) {
  const question = String(message ?? "").trim();
  const previous = { ...blank, ...previousState?.preferences };
  const state = {
    preferences: { ...previous },
    inferred: previousState?.inferred ?? null,
    blocked: Boolean(previousState?.blocked),
    offset: 0,
    shown: [],
  };
  function reply(text, matches = [], toConfirm = [], details = {}) {
    return { text, matches, toConfirm, details, state };
  }
  const prompt = "What would you like to do? Tell me an activity, or a preference such as weekends, working from home or step-free access.";
  if (!question || question.length > 600)
    return reply(
      question
        ? "Please ask one short volunteering question at a time (up to 600 characters)."
        : prompt,
    );
  const blockedMessage = "I can check the activity, weekday or weekend availability, participation mode and step-free access. I cannot verify that whole request from this catalogue. To search under different requirements, type “start over”.";
  if (
    /^(?:reset|start (?:again|over)|new search)[.!?]?$/i.test(
      question,
    )
  ) {
    state.preferences = { ...blank };
    state.blocked = false;
    state.inferred = null;
    return reply(prompt);
  }
  if (state.blocked) return reply(blockedMessage);
  if (
    /\b(?:apply|enrol|sign up|book me|reserve a place)\b/i.test(
      question,
    )
  )
    return reply(
      "These are fictional opportunities for exploring the demo. You can open or save a role here. Real applications would need to go through its host.",
    );
  const parsed = parseQuestion(question);
  if (parsed.negative || parsed.unsupportedScript || parsed.unverified) {
    // A later short follow-up must never silently remove an unresolved hard condition.
    state.blocked = true;
    return reply(blockedMessage);
  }
  const ordinal = /\b(first|second|third|last)\b/i.test(
    question,
  );
  const refersToRole =
    ordinal ||
    /\b(?:that|this|the) (?:one|role|listing)\b|\bit\b/i.test(
      question,
    );
  const asksDetail =
    /\b(?:what would i do|tell me more|tasks|details)\b/i.test(
      question,
    );
  const asksFact =
    /\b(?:first|second|third|last|what|where|when|tell|show|details|step[- ]free|access|weekends?|weekdays?|remote|in person|venue)\b/i.test(
      question,
    );
  const directFact =
    /^(?:is|are|does|do|when|where)\b/i.test(question) &&
    refersToRole &&
    asksFact;
  if (
    directFact ||
    (asksDetail &&
      (refersToRole ||
        /^(?:what would i do|tell me more|more details)[?.!]*$/i.test(
          question,
        ))) ||
    (ordinal && asksFact)
  ) {
    const shown = previousState?.shown ?? [];
    if (!shown.length)
      return reply(
        "Which activity would you like me to look for first?",
      );
    if (!ordinal && shown.length > 1) {
      state.shown = shown;
      state.offset = previousState.offset;
      return reply(
        "Which option would you like to hear about? Say “the first role” or “the second role”.",
      );
    }
    const index = /\bthird\b/i.test(question)
      ? 2
      : /\bsecond\b/i.test(question)
        ? 1
        : /\blast\b/i.test(question)
          ? shown.length - 1
          : 0;
    const role = roles.find((item) => item.id === shown[index]);
    state.shown = shown;
    state.offset = previousState.offset;
    if (!role)
      return reply(
        "That option is not among the listings I just showed.",
      );
    const result = matchOpportunities([role], { ...previous, query: "" });
    const entry = result.matches[0] || result.review[0];
    if (!entry)
      return reply(
        "This listing no longer meets the current requirements. Ask me to search again.",
      );
    const confirmed = result.matches.length > 0;
    return reply(
      `The listed tasks for ${role.title} are ${role.tasks.join(", ")}.`,
      confirmed ? [role.id] : [],
      confirmed ? [] : [role.id],
      { [role.id]: roleDescription(role, entry.issues) },
    );
  }
  const next =
    /^(?:(?:please |can (?:i (?:see|have)|you (?:show|suggest) (?:me )?) |show (?:me )?|give me )?(?:any |some )?(?:other|more|next|alternative|alternatives)(?: (?:roles|options|projects|matches|suggestions|opportunities))?)[?!.]*$/i.test(
      question,
    );
  if (next && !previousState?.shown?.length) return reply(prompt);
  if (next)
    state.offset = (previousState.offset || 0) + previousState.shown.length;
  else {
    const { changes, tokens } = parsed;
    Object.assign(state.preferences, changes);
    if (tokens.length) {
      state.inferred = inferActivity(tokens);
      state.preferences.query = state.inferred || tokens.join(" ");
    } else if (
      !Object.keys(changes).length &&
      !/\b(?:browse|anything|all roles|recommend|suggest|volunteer)\b/i.test(
        question,
      )
    )
      return reply(prompt);
    else if (!Object.keys(changes).length && !previousState?.shown?.length)
      return reply(prompt);
  }
  const searchRoles = roles.filter((role) => {
    if (!state.preferences.query) return true;
    const activity = [role.title, ...role.tasks, ...role.interests].join(" ");
    const evidence = activityEvidence[state.inferred];
    if (evidence) {
      const documented = ["dog", "cat"].includes(state.inferred)
        ? activity + " " + role.summary
        : activity;
      return evidence.every((pattern) => pattern.test(documented));
    }
    // Unknown topics stay literal. Do not let a common incidental word in a host
    // name promote an unsupported activity (for example, an astronomy club).
    const text = [
      activity,
      role.summary,
      ...role.interests,
      role.area,
      role.organisation,
    ]
      .join(" ")
      .toLowerCase();
    return state.preferences.query
      .split(" ")
      .every((token) => text.includes(token));
  });
  const result = matchOpportunities(searchRoles, state.preferences);
  const combined = [
    ...result.matches.map((entry) => ({ entry, review: false })),
    ...result.review.map((entry) => ({ entry, review: true })),
  ];
  const page = combined.slice(state.offset, state.offset + 3);
  if (!page.length)
    return reply(
      next
        ? "That was the last listed option for this search. Try a different activity or change a preference."
        : "I could not find a listed role for that request with the current preferences. Try another activity or change one of your filters.",
    );
  const matches = [],
    toConfirm = [],
    details = {};
  for (const { entry, review } of page) {
    const role = entry.opportunity;
    (review ? toConfirm : matches).push(role.id);
    state.shown.push(role.id);
    details[role.id] = roleDescription(role, entry.issues);
  }
  const lines = [];
  if (matches.length) lines.push("These roles fit the preferences I could check.");
  if (toConfirm.length)
    lines.push("The options marked “To confirm” need an answer from their host.");
  if (combined.length > state.offset + page.length)
    lines.push("Ask for more options to see the next listings.");
  return reply(lines.join(" "), matches, toConfirm, details);
}
