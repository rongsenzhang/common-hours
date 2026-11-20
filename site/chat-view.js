import { escapeText as e } from "./html.js";
import { icon } from "./icons.js";

const starters = [
  "Can I walk dogs at weekends?",
  "I like gardening and need step-free access.",
  "What can I do from home?",
];

function recommendations(ids, details, byId, heading) {
  if (!ids?.length) return "";
  const rows = ids
    .map((id) => {
      const role = byId.get(id);
      if (!role) return "";
      return `<li><button class="role-link" data-detail="${e(id)}">${e(role.title)} ${icon("next", 15)}</button>
      <span class="chat-host">${e(role.organisation)} · ${e(role.area)}</span>
      <p>${e(details?.[id] || role.summary)}</p></li>`;
    })
    .join("");
  return rows
    ? `<h3>${e(heading)}</h3><ul class="chat-options">${rows}</ul>`
    : "";
}

export function renderChat(
  turns,
  roles,
  {
    mode = "local",
    liveAvailable = false,
    pending = null,
    error = "",
    draft = "",
  } = {},
) {
  const live = mode === "live";
  const disclosure = live
    ? "Live AI uses OpenAI. Sending a message shares your question and up to eight recent turns from this AI chat with OpenAI via our server."
    : "On-device search uses the catalogue in this browser. Your questions stay in this tab.";
  const selector = liveAvailable
    ? `<fieldset class="chat-modes"><legend>How would you like to search?</legend>
    <label><input type="radio" name="chat-mode" value="live" ${live ? "checked" : ""}> Live AI</label>
    <label><input type="radio" name="chat-mode" value="local" ${live ? "" : "checked"}> On-device search</label></fieldset>`
    : "";

  const byId = new Map(roles.map((role) => [role.id, role]));
  const messages = turns
    .map(
      ({ input, reply }) =>
        `<article class="chat-turn"><p class="asked"><span class="sr">You asked: </span>${e(input)}</p>
      <div class="answered"><span class="chat-source">${reply.provider === "openai" ? "OpenAI · " + e(reply.model) : "On-device search"}</span><p class="chat-answer">${e(reply.text)}</p>
       ${recommendations(reply.matches, reply.details, byId, "Matching roles")}
       ${recommendations(reply.toConfirm, reply.details, byId, "To confirm with the organiser")}
      </div></article>`,
    )
    .join("");
  const prompts = starters
    .map(
      (prompt) =>
        `<button type="button" data-prompt="${e(prompt)}">${e(prompt)} ${icon("next", 15)}</button>`,
    )
    .join("");
  return `<section class="chat-page"><header class="chat-header">
    <div class="chat-mark">${icon("chat", 26)}</div><h1>Ask the role finder</h1>
    <p>Tell me what you’d like to do, when you’re free or what access you need. I’ll look through the demo roles with you.</p></header>
    ${selector}
    <p class="chat-disclosure" id="chat-disclosure">${e(disclosure)}</p>
    ${turns.length || pending ? '<div class="chat-tools"><button class="text-btn" data-restart-chat>Start a new chat</button></div>' : '<div class="chat-starters" aria-label="Example questions">' + prompts + "</div>"}
    <div class="chat-history">${messages}${pending ? `<article class="chat-turn"><p class="asked"><span class="sr">You asked: </span>${e(pending)}</p><div class="answered"><p role="status">Waiting for OpenAI…</p></div></article>` : ""}</div>
    ${error ? `<p class="chat-error" role="alert">${e(error)}</p>` : ""}
    <form id="chat-form" class="chat-composer"><label for="chat-input">${turns.length ? "Ask a follow-up" : "Your question"}</label>
      <div><input type="text" id="chat-input" name="message" maxlength="600" required placeholder="e.g. Can I help at weekends?" autocomplete="off" value="${e(draft)}" aria-describedby="chat-disclosure" ${pending ? "disabled" : ""}>
      ${pending ? '<button type="button" class="primary" data-cancel-chat>Cancel</button>' : `<button type="submit" class="primary">Ask ${icon("next", 16)}</button>`}</div>
      <small>Reloading clears the conversation from this tab.</small>
    </form></section>`;
}
