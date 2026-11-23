import {EXERCISE_CASE_TEXT, exerciseProfile, matchExercise} from "./exercise-engine.js";

function normalise(text) {
  return String(text ?? "").toLowerCase().normalize("NFKC")
    .replace(/[’‘]/g, "'").replace(/[“”"]/g, "").replace(/(?<=[a-z])[‐‑–—-](?=[a-z])/g, " ")
    .replace(/\r\n?/g, "\n").trim().replace(/^'|'$/g, "");
}

function caseKey(text) {
  return normalise(text).replace(/[.,:;!?·–—]+/g, " ").replace(/\s+/g, " ").trim();
}

const headings = {A: "online or in person", B: "in person only"};
const caseKeys = {A: caseKey(EXERCISE_CASE_TEXT.A), B: caseKey(EXERCISE_CASE_TEXT.B)};

function suppliedCase(message) {
  const key = caseKey(message);
  for (const id of ["A", "B"]) {
    const name = "case " + id.toLowerCase();
    const heading = name + " " + headings[id];
    if ([name, heading, "run " + name, "load " + name, "use " + name].includes(key)) return {id, named: true};
    if (key === caseKeys[id]) return {id, named: false};
    if (key === name + " " + caseKeys[id] || key === heading + " " + caseKeys[id]) return {id, named: true};
  }
  return null;
}

export function isSuppliedExerciseCase(message) {
  return suppliedCase(message) !== null;
}

// An explicit but edited exercise prompt stays in the exercise even when its
// extra conditions cannot be interpreted. General catalogue queries stay there.
export function isExerciseChatRequest(message) {
  const key = caseKey(message);
  return isSuppliedExerciseCase(message) || /^(?:(?:run|load|use) )?case [ab]\b/.test(key)
    || Object.values(caseKeys).some(original => key.includes(original))
    || (key.startsWith(caseKey(EXERCISE_CASE_TEXT.A.split(".")[0]))
      && key.includes("weekday evenings") && key.includes("safeguarding clearance"));
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const digitWords = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g;

function readChange(clause) {
  if (/^(?:(?:i|the (?:same )?volunteer) (?:can no longer|cannot|can't) volunteer online(?: (?:any ?more|now))?|(?:i can (?:now )?only volunteer )?in person(?: only)?(?: now)?|i can (?:now )?volunteer in person only)$/.test(clause)) return {mode: "in-person"};
  if (/^(?:online only|(?:i can (?:now )?only volunteer|i can only help) online|i can volunteer online only)$/.test(clause)) return {mode: "online"};
  if (/^(?:online is fine|(?:i can volunteer )?(?:online or in person|in person or online))$/.test(clause)) return {mode: "either"};
  if (/^(?:(?:i can (?:only volunteer|volunteer only)|i(?: am|'m) (?:only )?(?:free|available)) (?:on )?)?weekday evenings(?: only)?$/.test(clause)) return {days: weekdays.slice(), period: "evening"};
  if (/^(?:my safeguarding clearance is (?:verified|valid) for (?:this|the youth reading mentor) role)$/.test(clause)) return {clearance: "verified"};
  if (/^(?:(?:i (?:do not|don't) know|i(?: am|'m) (?:unsure|not sure)) (?:if|whether) my (?:safeguarding )?clearance is valid for (?:a new|this) role|my (?:safeguarding )?clearance is (?:unknown|unverified|unconfirmed)(?: for this role)?)$/.test(clause)) return {clearance: "unknown"};
  if (/^(?:i have no (?:valid )?safeguarding clearance|my safeguarding clearance is not valid for this role)$/.test(clause)) return {clearance: "none"};
  if (/^(?:i(?:'d like| would like| want) to help (?:people|adults) (?:one to one|one on one|individually)|i prefer (?:one to one support|helping (?:people|adults) individually))$/.test(clause)) return {individual: true};
  if (/^i(?:'d like| would like| want| prefer) (?:to offer |to give )?one (?:to|on) one digital support$/.test(clause)) return {individual: true, digital: true};
  if (/^(?:ideally using (?:the digital support skills i already have|my digital (?:support )?skills)|i prefer (?:to use my digital (?:support )?skills|digital support))$/.test(clause)) return {digital: true};
  if (/^the form filling venue(?: distance is| is) (?:unknown|unconfirmed)$/.test(clause)) return {formFillingMiles: null};

  const numeric = clause.replace(digitWords, word => String(numberWords.indexOf(word)));
  const travel = /^(?:my (?:travel limit|travel radius) is|i can(?:not|'t) travel (?:more|further) than|i can travel up to) (\d+(?:\.\d+)?) miles?$/.exec(numeric);
  if (travel && Number.isFinite(Number(travel[1]))) return {maxMiles: Number(travel[1])};
  const venue = /^(?:what if )?the form filling venue(?: distance is| is) ([25]) miles?(?: away)?$/.exec(numeric);
  if (venue) return {formFillingMiles: Number(venue[1])};
  return null;
}

function summary({profile, formFillingMiles}) {
  const mode = {either: "online or in person", "in-person": "in person only", online: "online only"}[profile.mode];
  const clearance = {unknown: "unconfirmed", verified: "verified for this role", none: "no valid clearance"}[profile.clearance];
  return `Weekday evenings · ${mode} · travel limit ${profile.maxMiles} miles · prefers one-to-one and digital support · clearance ${clearance} · form-filling venue distance ${formFillingMiles === null ? "unknown in the supplied record" : formFillingMiles + " miles (hypothetical)"}.`;
}

function response(state, reply, run) {
  return {state, reply, summary: state ? summary(state) : "",
    result: run ? matchExercise(state.profile, {formFillingMiles: state.formFillingMiles}) : null};
}

export function askExercise(message, previousState = null) {
  const supplied = suppliedCase(message);
  if (supplied) {
    if (supplied.id === "B" && !supplied.named && previousState) {
      const state = {...previousState, profile: {...previousState.profile, mode: "in-person"}};
      return response(state, "I changed participation to in person and kept the other conditions from your previous turn.", true);
    }
    return response({profile: exerciseProfile(supplied.id), formFillingMiles: null},
      `I used the volunteer conditions supplied for Case ${supplied.id} and checked all seven opportunities.`, true);
  }

  // Every clause must be understood. A partially understood request gets no
  // shortlist, so an unsupported requirement cannot silently disappear.
  let text = normalise(message);
  const heading = /^(?:(?:run|load|use) )?case ([ab])\b/.exec(text);
  if (heading) {
    text = text.slice(heading[0].length).trimStart();
    const title = headings[heading[1].toUpperCase()];
    if (text.startsWith("· " + title)) text = text.slice(title.length + 2);
    text = text.replace(/^[\s:·,.]+/, "");
  }
  text = text.replace(/[^\S\n]+/g, " ");
  const clauses = text.split(/[,;!?\n]|\.(?!\d)|\bbut\b|\band (?=(?:i|my|the form filling venue)\b)/).map(c => c.trim()).filter(Boolean);
  const changes = {};
  let recognised = 0;
  for (const clause of clauses) {
    if (clause === "everything else stays the same") continue;
    const change = readChange(clause);
    if (!change || Object.keys(change).some(k => k in changes)) {
      return response(previousState, "I could not apply every condition in that message. Try the supplied Case A or Case B, or make one change such as “My travel limit is 5 miles”. For a venue scenario, name the form-filling venue.", false);
    }
    Object.assign(changes, change);
    recognised++;
  }
  if (clauses.includes("online is fine") && changes.maxMiles === undefined) {
    return response(previousState, "Can you also attend in person? Choose “online only” or “online or in person” so I can check the right roles.", false);
  }
  const base = heading ? {profile: exerciseProfile(heading[1].toUpperCase()), formFillingMiles: null} : previousState;
  const {formFillingMiles, ...profileUpdates} = changes;
  const profile = {...base?.profile, ...profileUpdates};
  const required = ["mode", "days", "period", "maxMiles", "clearance", "individual", "digital"];
  if (!recognised || required.some(field => !(field in profile))) {
    return response(previousState, "Which supplied volunteer should I start from? Paste the whole Case A description or type Case A or Case B. Then you can update a condition.", false);
  }
  const state = {profile, formFillingMiles: formFillingMiles === undefined ? base?.formFillingMiles ?? null : formFillingMiles};
  const reply = heading ? `I applied your changes to the supplied Case ${heading[1].toUpperCase()}.`
    : previousState ? "I updated the stated conditions and kept the other details from your previous turn." : "I used the volunteer conditions in your message.";
  const answer = response(state, reply, true);
  if (formFillingMiles !== undefined) {
    const target = row => row.role.id === "form-filling-volunteer";
    const decision = answer.result.excluded.find(target) ?? answer.result.pending.find(target);
    const rank = answer.result.recommendations.findIndex(target);
    if (decision) answer.reply += " Form-filling volunteer. " + decision.reasons.join(" ");
    else if (rank >= 0) answer.reply += ` Form-filling volunteer is number ${rank + 1} on the shortlist.`;
    else answer.reply += " Form-filling volunteer is among the other feasible roles.";
  }
  return answer;
}
