import { escapeText as e, roleByline } from "./html.js";
import { communityRoleFacts, discoverCaseFromHash, profileFromCommunityForm, renderCommunityCases } from "./community-case-view.js";
import { matchOpportunities } from "./engine.js";
import { icon, mark } from "./icons.js";
import { communityCaseId, matchCommunityCase } from "./community-case.js";
import { exerciseProfile } from "./exercise-engine.js";
import { answerVolunteerQuestion } from "./assistant.js";
import { askExercise } from "./exercise-chat.js";
import { renderChat } from "./chat-view.js";
import { mountExercise } from "./exercise-view.js";
import {
  chatEndpoint,
  requestLiveReply,
  liveFailureMessage,
} from "./live-chat.js";

const main = document.querySelector("#main");
const dialog = document.querySelector("#role-dialog");
document.querySelector("#mark").innerHTML = mark;
const entryPrefs = () => ({
  query: "",
  time: "any",
  mode: "any",
  stepFree: false,
});
let prefs = entryPrefs(),
  section = "matches",
  catalog,
  ai,
  page,
  resultLimit = 6,
  expandedFilters = false,
  returnFocus;
const saved = new Set(readList("saved"));
let endpoint = null;
let chatMode = "local";
const chats = {
  local: { turns: [], draft: "" },
  live: { turns: [], draft: "" },
  exercise: { turns: [], draft: "" },
};
let liveRequest = null;
let chatError = "";
let leaveExercise;
let catalogueRequest;
let communityConditions;
function activeChat() {
  return chats[page === "ask-exercise" ? "exercise" : chatMode];
}
function chatContents() {
  const exercise = page === "ask-exercise";
  const chat = activeChat();
  return renderChat(chat.turns, catalog?.opportunities ?? [], {
    source: exercise ? "exercise" : "community",
    mode: chatMode,
    liveAvailable: Boolean(endpoint),
    pending: exercise ? null : liveRequest?.input,
    error: !exercise && chatMode === "live" ? chatError : "",
    draft: chat.draft,
  });
}
function updateChat(focus = false) {
  if (page !== "ask" && page !== "ask-exercise") return;
  main.innerHTML = chatContents();
  if (focus)
    main
      .querySelector(liveRequest ? "[data-cancel-chat]" : "#chat-input")
      ?.focus({ preventScroll: true });
}
function cancelRequest(restoreDraft = true) {
  if (!liveRequest) return;
  const { input, controller } = liveRequest;
  liveRequest = null;
  controller.abort();
  if (restoreDraft) {
    chats.live.draft = input;
    chatError = liveFailureMessage("cancelled", input);
  }
}
const labels = {
  time: "Availability",
  mode: "Participation",
  stepFree: "Step-free access",
  weekday: "Weekdays",
  weekend: "Weekends",
  flexible: "Flexible timing",
  onsite: "At the venue",
  remote: "From home",
  hybrid: "Hybrid",
  unknown: "Awaiting confirmation",
  yes: "Confirmed step-free",
  no: "Steps at venue",
  na: "No venue visit",
};
const themes = {
  animals: ["paw", "Animal care"],
  arts: ["arts", "Arts & heritage"],
  community: ["people", "Community"],
  digital: ["digital", "Digital support"],
  food: ["food", "Food & community"],
  growing: ["sprout", "Growing"],
  learning: ["book", "Learning"],
  nature: ["leaf", "Nature"],
  repair: ["repair", "Repair & reuse"],
};
const browseOrder = [
  "garden-buddy",
  "pantry-packer",
  "digital-helper",
  "archive-transcriber",
  "phone-companion",
  "repair-cafe",
];
function readList(name) {
  try {
    const x = JSON.parse(localStorage.getItem("commonhours.1." + name));
    return Array.isArray(x) ? x.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
function saveList(name, set) {
  try {
    localStorage.setItem("commonhours.1." + name, JSON.stringify([...set]));
  } catch {
    announce("Changes are available for this visit.");
  }
}
function announce(s) {
  document.querySelector("#announcer").textContent = s;
}
function ranking() {
  const r = matchOpportunities(catalog.opportunities, prefs);
  if (!prefs.query) {
    const order = (id) => {
      const i = browseOrder.indexOf(id);
      return i === -1 ? 99 : i;
    };
    for (const items of Object.values(r))
      items.sort((a, b) => order(a.opportunity.id) - order(b.opportunity.id));
  }
  return r;
}
function selectHtml(name, title, options) {
  return (
    '<label class="field">' +
    e(title) +
    '<span class="select-wrap"><select name="' +
    name +
    '">' +
    options
      .map(
        ([v, t]) =>
          '<option value="' +
          v +
          '"' +
          (prefs[name] === v ? " selected" : "") +
          ">" +
          t +
          "</option>",
      )
      .join("") +
    "</select>" +
    icon("down", 16) +
    "</span></label>"
  );
}
function filterHtml() {
  return `<aside class="filters" aria-label="Search preferences"><div class="filter-head"><div>${icon("filter", 20)}<h2>Your preferences</h2></div><button class="mobile-filter" type="button" data-filter-toggle aria-expanded="${expandedFilters}">${expandedFilters ? "Hide" : "Edit"}</button></div>
 <form id="pref-form" class="${expandedFilters ? "is-open" : ""}"><label class="field">Interests or skills<span class="input-wrap">${icon("search", 17)}<input type="search" name="query" maxlength="1200" placeholder="e.g. growing food or Case A" value="${e(prefs.query)}"></span></label>
 ${selectHtml("time", "Availability", [
   ["any", "Any time"],
   ["weekday", "Weekdays"],
   ["weekend", "Weekends"],
 ])}
 ${selectHtml("mode", "Participation", [
   ["any", "Any setting"],
   ["onsite", "At the venue"],
   ["remote", "From home"],
 ])}
 <label class="checkbox"><input name="stepFree" type="checkbox" ${prefs.stepFree ? "checked" : ""}><span>Step-free access required</span></label>
 <button type="submit" class="primary apply">${icon("search", 17)} Find roles</button><button class="text-btn reset" type="button" data-clear>Reset preferences</button></form></aside>`;
}
function hero() {
  return `<section class="hero"><div class="hero-copy"><p class="eyebrow">${icon("pin", 15)} Greater Manchester</p><h1>Find your place<br><em>to volunteer.</em></h1><p class="hero-sub">Explore community roles that fit your interests, your time and your access needs.</p><a class="hero-assistant" href="#ask">Ask the role finder ${icon("next", 16)}</a><div class="hero-meta"><span>${icon("layers", 16)} ${catalog.opportunities.length} demo roles</span><i></i><span>${catalog.summary.hostCount} community hosts</span></div></div><div class="hero-photo"><img src="./assets/allotment.webp" width="1000" height="667" alt="Illustration of two volunteers planting seedlings in a community allotment"><span>Community growing · illustrative scene</span></div></section>`;
}
function renderCard(row) {
  const r = row.opportunity,
    t = themes[r.theme] || themes.community,
    isSaved = saved.has(r.id);
  return `<article class="role-card"><div class="card-top"><div class="themelabel"><span class="tile ${e(r.theme)}">${icon(t[0], 22)}</span><span>${e(t[1])}</span></div><button class="save ${isSaved ? "selected" : ""}" aria-label="${isSaved ? "Unsave" : "Save"} ${e(r.title)}" aria-pressed="${isSaved}" data-save="${e(r.id)}">${icon("save", 19)}</button></div>
 <h3><button data-detail="${e(r.id)}">${e(r.title)}</button></h3><p class="org">${roleByline(r, false)}</p><p class="card-desc">${e(r.summary)}</p>
 <div class="card-foot"><span>${icon("pin", 15)} ${e(r.mode === "remote" ? "From home" : r.source === "exercise" ? labels[r.mode] : r.area)}</span><span>${icon("clock", 15)} ${e(r.time === "unknown" ? "Time to confirm" : labels[r.time])}</span></div>
 ${row.issues?.length ? '<div class="issue-line">' + icon("info", 15) + " " + e(row.issues[0].label) + "</div>" : ""}</article>`;
}
function showResults() {
  const r = ranking(),
    savedRows = catalog.opportunities
      .filter((x) => saved.has(x.id))
      .map((opportunity) => ({ opportunity }));
  const choices = [
    ["matches", "Matches", r.matches],
    ["review", "To confirm", r.review],
    ["saved", "Saved", savedRows],
  ];
  const cur = choices.find((c) => c[0] === section),
    rows = cur[2];
  let message;
  if (section === "saved")
    message = "Roles you have bookmarked on this device.";
  else if (section === "review")
    message = "These roles need a host to confirm one of your requirements.";
  else
    message = prefs.query
      ? "Sorted by relevance to “" + prefs.query + "”."
      : "Explore the roles, then narrow them down with your preferences.";
  const emptyText =
    section === "saved"
      ? "Use the bookmark on any role to save it here."
      : section === "review"
        ? "No relevant roles are waiting on your selected requirements."
        : "Try a wider interest, change a requirement or check the To confirm list.";
  return `<section class="results" id="results" aria-label="Search results"><div class="results-heading"><div><p class="eyebrow">Role directory</p><h2>Explore opportunities</h2></div></div>
 <div class="result-tabs" aria-label="Results views">${choices.map(([id, name, v]) => `<button type="button" aria-pressed="${section === id}" data-section="${id}">${name}<span>${v.length}</span></button>`).join("")}</div>
 <p class="results-note">${e(message)}</p>
 <div class="cards">${rows.slice(0, resultLimit).map(renderCard).join("")}</div>
 ${!rows.length ? `<div class="empty">${icon(section === "saved" ? "save" : "search", 28)}<h3>${section === "saved" ? "Your saved list is empty" : section === "review" ? "Nothing to confirm" : "No matching roles"}</h3><p>${e(emptyText)}</p></div>` : ""}
 ${rows.length > resultLimit ? `<button class="secondary more" data-more>Show more roles (${rows.length - resultLimit})</button>` : ""}
 ${
   r.excluded.length && section !== "saved"
     ? `<details class="conflicts"><summary>${r.excluded.length} ${r.excluded.length === 1 ? "role conflicts" : "roles conflict"} with your requirements</summary><ul>${r.excluded
         .map(
           (x) =>
             `<li><strong>${e(x.opportunity.title)}</strong> · ${e(
               x.issues
                 .filter((i) => i.status === "conflict")
                 .map((i) => i.label)
                 .join(" "),
             )}</li>`,
         )
         .join("")}</ul></details>`
     : ""
 }</section>`;
}
function discover() {
  const caseId = discoverCaseFromHash(location.hash);
  return hero() + renderCommunityCases(catalog.opportunities, caseId, communityConditions)
    + '<div class="directory">' + filterHtml() + showResults() + "</div>";
}
function focusCommunityCase() {
  const heading = main.querySelector("#community-case-shortlist");
  if (!heading) return false;
  heading.focus({preventScroll: true});
  main.querySelector("#community-cases").scrollIntoView({block: "start"});
  return true;
}
function refreshResults() {
  const target = document.querySelector("#results");
  if (target) target.outerHTML = showResults();
}
function render(scroll = false) {
  const h = location.hash.slice(1);
  if (page === "ask" && h !== "ask") cancelRequest();
  leaveExercise?.();
  leaveExercise = undefined;
  const route = h === "exercise-records" ? "exercise" : h;
  page = ["ask", "ask-exercise", "exercise"].includes(route) ? route : "discover";
  const titles = { discover: "Discover volunteer roles", exercise: "Matching exercise", ask: "Ask the role finder", "ask-exercise": "Interview cases · Ask the role finder" };
  document.title = titles[page] + " · Common Hours";
  for (const n of document.querySelectorAll("nav a")) {
    if (n.dataset.page === (page === "ask-exercise" ? "ask" : page)) n.setAttribute("aria-current", "page");
    else n.removeAttribute("aria-current");
  }
  if (page === "exercise") {
    leaveExercise = mountExercise(main);
    if (h === "exercise-records") {
      const records = main.querySelector("#exercise-records");
      records.open = true;
      records.querySelector("summary").focus({preventScroll: true});
      records.scrollIntoView({block: "start"});
      return;
    }
  } else if (page === "ask-exercise") {
    main.innerHTML = chatContents();
  } else if (catalog) {
    main.innerHTML = page === "ask" ? chatContents() : discover();
  } else {
    main.innerHTML = '<p class="loading">Opening the volunteer catalogue…</p>';
    catalogueRequest ??= openCatalogue();
  }
  if (scroll && !focusCommunityCase()) {
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
function detail(id) {
  const r = catalog.opportunities.find((x) => x.id === id);
  if (!r) return;
  const t = themes[r.theme] || themes.community;
  returnFocus = document.activeElement;
  const qs = ai.questions.filter(
    (q) =>
      q.roleId === id &&
      r[q.field] === "unknown" &&
      !(q.field === "stepFree" && r.mode === "remote"),
  );
  const fields = ["time", "mode", "stepFree"];
  dialog.innerHTML = `<div class="modal-head"><span class="themelabel"><span class="tile ${e(r.theme)}">${icon(t[0], 22)}</span>${e(t[1])}</span><button autofocus class="close" aria-label="Close role details" data-close>${icon("close")}</button></div>
 <h2 id="dialog-title">${e(r.title)}</h2><p class="org">${roleByline(r)}</p><p>${e(r.summary)}</p>
 ${r.tasks.length === 1 && r.tasks[0] === r.summary ? "" : "<h3>What you would do</h3><ul>" + r.tasks.map((x) => "<li>" + e(x) + "</li>").join("") + "</ul>"}
 <h3>Role details</h3><dl class="fact-grid">${fields.map((f) => "<div><dt>" + e(labels[f]) + "</dt><dd>" + e(f === "stepFree" && r.mode === "remote" ? "No venue visit" : labels[r[f]]) + "</dd></div>").join("")}${communityRoleFacts(r)}</dl>
 ${r.contactNote ? "<h3>Before you take part</h3><p>" + e(r.contactNote) + "</p>" : ""}
 ${qs.length ? `<div class="question"><h3>What to ask the organiser</h3>${qs.map((q) => "<p>" + e(q.question) + "</p>").join("")}</div>` : ""}
 <div class="modal-foot"><button class="primary" data-dialog-save="${e(id)}">${icon("save", 17)} ${saved.has(id) ? "Remove from saved" : "Save role"}</button></div>`;
  if (!dialog.open) dialog.showModal();
}
function toggleSaved(id) {
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  saveList("saved", saved);
  announce(saved.has(id) ? "Role saved." : "Role removed from saved.");
}
async function ask(message) {
  const input = message.trim();
  if (!input || liveRequest) return;
  const chat = activeChat();
  chat.draft = "";
  let reply;
  if (page === "ask-exercise") {
    reply = askExercise(input, chat.state);
    chat.state = reply.state;
  } else if (chatMode === "live") {
    if (!endpoint) return;
    chatError = "";
    const request = { input, controller: new AbortController() };
    liveRequest = request;
    updateChat(true);
    try {
      reply = await requestLiveReply({
        endpoint,
        message: input,
        turns: chat.turns,
        roles: catalog.opportunities,
        signal: request.controller.signal,
      });
    } catch (error) {
      if (liveRequest !== request) return;
      liveRequest = null;
      chat.draft = input;
      chatError = liveFailureMessage(error.kind, input);
      updateChat(true);
      return;
    }
    if (liveRequest !== request) return;
    liveRequest = null;
  } else {
    const caseId = communityCaseId(input);
    if (caseId) {
      const result = matchCommunityCase(catalog.opportunities, exerciseProfile(caseId));
      const confirmed = result.recommendations;
      const pending = result.pending.slice(0, 3);
      reply = {
        text: `Case ${caseId} checked against ${catalog.opportunities.length} community roles on this device. ${confirmed.length ? "These are the strongest evidenced matches." : "No confirmed match for these conditions."} Open Discover to adjust the case conditions.`,
        matches: confirmed.map(row => row.role.id),
        toConfirm: pending.map(row => row.role.id),
        details: Object.fromEntries([...confirmed, ...pending].map(row => [row.role.id, row.reasons.join(" ")])),
        caseId,
      };
      chat.state = null;
    } else {
      reply = answerVolunteerQuestion(input, catalog.opportunities, chat.state);
      chat.state = reply.state;
    }
  }
  chat.turns.push({ input, reply });
  updateChat(true);
  main
    .querySelector(".chat-turn:last-child")
    ?.scrollIntoView({ block: "nearest" });
  announce(page === "ask-exercise" ? reply.reply : reply.text);
}
document.addEventListener("paste", (ev) => {
  const input = ev.target;
  if (!input.matches('#pref-form input[name=query]') || !ev.clipboardData) return;
  const pasted = ev.clipboardData.getData("text/plain");
  if (!/[\r\n]/.test(pasted) || !communityCaseId(pasted)) return;
  ev.preventDefault();
  input.setRangeText(pasted.replace(/\s+/g, " ").trim(), input.selectionStart, input.selectionEnd, "end");
});
document.addEventListener("input", (ev) => {
  if (ev.target.id === "chat-input") activeChat().draft = ev.target.value;
});
document.addEventListener("keydown", (ev) => {
  if (ev.target.matches("textarea#chat-input") && ev.key === "Enter" && !ev.shiftKey && !ev.isComposing && ev.keyCode !== 229) {
    ev.preventDefault();
    ev.target.form.requestSubmit();
  }
});
document.addEventListener("change", (ev) => {
  if (ev.target.name !== "chat-mode" || !endpoint) return;
  const mode = ev.target.value;
  if (!["live", "local"].includes(mode) || mode === chatMode) return;
  cancelRequest();
  chatMode = mode;
  updateChat();
  main.querySelector(`[name="chat-mode"][value="${mode}"]`)?.focus();
});
document.addEventListener("click", (ev) => {
  const activePreset = ev.target.closest(".community-case-links a[aria-current]");
  if (activePreset && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && !ev.altKey) {
    ev.preventDefault();
    communityConditions = undefined;
    render(true);
    return;
  }
  const b = ev.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if ("filterToggle" in d) {
    expandedFilters = !expandedFilters;
    document
      .querySelector("#pref-form")
      .classList.toggle("is-open", expandedFilters);
    b.setAttribute("aria-expanded", String(expandedFilters));
    b.textContent = expandedFilters ? "Hide" : "Edit";
  }
  if ("clear" in d) {
    prefs = entryPrefs();
    section = "matches";
    resultLimit = 6;
    render();
    main.querySelector("[name=query]")?.focus();
    announce("Preferences reset.");
  }
  if (d.section) {
    section = d.section;
    resultLimit = 6;
    refreshResults();
    main.querySelector('[data-section="' + section + '"]')?.focus();
  }
  if (d.save) {
    toggleSaved(d.save);
    refreshResults();
    (
      main.querySelector('[data-save="' + d.save + '"]') ||
      main.querySelector('[data-section="saved"]')
    )?.focus();
  }
  if (d.detail) detail(d.detail);
  if ("close" in d) dialog.close();
  if (d.dialogSave) {
    toggleSaved(d.dialogSave);
    refreshResults();
    b.innerHTML =
      icon("save", 17) +
      (saved.has(d.dialogSave) ? " Remove from saved" : " Save role");
  }
  if ("more" in d) {
    const prev = resultLimit;
    resultLimit += 6;
    refreshResults();
    main.querySelectorAll(".role-card h3 button")[prev]?.focus();
  }
  if (d.prompt) ask(d.prompt);
  if ("cancelChat" in d) {
    cancelRequest();
    updateChat(true);
  }
  if ("restartChat" in d) {
    cancelRequest(false);
    if (page === "ask" && chatMode === "live") chatError = "";
    Object.assign(activeChat(), { turns: [], draft: "", state: null });
    updateChat(true);
    announce("Conversation cleared.");
  }
});
dialog.addEventListener("click", (ev) => {
  if (ev.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      ev.clientX < r.left ||
      ev.clientX > r.right ||
      ev.clientY < r.top ||
      ev.clientY > r.bottom
    )
      dialog.close();
  }
});
dialog.addEventListener("close", () => {
  const active = document.activeElement;
  if (active && active !== document.body && !dialog.contains(active)) return;
  if (returnFocus?.isConnected) returnFocus.focus();
  else main.querySelector("[data-detail]")?.focus();
});
document.addEventListener("submit", (ev) => {
  if (ev.target.id === "chat-form") {
    ev.preventDefault();
    ask(String(new FormData(ev.target).get("message") || ""));
    return;
  }
  if (ev.target.id === "community-case-form") {
    ev.preventDefault();
    const caseId = discoverCaseFromHash(location.hash);
    if (!caseId) return;
    communityConditions = profileFromCommunityForm(caseId, new FormData(ev.target));
    main.querySelector("#community-cases").outerHTML = renderCommunityCases(catalog.opportunities, caseId, communityConditions);
    focusCommunityCase();
    announce("Community shortlist updated.");
    return;
  }
  if (ev.target.id !== "pref-form") return;
  ev.preventDefault();
  const f = new FormData(ev.target);
  const query = String(f.get("query") || "").trim();
  const caseId = communityCaseId(query);
  if (caseId) {
    const target = "#discover-case-" + caseId.toLowerCase();
    if (location.hash === target) {
      communityConditions = undefined;
      render(true);
    } else location.hash = target;
    return;
  }
  const wasCase = Boolean(discoverCaseFromHash(location.hash));
  if (wasCase) {
    history.replaceState(null, "", "#discover");
    communityConditions = undefined;
  }
  prefs = {
    query,
    time: f.get("time"),
    mode: f.get("mode"),
    stepFree: f.has("stepFree"),
  };
  resultLimit = 6;
  section = "matches";
  if (wasCase) render();
  else refreshResults();
  const r = ranking();
  announce(r.matches.length + " matches, " + r.review.length + " to confirm.");
  if (wasCase || matchMedia("(max-width:760px)").matches)
    main.querySelector("#results").scrollIntoView();
});
window.addEventListener("hashchange", () => {
  if (location.hash !== "#main") {
    communityConditions = undefined;
    render(true);
  }
});
async function loadJson(file) {
  const response = await fetch("./data/" + file);
  if (!response.ok) throw Error("Resource unavailable");
  return response.json();
}
async function openCatalogue() {
  try {
    let config;
    [catalog, ai, config] = await Promise.all([
      loadJson("catalog.json"),
      loadJson("host-questions.json").catch(() => ({ questions: [] })),
      loadJson("chat-config.json").catch(() => null),
    ]);
    endpoint = chatEndpoint(config, location.href);
    chatMode = endpoint ? "live" : "local";
    if (page === "ask" || page === "discover") {
      main.innerHTML = page === "ask" ? chatContents() : discover();
      if (page === "discover") focusCommunityCase();
    }
  } catch {
    if (page === "ask" || page === "discover") main.innerHTML =
      '<div class="empty"><h1>The catalogue could not open</h1><p>Reload the page to try again, or <a href="#ask-exercise">open the interview cases</a>.</p></div>';
  } finally {
    catalogueRequest = undefined;
  }
}
render();
