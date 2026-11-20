import { matchOpportunities } from "./engine.js";
import {
  activityEvidence,
  inferActivity,
  topicTokens,
} from "./assistant-topics.js";

const blank = { query: "", time: "any", mode: "any", stepFree: false };
const chinese = /[\u3400-\u9fff]/;
const vocabulary = [
  [/遛狗|遛犬|带狗散步/g, " walk dogs "],
  [/宠物用品|动物用品/g, " animal supplies "],
  [/自行车维修|修自行车/g, " cycle repair "],
  [/园艺|种菜|种花|打理花园/g, " garden "],
  [/分拣种子|种子/g, " seed library "],
  [/捡垃圾|清理垃圾/g, " litter "],
  [/教阅读|陪读|阅读/g, " reading "],
  [/做饭|烹饪/g, " cooking "],
  [/食品包|食品银行/g, " groceries "],
  [/观鸟|数鸟/g, " birds "],
  [/字幕/g, " captions "],
  [/海报/g, " posters "],
  [/档案/g, " archive "],
  [/线上|远程|居家|在家/g, " remote "],
  [/现场|线下/g, " onsite "],
  [/工作日|平日/g, " weekdays "],
  [/周末|週末/g, " weekends "],
  [/无台阶(?:的)?(?:通道|路线|入口)?|免爬楼梯/g, " step-free access "],
  [/无障碍(?:的)?(?:通道|路线|入口)?/g, " accessibility "],
];
const units = {
  time: {
    weekday: ["Weekdays", "工作日"],
    weekend: ["Weekends", "周末"],
    flexible: ["Weekdays or weekends", "工作日或周末"],
  },
  mode: {
    onsite: ["At the venue", "现场"],
    remote: ["From home", "可在家参与"],
    hybrid: ["At the venue or from home", "现场或远程"],
  },
};
const fieldName = {
  time: ["the schedule", "时间"],
  mode: ["where you can take part", "参与地点"],
  stepFree: ["the step-free route", "无台阶通道"],
};

function parseQuestion(question) {
  let rest = question
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/i'd/g, "i would")
    .replace(/i'm/g, "i am");
  for (const [pattern, replacement] of vocabulary)
    rest = rest.replace(pattern, replacement);
  // Leave a detectable marker for unsupported Chinese activities and conditions.
  // Removing unknown text would silently turn a constrained request into a broad browse.
  rest = rest.replace(
    /第[一二三]个|最后一个|介绍|更多|其他|哪些|选项|选择|请问|麻烦|谢谢|你好|有没有|或者|请推荐|有推荐吗|能不能|可以|给我|帮我|我想|我需要|想要|需要|志愿者|志愿|活动|岗位|机会|推荐|哪些|什么|一下|工作|怎么样|比较|更好|要|我|在|有|能|吗|呢|的|只|和|做|找|想/g,
    " ",
  );
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
  const translatedUnknown = chinese.test(rest);
  // Catalogue records cover broad weekday/weekend windows, mode and step-free access.
  // Other explicit restrictions need the host's input before recommendations are safe.
  const unverified =
    /\b(?:saturday|sunday|monday|tuesday|wednesday|thursday|friday|mornings?|evenings?|afternoons?|night|wheelchair|accessibility|accessible toilets?|parking|hearing loop|allerg(?:y|ies|ic)|under[- ]?\d+|age[sd]?|years? old|near me|within|miles?|kilometres?|paid|pay|salary|expenses|dbs|children|childcare|booking|vacanc(?:y|ies)|tomorrow|today)\b|\d[:.]\d{2}|\b\d+\s*(?:am|pm|hours?)\b/i.test(
      rest,
    );
  const negative =
    /\b(?:not|no|never|without|avoid|hate|cannot|can't|don't|cannot|except|dislike|allergic)\b/.test(
      rest,
    ) || /不|别|不要|不能/.test(rest);
  return {
    changes,
    tokens: topicTokens(rest),
    translatedUnknown,
    unverified,
    negative,
  };
}

function roleDescription(role, issues, zh) {
  const position = zh ? 1 : 0;
  const facts = [
    units.time[role.time]?.[position],
    units.mode[role.mode]?.[position],
  ].filter(Boolean);
  if (role.time === "unknown")
    facts.push(zh ? "活动时间待确认" : "Schedule unconfirmed");
  if (role.mode === "unknown")
    facts.push(zh ? "参与地点待确认" : "Participation mode unconfirmed");
  if (role.mode !== "remote" && role.stepFree === "unknown")
    facts.push(zh ? "无台阶通道待确认" : "Step-free route unconfirmed");
  if (role.mode !== "remote" && role.stepFree === "no")
    facts.push(zh ? "路线有台阶" : "Steps on the venue route");
  if (role.mode !== "remote" && role.stepFree === "yes")
    facts.push(zh ? "无台阶通道已确认" : "Step-free venue route");
  const unknown = issues
    .map((i) => fieldName[i.field]?.[position])
    .filter(Boolean)
    .join(zh ? "、" : " and ");
  const note =
    unknown &&
    (zh ? `请向主办方确认${unknown}。` : `Ask the host to confirm ${unknown}.`);
  return [role.summary, facts.length ? facts.join(" · ") + "." : "", note]
    .filter(Boolean)
    .join(" ");
}

/** Return grounded plain text and catalogue IDs. One turn contains at most three listings.
 * The caller owns per-session state. No searches or conversations leave the browser. */
export function answerVolunteerQuestion(message, roles, previousState = null) {
  const question = String(message ?? "").trim();
  const zh = chinese.test(question);
  const say = (en, cn) => (zh ? cn : en);
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
  const prompt = say(
    "What would you like to do? Tell me an activity, or a preference such as weekends, working from home or step-free access.",
    "你想做什么活动？可以告诉我感兴趣的活动、时间、参与地点，或者是否需要无台阶通道。",
  );
  if (!question || question.length > 600)
    return reply(
      question
        ? say(
            "Please ask one short volunteering question at a time (up to 600 characters).",
            "请每次提一个不超过 600 字符的志愿活动问题。",
          )
        : prompt,
    );
  const blockedMessage = say(
    "I can check the activity, weekday or weekend availability, participation mode and step-free access. I cannot verify that whole request from this catalogue. To search under different requirements, type “start over”.",
    "此目录能核对活动类型、工作日或周末、参与地点和无台阶通道。刚才的要求无法全部核实。如需按另一组条件搜索，请输入“重新开始”。",
  );
  if (
    /^(?:reset|start (?:again|over)|new search|重新开始|重置)[.!？。]?$/i.test(
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
    /\b(?:apply|enrol|sign up|book me|reserve a place)\b|(?:怎么|如何|帮我)报名/i.test(
      question,
    )
  )
    return reply(
      say(
        "These are fictional opportunities for exploring the demo. You can open or save a role here. Real applications would need to go through its host.",
        "这些是演示用的虚构岗位。你可以查看、收藏岗位；实际报名需要联系真实机构。",
      ),
    );
  const parsed = parseQuestion(question);
  if (parsed.negative || parsed.translatedUnknown || parsed.unverified) {
    // A later short follow-up must never silently remove an unresolved hard condition.
    state.blocked = true;
    return reply(blockedMessage);
  }
  const ordinal = /\b(first|second|third|last)\b|第[一二三]个|最后一个/i.test(
    question,
  );
  const refersToRole =
    ordinal ||
    /\b(?:that|this|the) (?:one|role|listing)\b|\bit\b|这个岗位|那个岗位/i.test(
      question,
    );
  const asksDetail =
    /\b(?:what would i do|tell me more|tasks|details)\b|详细|介绍|具体做什么/i.test(
      question,
    );
  const asksFact =
    /\b(?:first|second|third|last|what|where|when|tell|show|details|step[- ]free|access|weekends?|weekdays?|remote|in person|venue)\b|时间|地点|无台阶|介绍|周末|工作日|现场|远程/i.test(
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
        say(
          "Which activity would you like me to look for first?",
          "请先说想寻找哪种活动。",
        ),
      );
    if (!ordinal && shown.length > 1) {
      state.shown = shown;
      state.offset = previousState.offset;
      return reply(
        say(
          "Which option would you like to hear about? Say “the first role” or “the second role”.",
          "你想了解哪个选项？可以说“第一个”或“第二个”。",
        ),
      );
    }
    const index = /\bthird\b|第三个/i.test(question)
      ? 2
      : /\bsecond\b|第二个/i.test(question)
        ? 1
        : /\blast\b|最后一个/i.test(question)
          ? shown.length - 1
          : 0;
    const role = roles.find((item) => item.id === shown[index]);
    state.shown = shown;
    state.offset = previousState.offset;
    if (!role)
      return reply(
        say(
          "That option is not among the listings I just showed.",
          "上一次的结果中没有这个选项。",
        ),
      );
    const result = matchOpportunities([role], { ...previous, query: "" });
    const entry = result.matches[0] || result.review[0];
    if (!entry)
      return reply(
        say(
          "This listing no longer meets the current requirements. Ask me to search again.",
          "此岗位目前不符合已设置的条件，请重新搜索。",
        ),
      );
    const confirmed = result.matches.length > 0;
    return reply(
      say("The listed tasks for ", "该岗位的工作内容（") +
        role.title +
        say(" are ", "）为：") +
        role.tasks.join(", ") +
        ".",
      confirmed ? [role.id] : [],
      confirmed ? [] : [role.id],
      { [role.id]: roleDescription(role, entry.issues, zh) },
    );
  }
  const next =
    /^(?:(?:please |can (?:i (?:see|have)|you (?:show|suggest) (?:me )?) |show (?:me )?|give me )?(?:any |some )?(?:other|more|next|alternative|alternatives)(?: (?:roles|options|projects|matches|suggestions|opportunities))?|还有别的吗|还有其他的吗|更多(?:选择|活动|岗位)?)[?!.？。]*$/i.test(
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
      !/\b(?:browse|anything|all roles|recommend|suggest|volunteer)\b|推荐|志愿/i.test(
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
        ? say(
            "That was the last listed option for this search. Try a different activity or change a preference.",
            "这些是本次搜索的所有选项。可以更换活动或调整条件。",
          )
        : say(
            "I could not find a listed role for that request with the current preferences. Try another activity or change one of your filters.",
            "目录中没有找到符合该请求和当前条件的岗位。可以换一种活动或调整条件。",
          ),
    );
  const matches = [],
    toConfirm = [],
    details = {};
  for (const { entry, review } of page) {
    const role = entry.opportunity;
    (review ? toConfirm : matches).push(role.id);
    state.shown.push(role.id);
    details[role.id] = roleDescription(role, entry.issues, zh);
  }
  const line =
    (matches.length
      ? say(
          "These roles fit the preferences I could check.",
          "这些岗位符合目录中可核实的搜索条件。",
        )
      : "") +
    (toConfirm.length
      ? (matches.length ? " " : "") +
        say(
          "The options marked “To confirm” need an answer from their host.",
          "“待确认”的岗位需要主办方核实相关信息。",
        )
      : "");
  const more =
    combined.length > state.offset + page.length
      ? say(
          " Ask for more options to see the next listings.",
          " 你还可以继续查看其他选项。",
        )
      : "";
  return reply(line + more, matches, toConfirm, details);
}
