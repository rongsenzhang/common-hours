import { escapeText as e, roleByline } from "./html.js";
import { icon } from "./icons.js";

const starters = [
  "Can I walk dogs at weekends?",
  "What can I do from home?",
];

function recommendations(ids, details, byId, heading) {
  if (!ids?.length) return "";
  const rows = ids
    .map((id) => {
      const role = byId.get(id);
      if (!role) return "";
      return `<li><button class="role-link" data-detail="${e(id)}">${e(role.title)} ${icon("next", 15)}</button>
      <span class="chat-host">${roleByline(role)}</span>
      <p>${e(details?.[id] || role.summary)}</p></li>`;
    })
    .join("");
  return rows
    ? `<h3>${e(heading)}</h3><ul class="chat-options">${rows}</ul>`
    : "";
}

function interviewReply({ reply, summary, result, state }) {
  let cards = "";
  if (result) {
    const matches = result.recommendations.map(({ role, reasons }) => {
      const simulated = role.id === "form-filling-volunteer" && state.formFillingMiles !== null;
      return `<li><strong data-exercise-title>${e(role.title)}</strong>
      <span class="chat-host">${simulated ? "Original listing · " : ""}${e(role.whenWhere)}</span>
      <p>${e(role.activity)}.</p><p>${e(reasons.join(" "))}</p></li>`;
    }).join("");
    cards = `<h3>Shortlist</h3>${matches
      ? '<ol class="chat-options chat-shortlist" data-exercise-recommendations>' + matches + '</ol>'
      : '<p data-exercise-recommendations>No confirmed recommendation for these conditions.</p>'}`;
    if (result.pending.length) {
      cards += `<h3>Needs confirmation</h3><ul class="chat-options chat-pending" data-exercise-pending>${result.pending
        .map(({ role, reasons }) => `<li><strong data-exercise-title>${e(role.title)}</strong>
        <p>${e(reasons.join(" "))}</p></li>`).join("")}</ul>`;
    }
  }
  return `<span class="chat-source">Interview exercise · On-device matching</span>
    <p class="chat-answer">${e(reply)}</p>
    ${summary ? `<p class="chat-criteria"><strong>Current conditions</strong> ${e(summary)}</p>` : ""}${cards}`;
}

function catalogueReply(reply, byId) {
  const model = reply.provider === "openai" ? "OpenAI · " + e(reply.model) : "On-device search";
  const exercise = reply.source === "exercise";
  const source = exercise
    ? '<a href="#exercise-records">Recruitment task · 7 supplied roles</a>'
    : `Full catalogue · ${byId.size} roles`;
  return `<div class="chat-source"><span>${model}</span> <span>· ${source}</span></div>
    <p class="chat-answer">${e(reply.text)}</p>
    ${recommendations(reply.matches, reply.details, byId, "Matching roles")}
    ${recommendations(reply.toConfirm, reply.details, byId, "To confirm with the organiser")}
    ${["A", "B"].includes(reply.caseId) ? `<a href="#discover-case-${reply.caseId.toLowerCase()}">Adjust Case ${reply.caseId} in Discover</a>` : ""}`;
}

function promptButton(input, label = input) {
  return `<button type="button" data-prompt="${e(input)}">${e(label)} ${icon("next", 15)}</button>`;
}

function casePrompts() {
  return promptButton("Case A", "Run Case A") + promptButton("Case B", "Run Case B");
}

function interviewFollowups(state) {
  const prompts = [];
  if (!state) prompts.push(casePrompts());
  else {
    if (state.profile.mode !== "in-person") prompts.push(promptButton("I can only volunteer in person now.", "Switch to in person"));
    if (state.formFillingMiles !== 2) prompts.push(promptButton("The form-filling venue is 2 miles away.", "Try a 2-mile venue"));
    if (state.formFillingMiles !== 5) prompts.push(promptButton("The form-filling venue is 5 miles away.", "Try a 5-mile venue"));
    if (state.formFillingMiles !== null) prompts.push(promptButton("The form-filling venue distance is unknown.", "Restore unknown distance"));
  }
  return `<div class="chat-starters chat-followups" aria-label="Example follow-ups">${prompts.join("")}</div>`;
}

export function renderChat(
  turns,
  roles,
  {
    source = "community",
    mode = "local",
    liveAvailable = false,
    pending = null,
    error = "",
    draft = "",
  } = {},
) {
  const interview = source === "exercise";
  const live = !interview && mode === "live";
  const disclosure = interview
    ? "The seven interview roles are matched on this device using the rules from Matching exercise. Your case stays in this tab."
    : live
    ? "Live AI uses OpenAI. Sending a message shares your question and up to eight recent turns from this AI chat with OpenAI via our server."
    : "On-device search uses the catalogue in this browser. Your questions stay in this tab.";
  const selector = !interview && liveAvailable
    ? `<fieldset class="chat-modes"><legend>How would you like to search?</legend>
    <label><input type="radio" name="chat-mode" value="live" ${live ? "checked" : ""}> Live AI</label>
    <label><input type="radio" name="chat-mode" value="local" ${live ? "" : "checked"}> On-device search</label></fieldset>`
    : "";

  const byId = interview ? null : new Map(roles.map((role) => [role.id, role]));
  const messages = turns
    .map(
      ({ input, reply }) =>
        `<article class="chat-turn"><p class="asked"><span class="sr">You asked: </span>${e(input)}</p>
      <div class="answered">${interview ? interviewReply(reply) : catalogueReply(reply, byId)}
      </div></article>`,
    )
    .join("");
  const prompts = interview
    ? casePrompts()
    : starters.map(prompt => promptButton(prompt)).join("")
      + (live ? promptButton("I'd like to volunteer but I'm not sure what I'd be good at.", "Help me find my strengths") : "")
      + casePrompts();
  const last = turns.at(-1);
  const whyPrompt = /[\u3400-\u9fff]/u.test(last?.input ?? "") ? "为什么这些岗位适合我？" : "Why do these roles suit me?";
  const followups = [];
  if (live && !pending && last) {
    if (last.reply.matches.length || (last.reply.source === "exercise" && last.reply.caseProfile)) {
      followups.push(promptButton(whyPrompt));
    }
    if (last.reply.source === "exercise") {
      followups.push(promptButton(`Search all ${roles.length} roles again.`, `Use all ${roles.length} roles`));
    } else if (last.reply.caseProfile) {
      followups.push(promptButton("Use only the seven roles from the matching exercise.", "Use the seven exercise roles"));
    }
  }
  const placeholder = interview
    ? (turns.length ? "e.g. My travel limit is 5 miles." : "Paste the volunteer case here…")
    : "e.g. Case A, or tell me what you’re looking for…";
  const input = `<textarea id="chat-input" name="message" rows="${interview ? 3 : 1}" maxlength="1200" required placeholder="${placeholder}" autocomplete="off" aria-describedby="chat-disclosure" ${pending ? "disabled" : ""}>${e(draft)}</textarea>`;
  return `<section class="chat-page"><header class="chat-header">
    <div class="chat-mark">${icon("chat", 26)}</div><h1>${interview ? "Seven-role exercise chat" : "Ask the role finder"}</h1>
    <p>${interview ? 'Try the two cases with the <a href="#exercise-records">seven roles supplied in the recruitment task</a>. You can change one condition in a follow-up.' : `Case A, Case B and your own questions search all ${roles.length} fictional roles, including the <a href="#exercise-records">seven roles supplied in the recruitment task</a>.`}</p></header>
    ${selector}
    <p class="chat-disclosure" id="chat-disclosure">${e(disclosure)}</p>
    ${turns.length || pending ? '<div class="chat-tools"><button class="text-btn" data-restart-chat>Start a new chat</button></div>' : '<div class="chat-starters" aria-label="Example questions">' + prompts + "</div>"}
    <div class="chat-history">${messages}${pending ? `<article class="chat-turn"><p class="asked"><span class="sr">You asked: </span>${e(pending)}</p><div class="answered"><p role="status">Waiting for OpenAI…</p></div></article>` : ""}</div>
    ${interview && turns.length ? interviewFollowups(turns.at(-1).reply.state) : ""}
    ${followups.length ? '<div class="chat-starters chat-followups" aria-label="Explore these recommendations">' + followups.join("") + "</div>" : ""}
    ${error ? `<p class="chat-error" role="alert">${e(error)}</p>` : ""}
    <form id="chat-form" class="chat-composer"><label for="chat-input">${turns.length ? "Ask a follow-up" : interview ? "Your volunteer case" : "Your question"}</label>
      <div>${input}
      ${pending ? '<button type="button" class="primary" data-cancel-chat>Cancel</button>' : `<button type="submit" class="primary">Ask ${icon("next", 16)}</button>`}</div>
      <small>Reloading clears the conversation from this tab.</small>
    </form></section>`;
}
