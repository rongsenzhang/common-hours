import { icon } from "./icons.js";

const fields = {
  stepFree: {
    label: "Step-free access",
    symbol: "pin",
    question: "Is the route from the entrance to the activity step-free?",
  },
  time: {
    label: "Session time",
    symbol: "calendar",
    question: "Which days can a volunteer attend this session?",
  },
  mode: {
    label: "Participation mode",
    symbol: "people",
    question:
      "Can someone take part entirely from home, or is a venue visit required?",
  },
};
const values = {
  yes: "Step-free route confirmed",
  weekend: "Weekends confirmed",
  remote: "Fully remote participation confirmed",
};
function html(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

function collect(catalog, resolved) {
  const replies = new Map(
    catalog.followUps.map((item) => [item.id + ":" + item.field, item]),
  );
  const rows = [];
  for (const role of catalog.opportunities) {
    const confirmedMode = replies.get(role.id + ":mode");
    const mode =
      confirmedMode && resolved.has(role.id + ":mode")
        ? confirmedMode.value
        : role.mode;
    for (const [field, spec] of Object.entries(fields)) {
      const key = role.id + ":" + field;
      const reply = replies.get(key);
      if (field === "stepFree" && mode === "remote") continue;
      if (!reply && role[field] !== "unknown") continue;
      rows.push({
        role,
        field,
        spec,
        key,
        reply,
        confirmed: Boolean(reply && resolved.has(key)),
      });
    }
  }
  const gardenFirst = (row) => (row.key === "garden-buddy:stepFree" ? 0 : 1);
  return rows.sort(
    (a, b) =>
      gardenFirst(a) - gardenFirst(b) ||
      a.role.title.localeCompare(b.role.title),
  );
}

function record(row, expanded, draft) {
  const { role, field, spec, key, reply, confirmed } = row;
  const status = confirmed
    ? "Confirmed locally"
    : reply
      ? "Reply available"
      : "Awaiting host";
  const reading = confirmed ? values[reply.value] : "Unknown";
  const subtitle =
    '<p class="desk-meta">' +
    html(role.organisation) +
    " · " +
    html(role.area) +
    "</p>";
  const statusClass = confirmed ? "saved" : reply ? "ready" : "waiting";
  const source =
    "<div><dt>Original source</dt><dd><code>" +
    html(role.sources[field]) +
    "</code></dd></div>";
  const fact =
    "<div><dt>Current value</dt><dd>" + html(reading) + "</dd></div>";
  let evidence;
  if (reply) {
    evidence =
      '<div class="desk-note"><span class="desk-mini">' +
      icon("file", 15) +
      " Sample host reply</span><p>" +
      html(reply.note) +
      "</p><code>" +
      html(reply.source) +
      "</code></div>";
  } else {
    evidence =
      '<div class="desk-note desk-note-wait"><span class="desk-mini">' +
      icon("clock", 15) +
      " Awaiting evidence</span><p>" +
      html(role.contactNote) +
      " This exercise includes no host reply for this field.</p></div>";
  }
  const question =
    '<div class="desk-question"><h4>' +
    html(draft?.label ?? "Question for the host") +
    "</h4><p>" +
    html(draft?.text ?? spec.question) +
    "</p></div>";
  const action = confirmed
    ? '<button type="button" class="secondary" data-undo="' +
      html(key) +
      '" aria-label="Undo confirmation for ' +
      html(role.title) +
      ", " +
      html(spec.label) +
      '">Undo confirmation</button>'
    : reply
      ? '<button type="button" class="primary" data-resolve="' +
        html(key) +
        '" aria-label="Confirm ' +
        html(spec.label.toLowerCase()) +
        " for " +
        html(role.title) +
        '">' +
        icon("check", 16) +
        " Confirm " +
        html(spec.label.toLowerCase()) +
        "</button>"
      : '<span class="desk-remains">' +
        icon("info", 16) +
        " The field stays unknown.</span>";
  return (
    '<details class="desk-record" data-item="' +
    html(key) +
    '"' +
    (expanded ? " open" : "") +
    "><summary>" +
    '<span class="desk-field-icon">' +
    icon(spec.symbol, 21) +
    '</span><span class="desk-record-name"><strong>' +
    html(role.title) +
    "</strong><span>" +
    html(spec.label) +
    '</span></span><span class="desk-record-right"><span class="desk-state ' +
    statusClass +
    '">' +
    html(status) +
    "</span>" +
    icon("down", 17) +
    '</span></summary><div class="desk-record-body">' +
    subtitle +
    '<dl class="desk-facts">' +
    fact +
    source +
    "</dl>" +
    question +
    evidence +
    '<div class="desk-actions">' +
    action +
    "</div></div></details>"
  );
}

function section(title, rows, expandedKey, draftFor) {
  if (!rows.length) return "";
  return (
    '<section class="desk-section"><h3>' +
    html(title) +
    " <span>" +
    rows.length +
    "</span></h3>" +
    rows
      .map((row) => record(row, row.key === expandedKey, draftFor(row)))
      .join("") +
    "</section>"
  );
}

export function renderDesk(catalog, resolvedIds = new Set(), ai) {
  const rows = collect(catalog, resolvedIds);
  const available = rows.filter((row) => row.reply && !row.confirmed);
  const pending = rows.filter((row) => !row.reply);
  const confirmed = rows.filter((row) => row.confirmed);
  const gardenDone = resolvedIds.has("garden-buddy:stepFree");
  const draftFor = (row) => getDraft(ai, row);
  return (
    '<div class="desk-view"><header class="desk-intro"><div><p class="eyebrow">Coordinator workspace</p>' +
    '<h1>Coordinator desk</h1><p class="desk-lede">Check missing listing details against a fictional host’s reply before updating the volunteer’s results.</p></div>' +
    '<div class="desk-totals" aria-label="Review queue summary"><div><strong>' +
    available.length +
    "</strong><span>Ready to review</span></div><div><strong>" +
    pending.length +
    "</strong><span>Awaiting a reply</span></div><div><strong>" +
    confirmed.length +
    "</strong><span>Confirmed here</span></div></div></header>" +
    '<div class="desk-grid"><section class="desk-queue" aria-label="Listing review queue"><div class="desk-section-heading"><h2>Review queue</h2></div>' +
    section("Host replies", available, available[0]?.key, draftFor) +
    section("Awaiting a reply", pending, "", draftFor) +
    section("Confirmed in this browser", confirmed, "", draftFor) +
    "</section>" +
    '<aside class="desk-aside"><div class="desk-walkthrough"><span class="desk-aside-symbol">' +
    icon("sprout", 27) +
    "</span>" +
    '<p class="desk-mini">Try the garden example</p><h2>See what changes for a volunteer.</h2>' +
    "<p>Someone looking for allotment work can join at weekends and needs a step-free route to the beds.</p>" +
    "<p>" +
    (gardenDone
      ? "You confirmed the fictional host’s reply. The garden can now appear among their matches."
      : "The garden is waiting for an access check. Open the volunteer search, then return here to review the host’s reply.") +
    '</p><button type="button" class="secondary" data-demo="garden">View volunteer search ' +
    icon("next", 16) +
    "</button></div>" +
    '<div class="desk-local"><span>' +
    icon("info", 18) +
    "</span><p>Confirmations apply in this browser. You can undo a confirmation to restore the original listing.</p></div></aside></div></div>"
  );
}

function getDraft(ai, row) {
  const entry = ai?.questions?.find?.(
    (item) => item.roleId === row.role.id && item.field === row.field,
  );
  if (!entry?.question) return null;
  const generated = ai.provider === "openai" && ai.status === "ready";
  const label = generated
    ? "AI-drafted host question"
    : "Prepared host question";
  return { label, text: entry.question };
}
