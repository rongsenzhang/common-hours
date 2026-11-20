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

export function renderChat(turns, roles) {
  const byId = new Map(roles.map((role) => [role.id, role]));
  const messages = turns
    .map(
      ({ input, reply }) =>
        `<article class="chat-turn"><p class="asked"><span class="sr">You asked: </span>${e(input)}</p>
      <div class="answered"><p class="chat-answer">${e(reply.text)}</p>
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
    ${turns.length ? '<div class="chat-tools"><button class="text-btn" data-restart-chat>Start a new chat</button></div>' : '<div class="chat-starters" aria-label="Example questions">' + prompts + "</div>"}
    <div class="chat-history">${messages}</div>
    <form id="chat-form" class="chat-composer"><label for="chat-input">${turns.length ? "Ask a follow-up" : "Your question"}</label>
      <div><input type="text" id="chat-input" name="message" maxlength="600" required placeholder="e.g. Can I help at weekends?" autocomplete="off">
      <button type="submit" class="primary">Ask ${icon("next", 16)}</button></div>
      <small>Conversations stay in this tab and clear when you reload.</small>
    </form></section>`;
}
