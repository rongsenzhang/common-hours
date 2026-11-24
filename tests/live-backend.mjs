import test from "node:test";
import assert from "node:assert/strict";
import { exerciseProfile, exerciseRoles, EXERCISE_CASE_TEXT } from "../site/exercise-engine.js";
import { matchCommunityCase } from "../site/community-case.js";
import { readFileSync } from "node:fs";
import {
  answerLive,
  DEFAULT_MODEL,
  LiveError,
  validateTurn,
} from "../server/live.mjs";

const roles = JSON.parse(
  readFileSync(new URL("../site/data/catalog.json", import.meta.url)),
).opportunities;
const basePlan = {
  intent: "search",
  case_profile: null,
  changed_fields: null,
  required_activity_ref: null,
  role_evidence: [],
  follow_up: "",
  language: "en",
  activity: "walk dogs",
  time: "weekend",
  mode: "any",
  step_free: false,
  candidate_ids: [
    "shelter-dog-walker",
    "neighbourhood-dog-walker",
    "river-walk",
  ],
  reply: "",
};
const sentinel = "unit-test-only-token";
function completed(plan, model = DEFAULT_MODEL) {
  return new Response(
    JSON.stringify({
      model,
      status: "completed",
      output: [
        { type: "reasoning" },
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: JSON.stringify(plan) }],
        },
      ],
    }),
  );
}
function run(message, extras = {}, input = {}) {
  return answerLive({
    message,
    history: [],
    roles,
    apiKey: sentinel,
    fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body);
      if (body.text.format.name === "common_hours_explanation") {
        const payload = JSON.parse(body.input);
        const explanations = Object.fromEntries(Object.keys(payload.roles).map(id => {
          const selected = extras.role_evidence?.find(row => row.role_id === id);
          const visitor = payload.volunteer_statements.find(row => row.index === selected?.visitor_source) ?? payload.volunteer_statements[0];
          return [id, {listing_source: selected?.listing_source || "summary",
            visitor_source: visitor ? String(visitor.index) : null, reason: selected?.reason || ""}];
        }));
        return completed({language:extras.language ?? "en", explanations});
      }
      if (body.text.format.name === "common_hours_host_time_question") {
        return completed({language:extras.language ?? "en",host_question:"Could you confirm the exact time?"});
      }
      return completed({ ...basePlan, ...extras });
    },
    ...input,
  });
}

test("one new provider call per turn; browser and private fields do not enter the prompt", async () => {
  const calls = [];
  const history = [
    {
      user: "Can I walk dogs?",
      text: "Here are the listed roles.",
      matches: ["shelter-dog-walker", "neighbourhood-dog-walker"],
      toConfirm: [],
      internalNote: "NOT_PUBLIC",
    },
  ];
  const fetchImpl = async (url, req) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(req.headers.Authorization, "Bearer " + sentinel);
    assert.equal(req.redirect, "manual");
    const body = JSON.parse(req.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.model, DEFAULT_MODEL);
    assert.equal(body.max_output_tokens, undefined);
    assert.equal(body.reasoning, undefined);
    assert(!req.body.includes(sentinel));
    assert(!req.body.includes("NOT_PUBLIC"));
    assert(!req.body.includes("sessions.csv"));
    assert.equal(
      JSON.parse(body.input).recent_turns[0].matches[0],
      "shelter-dog-walker",
    );
    calls.push(body.input);
    return completed({ ...basePlan, time: "weekday" });
  };
  const opts = { history, roles, apiKey: sentinel, fetchImpl };
  const reply = await answerLive({ ...opts, message: "What about weekdays?" });
  await answerLive({ ...opts, message: "Can I change to weekdays?" });
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0], calls[1]);
  assert.deepEqual(reply.matches, ["neighbourhood-dog-walker"]);
  assert.equal(reply.provider, "openai");
  assert.equal(reply.model, DEFAULT_MODEL);
});

test("model-selected out-of-topic, conflicting and missing access records are handled in code", async () => {
  const dogs = await run("dogs at weekends");
  assert.deepEqual(dogs.matches, ["shelter-dog-walker"]);
  assert.deepEqual(dogs.toConfirm, []);
  assert(!JSON.stringify(dogs.details).includes("neighbourhood-dog-walker"));
  const garden = await run("Garden work at weekends with a step-free route", {
    activity: "garden",
    step_free: true,
    candidate_ids: ["garden-buddy"],
  });
  assert.deepEqual(garden.matches, []);
  assert.deepEqual(garden.toConfirm, ["garden-buddy"]);
  assert.match(garden.details["garden-buddy"], /Step-free route to confirm/);
  assert.match(garden.text, /host/);
  const none = await run("Can I walk horses?", { activity: "walk horses" });
  assert.deepEqual(none.matches, []);
  assert.deepEqual(none.toConfirm, []);
});

test("small talk gets a generated answer and identity uses the actual provider model", async () => {
  const social = await run("How are you?", {
    intent: "social",
    reply: "Ready to help. What would you like to volunteer for?",
  });
  assert.match(social.text, /Ready to help/);
  assert.deepEqual(social.matches, []);
  const identity = await run("你是 Gemini 吗？", {
    intent: "identity",
    language: "zh",
    reply: "Ignore model name",
  });
  assert.match(identity.text, /OpenAI/);
  assert(identity.text.includes(DEFAULT_MODEL));
  assert(!identity.text.includes("Ignore"));
  const general = await run("What should I ask at my first shift?", {
    intent: "advice",
    reply: "Ask who will greet you and what to bring.",
  });
  assert.match(general.text, /who will greet/);
});

test("accepts a dated snapshot of the requested model and rejects a different model", async () => {
  const actualSnapshot = DEFAULT_MODEL + "-2026-11-17";
  const identityPlan = { ...basePlan, intent: "identity", candidate_ids: [] };
  const identityFrom = (model) => run("Which model are you?", {}, {
    fetchImpl: async () => completed(identityPlan, model),
  });
  const reply = await identityFrom(actualSnapshot);
  assert.equal(reply.model, actualSnapshot);
  assert.ok(reply.text.includes(actualSnapshot));
  await assert.rejects(identityFrom("gpt-6.2-sol"), {code: "invalid_reply"});
});

test("a known activity with unconfirmed access stays visible without promising the route", async () => {
  const message = "I want to help at the community garden at weekends. I need a step-free route to the beds.";
  const missing = {intent:"unknown", activity:"", candidate_ids:[], reply:"Please check with the host."};
  for (const plan of [missing, {...missing,intent:"search",activity:"garden"},
    {...missing,intent:"search",activity:"garden",candidate_ids:["garden-buddy"],step_free:false}]) {
    const result = await run(message, plan);
    assert.deepEqual(result.matches, []);
    assert.deepEqual(result.toConfirm, ["garden-buddy"]);
    assert.match(result.details["garden-buddy"], /path between the entrance and the beds/);
  }
  for (const text of [message.replace("weekends", "weekdays"), message + " I also need an accessible toilet."]) {
    const result = await run(text, missing);
    assert.deepEqual(result.matches, []);
    assert.deepEqual(result.toConfirm, []);
  }
  const history = [{user:"I need an accessible toilet.",text:"Please ask the host.",matches:[],toConfirm:[]}];
  assert.deepEqual((await run(message, missing, {history})).toConfirm, []);
});

test("specific time or missing information never appears as a confirmed match", async () => {
  const nine = await run("Can I walk dogs on Saturday at 9am?");
  assert(!nine.matches.length && !nine.toConfirm.length);
  assert.match(nine.text, /exact day or time/);
  const zh = await run("我周日上午九点想遛狗。", { language: "zh" });
  assert.deepEqual(zh.matches, []);
  assert.match(zh.text, /具体日期/);
  const unknown = await run("Is there a toilet with wheelchair access?", {
    intent: "unknown",
    reply:
      "Please ask the host about the toilet layout. The listing does not specify it.",
  });
  assert.deepEqual(unknown.matches, []);
  assert.match(unknown.text, /toilet layout/);
});

test("details and subsequent results come from the relevant real catalogue IDs", async () => {
  const first = await run("Tell me about that shelter role", {
    intent: "detail",
    candidate_ids: ["shelter-dog-walker"],
  });
  assert.match(first.text, /Walk dogs in pairs/);
  const blocked = await run("Can I do the shelter role remotely?", {
    intent: "detail",
    mode: "remote",
    candidate_ids: ["shelter-dog-walker"],
  });
  assert.deepEqual(blocked.matches, []);
  assert.match(blocked.text, /At the venue/);
  const more = await run(
    "Show more options",
    { intent: "more", time: "any" },
    {
      history: [
        {
          user: "Can I walk dogs?",
          text: "Here are your options.",
          matches: ["shelter-dog-walker"],
          toConfirm: [],
        },
      ],
    },
  );
  assert.deepEqual(more.matches, ["neighbourhood-dog-walker"]);
});

test("invalid and oversized client requests are rejected before provider calls", async () => {
  const calls = { n: 0 };
  const fetchImpl = async () => {
    calls.n++;
    return completed(basePlan);
  };
  await assert.rejects(
    run(" ".repeat(601), {}, { fetchImpl }),
    (e) => e.code === "invalid_request" && e.status === 400,
  );
  assert.throws(
    () =>
      validateTurn(
        {
          message: "x",
          history: [{ user: "u", text: "x", matches: ["invented"] }],
        },
        roles,
      ),
    LiveError,
  );
  assert.throws(
    () =>
      validateTurn(
        { message: "x", history: Array(9).fill({ user: "u", text: "a" }) },
        roles,
      ),
    LiveError,
  );
  assert.equal(calls.n, 0);
});

test("provider failures and malformed replies never leak provider body or invented listings", async () => {
  const key = "injected upstream error";
  await assert.rejects(
    run(
      "help",
      {},
      { fetchImpl: async () => new Response(key, { status: 401 }) },
    ),
    (err) => err.status === 503 && !err.message.includes(key),
  );
  await assert.rejects(
    run(
      "help",
      {},
      { fetchImpl: async () => new Response(key, { status: 429 }) },
    ),
    (err) => err.status === 429,
  );
  await assert.rejects(
    run("help", { candidate_ids: ["invented"] }),
    (err) => err.code === "invalid_reply",
  );
  await assert.rejects(
    run("help", { time: "later" }),
    (err) => err.code === "invalid_reply",
  );
  await assert.rejects(
    run("help", { intent: "social", reply: "" }),
    (err) => err.code === "invalid_reply",
  );
});

const profile = id => ({...exerciseProfile(id), verifiedRoleId: null, stepFree: false});
test("provider interpretation ranks equally strong community listings, while hard constraints, tiers and quotes come from server data", async () => {
  const user = EXERCISE_CASE_TEXT.A;
  const extra = {
    intent: "case_search", activity: "", case_profile: profile("A"),
    // Attempt to promote a partially relevant role, and change the ranking of real peers.
    candidate_ids: ["writing-partner", "video-call-coach", "bus-app-coach", "email-practice-partner"],
    role_evidence: [
      {role_id: "video-call-coach", listing_source: "digitalEvidence", visitor_source: 0, reason: "You might enjoy showing a learner how to make a practice call."},
      {role_id: "bus-app-coach", listing_source: "task_9", visitor_source: 0, reason: "You might enjoy showing a learner how to make a practice call."},
      {role_id: "email-practice-partner", listing_source: "digitalEvidence", visitor_source: 99, reason: "You might enjoy this task."},
    ],
  };
  const a = await run(user, extra);
  assert.deepEqual(a.matches, ["video-call-coach", "bus-app-coach", "email-practice-partner"]);
  assert.match(a.evidence["video-call-coach"].userQuote, /digital support skills/);
  assert.equal(a.evidence["bus-app-coach"], undefined);
  assert.equal(a.evidence["email-practice-partner"].userQuote, null);
  assert(!JSON.stringify(a).includes("guarantees a permanent job"));
  assert(!JSON.stringify(a).includes("absolute favourite"));
  assert(a.toConfirm.includes("photo-transfer-tutor"));
  const b = await run(EXERCISE_CASE_TEXT.B, {...extra, case_profile: profile("B")});
  assert.equal(b.matches[0], "bus-app-coach");
  assert(!b.matches.includes("email-practice-partner") && !b.matches.includes("video-call-coach"));
  assert.equal(b.caseProfile.mode, "in-person");
  const available = matchCommunityCase(roles, profile("B"), {limit:Infinity});
  assert(b.matches.every(id => available.recommendations.some(row => row.role.id === id)));
  assert(b.toConfirm.every(id => available.pending.some(row => row.role.id === id)));
  const unknown = await run("weekday evenings, in person", {...extra, case_profile: profile("B"),
    candidate_ids:["photo-transfer-tutor", "junior-coding-mentor"]});
  assert(!unknown.matches.some(id => unknown.toConfirm.includes(id)));
  assert.match(unknown.details["photo-transfer-tutor"], /distance/i);
});

test("case explanation is limited to previously displayed roles, source quotations and actual volunteer words", async () => {
  const volunteer = "I can help people learn to use their phones on weekday evenings.";
  const history = [{user: volunteer,text:"You could help with journey planning.", matches:["bus-app-coach"],toConfirm:[]}];
  const explanation = await run("Why this one?", {
    intent:"explain", activity:"", case_profile:profile("B"),
    candidate_ids:["bus-app-coach", "writing-partner"],
    role_evidence:[{role_id:"bus-app-coach",listing_source:"digitalEvidence",visitor_source:0, reason:"This could suit you because you can practise journey planning together."}],
  }, {history});
  assert.deepEqual(explanation.matches, ["bus-app-coach"]);
  assert.match(explanation.details["bus-app-coach"], /learn to use their phones/);
  assert.match(explanation.details["bus-app-coach"], /teach journey planning on a travel app/);
  assert(!JSON.stringify(explanation).includes("writing-partner"));
  const explore = await run("I don't know how to help", {intent:"explore", reply:"What do people ask you for help with?"});
  assert.match(explore.text, /people ask/);
  assert.deepEqual(explore.matches, []);
});

test("invalid case fields reject the upstream response and exact clock time stays unresolved", async () => {
  for (const bad of [{...profile("A"), days:["Mon","Mon"]}, {...profile("B"),maxMiles:-1},
    {...profile("B"),mode:"onsite"}, {...profile("B"),verifiedRoleId:"made-up"}, null]) {
    await assert.rejects(run("Case B", {intent:"case_search",case_profile:bad}), {code:"invalid_reply"});
  }
  const time = await run("I can only do 6:30pm", {intent:"case_search",activity:"",case_profile:profile("A")});
  assert.deepEqual(time.matches, []);
  assert.match(time.text, /exact day or time/);
});

test("OpenAI chooses which preferences change; the other profile fields survive follow-ups and casual conversation", async () => {
  const history = [
    {user:"Run Case B", text:"Three miles, in person.", matches:["bus-app-coach"], toConfirm:[],
      caseProfile: {...profile("B"), internalNote:"NOT_PUBLIC"}},
    {user:"thanks",text:"You're welcome.",matches:[],toConfirm:[]},
  ];
  const proposed = {...profile("A"),days:["Sat"],maxMiles:5,individual:false};
  const fetchImpl = async (_url, req) => {
    const sent = JSON.parse(JSON.parse(req.body).input);
    assert.deepEqual(sent.active_profile, profile("B"));
    assert(!req.body.includes("NOT_PUBLIC"));
    return completed({...basePlan,activity:"",intent:"case_search",case_profile:proposed,changed_fields:["maxMiles"]});
  };
  const revised = await run("I can get to a venue five miles away now.", {}, {history,fetchImpl});
  assert.deepEqual(revised.caseProfile,{...profile("B"),maxMiles:5});
  assert.throws(() => validateTurn({message:"Case A",history:[{...history[0],caseProfile:{...profile("A"),mode:"invalid"}}]},roles), LiveError);
  await assert.rejects(run("Five miles", {intent:"case_search",case_profile:proposed,changed_fields:["invented"]}),{code:"invalid_reply"});
});

test("bilingual volunteered strengths rank across the catalogue; a required extra activity must cite the visitor and record", async () => {
  const user = "我喜欢用手机帮助别人，而且我只能在工作日晚上线上参加。";
  const state = {...profile("A"),mode:"online",maxMiles:null};
  const skill = {intent:"case_search", activity:"手机指导",language:"zh",case_profile:state,
    candidate_ids:["video-call-coach"], role_evidence:[{role_id:"video-call-coach",listing_source:"digitalEvidence",
      visitor_source:0,reason:"你可能会喜欢陪初学者练习如何开始一次视频通话。"}]};
  const matches = await run(user,skill);
  assert(matches.matches.includes("video-call-coach") && matches.matches.includes("email-practice-partner"));
  assert(matches.details["video-call-coach"].includes(skill.role_evidence[0].reason));
  const visitor = "我只想帮人练习视频通话";
  const must = await run(visitor,{...skill,required_activity_ref:0,candidate_ids:["video-call-coach","email-practice-partner"],
    role_evidence:[{...skill.role_evidence[0],visitor_source:0,reason:"你可能会获得时薪 100 英镑。"}]});
  assert.deepEqual(must.matches,["video-call-coach"]);
  assert.equal(must.evidence["video-call-coach"].reason,null);
  const fabricated = await run(user,{...skill,role_evidence:[{
    ...skill.role_evidence[0],listing_source:"task_7",visitor_source:22}]});
  assert.equal(fabricated.evidence["video-call-coach"],undefined);
});

test("bare why in either language is read-only even when the provider guessed a new search", async () => {
  const initial = profile("B");
  const history=[{user:EXERCISE_CASE_TEXT.A,text:"Here are the roles.",caseProfile:initial,matches:["bus-app-coach"],toConfirm:[]}];
  for (const question of ["Why these?", "为什么推荐这些岗位？"]) {
    const reply=await run(question,{intent:"case_search",case_profile:{...profile("A"),days:["Sat"]},changed_fields:["days","mode"],
      candidate_ids:["bus-app-coach","video-call-coach"],activity:""}, {history});
    assert.deepEqual(reply.caseProfile,initial);
    assert.deepEqual(reply.matches,["bus-app-coach"]);
  }
});

test("a precise time gets a real upstream question and remains unresolved on refinements until released", async () => {
  const message = "I can only start at exactly 6:35pm. Which role guarantees that?";
  let requests = 0;
  const first = await run(message, {}, {fetchImpl:async (_url, req) => {
    requests++;
    const body=JSON.parse(req.body);
    assert.equal(body.text.format.name,"common_hours_host_time_question");
    assert.equal(JSON.parse(body.input).clock,"6:35pm");
    return completed({language:"en",host_question:"Could I start at 6:35pm?"});
  }});
  assert.equal(requests,1); assert.deepEqual(first.matches,[]); assert.match(first.text,/6:35pm/);
  const history=[{user:message,text:first.text,matches:[],toConfirm:[]}];
  const next=await run("Any home-based options?",{intent:"unknown",case_profile:profile("A"),reply:""}, {history});
  assert.deepEqual(next.matches,[]); assert.match(next.text,/6:35pm/);
  const reset=await run("Any start time works. Can I walk dogs at weekends?",{}, {history});
  assert.deepEqual(reset.matches,["shelter-dog-walker"]);
  await assert.rejects(run(message,{}, {fetchImpl:async()=>new Response("",{status:503})}),{code:"provider_unavailable"});
  await assert.rejects(run(message,{}, {fetchImpl:async()=>completed({language:"en"})}),{code:"invalid_reply"});
});

test("a preset name isn't presented as personal evidence about the volunteer", async () => {
  const history = [{user:"Case A",text:"Case conditions recorded.",caseProfile:profile("A"),matches:["email-practice-partner"],toConfirm:[]}];
  const why = await run("Why these?",{intent:"explain",case_profile:profile("A"),activity:"",candidate_ids:["email-practice-partner"],
    role_evidence:[{role_id:"email-practice-partner", listing_source:"digitalEvidence", visitor_source:0, reason:"You might enjoy explaining email."}]},{history});
  const evidence=why.evidence["email-practice-partner"];
  assert(evidence.sourceQuote && evidence.userQuote === null && evidence.reason === null);
  assert(!why.details["email-practice-partner"].includes("You mentioned"));
});

test("a clear weekday-evening request narrows broad AI availability in either language", async () => {
  const proposed = {...profile("A"), days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], period:"any", mode:"either"};
  for (const text of [
    "I like helping one person at a time learn to use a phone. I can only volunteer online on weekday evenings.",
    "朋友经常叫我教他们用手机。我喜欢一次帮一个人，而且我只能在工作日晚上线上参加。",
  ]) {
    const answer = await run(text,{intent:"case_search", activity:"", case_profile:proposed});
    assert.deepEqual(answer.caseProfile.days, profile("A").days);
    assert.equal(answer.caseProfile.period, "evening");
    assert.equal(answer.caseProfile.mode, "online");
  }
  const alternatives = await run("I can volunteer on weekday evenings or weekend mornings.",
    {intent:"case_search",activity:"",case_profile:proposed});
  assert.deepEqual(alternatives.caseProfile.days,proposed.days);
  const named = await run("Case B",{intent:"case_search", activity:"", case_profile:proposed});
  assert.deepEqual(named.caseProfile,profile("B"));
});

test("a why request asks the model for evidence for each displayed role without re-ranking or re-quoting the question", async () => {
  const user = "I enjoy helping one person learn to make video calls.";
  const history=[{user,text:"Two possible roles.",caseProfile:profile("A"),matches:["video-call-coach","email-practice-partner"],toConfirm:[]}];
  const reply = await run("Why did you choose these for me?",{}, {history,fetchImpl:async (_url, request) => {
    const body=JSON.parse(request.body);
    assert.equal(body.text.format.name,"common_hours_explanation");
    const schema=body.text.format.schema.properties.explanations;
    assert.deepEqual(schema.required,history[0].matches);
    const input=JSON.parse(body.input);
    assert.deepEqual(input.volunteer_statements,[{index:0,text:user}]);
    assert.deepEqual(Object.keys(input.roles),history[0].matches);
    return completed({language:"en",explanations:Object.fromEntries(schema.required.map(id=>[id,{
      listing_source:"digitalEvidence",visitor_source:"0",reason:"This could suit you because you enjoy helping a learner practise."
    }]))});
  }});
  assert.deepEqual(reply.caseProfile,profile("A"));
  assert.deepEqual(reply.matches,history[0].matches);
  for(const id of reply.matches) assert.equal(reply.evidence[id].userQuote,user);
});

test("a volunteer describing a session window gets a required profile from the real request schema", async () => {
  for (const message of ["I enjoy helping someone with a phone. I can only volunteer online on weekday evenings.",
    "朋友叫我教他们用手机。我只能在工作日晚上线上参加。"]) {
    const reply = await run(message,{}, {fetchImpl:async (_url, request) => {
      const schema=JSON.parse(request.body).text.format.schema;
      assert.equal(schema.properties.case_profile.type, "object");
      assert(!schema.properties.intent.enum.includes("search"));
      return completed({...basePlan,activity:"", intent:"case_search",case_profile:{...profile("A"),maxMiles:null}});
    }});
    assert.equal(reply.caseProfile.mode,"online");
    assert.deepEqual(reply.caseProfile.days,profile("A").days);
  }
});


const packTurn = (message, history, action, {language = "en", role_id = null} = {}) => run(message, {}, {
  history, fetchImpl:async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.text.format.name, "common_hours_exercise_source");
    const input = JSON.parse(body.input);
    assert.deepEqual(input.records, exerciseRoles);
    assert.equal(input.catalogue_sources.community.count, roles.length);
    assert.ok(!input.catalogue);
    return completed({action,language,role_id});
  },
});
const historyItem = (user, {text,matches,toConfirm,caseProfile,source}) =>
  ({user,text,matches,toConfirm,caseProfile,source});

test("both supplied cases use the same seven records on request, keep pending reasons, and switch back to the wider catalogue", async () => {
  const caseA = await run(EXERCISE_CASE_TEXT.A, {intent:"case_search",activity:"",case_profile:profile("A")});
  const saved = [historyItem(EXERCISE_CASE_TEXT.A,caseA)];
  for (const question of ["Just focus on seven role matching exercise?", "Use only the seven roles from the matching exercise.", "只看招聘方原题七个岗位"]) {
    const a = await packTurn(question,saved,"shortlist");
    assert.equal(a.source,"exercise");
    assert.deepEqual(a.matches,[]);
    assert.deepEqual(a.toConfirm,[]);
    assert.deepEqual(a.caseProfile,profile("A"));
    assert.match(a.text,/Shortlist:[\s\S]*Digital access buddy[\s\S]*Digital skills facilitator[\s\S]*To confirm:[\s\S]*Youth reading mentor[\s\S]*clearance[\s\S]*Form-filling volunteer[\s\S]*distance/i);
  }
  const question = "Switch to the seven original roles";
  const a = await packTurn(question,saved,"shortlist");
  saved.push(historyItem(question,a));
  const b = await packTurn(EXERCISE_CASE_TEXT.B,saved,"shortlist");
  assert.deepEqual(b.caseProfile,profile("B"));
  assert.match(b.text,/Digital skills facilitator/);
  assert.ok(!b.text.includes("Digital access buddy"));
  saved.push(historyItem(EXERCISE_CASE_TEXT.B,b));
  const list = await packTurn("Which roles did the recruiter give us?",saved,"records");
  for (const row of exerciseRoles) assert.ok(list.text.includes(row.title));
  const count = await packTurn("Okay, and how many roles in your data set?",saved,"count");
  assert.equal(count.source,"exercise");
  assert.match(count.text,/100 fictional roles/);
  assert.match(count.text,/7 separate/);
  saved.push(historyItem("How many roles?",count));
  const detail = await packTurn("Why was Digital access buddy excluded?",saved,"detail",{role_id:"digital-access-buddy"});
  assert.match(detail.text,/Excluded.*online/i);
  const back = await run("Back to 100 instead of the seven", {intent:"case_search",activity:"",case_profile:profile("A")}, {history:saved});
  assert.equal(back.source,undefined);
  assert.deepEqual(back.caseProfile,profile("B"));
  assert.ok(back.matches.length);
  const edited = await run("Use all 100 again, now online only.",{
    intent:"case_search",activity:"",case_profile:{...profile("B"),mode:"online"},changed_fields:["mode"]
  },{history:saved});
  assert.equal(edited.caseProfile.mode,"online");
  const unknown = await run("Search the 100 community roles instead. I need a ceiling hoist.",
    {intent:"unknown",reply:"Ask the host about a ceiling hoist.",case_profile:profile("B")},{history:saved});
  assert.deepEqual(unknown.matches,[]);
  assert.match(unknown.text,/ceiling hoist/);
});

test("source metadata distinguishes generic search quantity, counts, selected sources and the volunteer profile", async () => {
  for (const question of ["Which are the original seven roles?",
    "Which seven roles did the recruitment task supply? List their titles.",
    "Which roles are in the candidate brief?", "exercise 里的七个岗位是哪些？"]) {
    const fresh = await packTurn(question,[],"records");
    assert.equal(fresh.caseProfile,undefined);
    assert.match(fresh.text,/Case A or Case B/);
    for (const row of exerciseRoles) assert.ok(fresh.text.includes(row.title));
  }
  const inventory = await packTurn("How many roles are in your data set?",[],"count");
  assert.equal(inventory.source,undefined);
  for (const msg of ["How many hours does this role need?", "How many of those roles fit Case B?", "Show me seven roles from the 100 community catalogue."]) {
    const reply = await run(msg,{intent:"clarify",reply:"Which role do you mean?"});
    assert.equal(reply.source,undefined);
  }
  const mixed = await packTurn("From the full catalogue switch to the seven exercise roles.",[],"records");
  assert.equal(mixed.source,"exercise");
  const saved = [{user:"Use the matching exercise", source:"exercise", text:"Your options.",matches:[],toConfirm:[],caseProfile:profile("B")}];
  const zh = await packTurn("这七个岗位里面为什么推荐这个？",saved,"detail",{language:"zh",role_id:"digital-skills-facilitator"});
  assert.match(zh.text,/招聘方原题/);
  assert.match(zh.text,/Digital skills facilitator/);
  assert.throws(()=>validateTurn({message:"next",history:[{...saved[0],matches:["bus-app-coach"]}]},roles),LiveError);
  assert.throws(()=>validateTurn({message:"next",history:[{...saved[0],source:"invented"}]},roles),LiveError);
  await assert.rejects(packTurn("Tell me about the first one",saved,"detail",{role_id:"bus-app-coach"}),{code:"invalid_reply"});
});

test("community clearance for a different role never clears the recruiter's reading mentor", async () => {
  const current = {...profile("A"),clearance:"verified",verifiedRoleId:"junior-coding-mentor"};
  const saved = [{user:"I have checked my clearance for the coding mentor.",text:"Recorded.",matches:[],toConfirm:[],caseProfile:current}];
  const answer = await packTurn("Use the matching exercise.",saved,"shortlist");
  assert.deepEqual(answer.caseProfile,current);
  assert.match(answer.text,/To confirm:[\s\S]*Youth reading mentor.*clearance/);
});
