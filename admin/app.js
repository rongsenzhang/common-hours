import { matchOpportunities } from "../site/engine.js";
import { renderDesk } from "./desk-view.js";
import { renderEvidence } from "./research-view.js";
import { renderSemanticLab } from "./semantic-view.js";

const main = document.getElementById("main");
const status = document.getElementById("announcer");
const storageKey = "commonhours.staff.confirmed.v1";
let catalog, evaluation, questions, semantic, selectedCase;
function readConfirmed() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    return new Set(Array.isArray(saved) ? saved : []);
  } catch { return new Set(); }
}
const resolved = readConfirmed();

function gardenPreview() {
  const garden = catalog.opportunities.find(role => role.id === "garden-buddy");
  const reply = catalog.followUps.find(item => item.id === garden.id && item.field === "stepFree");
  const checked = reply && resolved.has(garden.id + ":" + reply.field);
  const effective = checked ? { ...garden, stepFree: reply.value } : garden;
  const groups = matchOpportunities([effective], { query: "allotment", time: "weekend", mode: "onsite", stepFree: true });
  const result = groups.matches.length ? "Matches" : groups.review.length ? "To confirm" : "No confirmed match";
  return `<section class="admin-preview"><p class="eyebrow">Coordinator preview</p><h1>Community garden buddy</h1>
    <p>The volunteer needs weekend allotment work at a venue with step-free access.</p>
    <dl><div><dt>Volunteer result</dt><dd>${result}</dd></div>
    <div><dt>Host evidence</dt><dd>${checked ? "Step-free access confirmed in this staff session." : "Step-free access awaits confirmation."}</dd></div></dl>
    <a class="secondary" href="#desk">Return to the coordinator desk</a></section>`;
}

function render() {
  const view = location.hash.slice(1);
  if (view === "main") return;
  const section = view === "desk" || view === "garden" ? "desk" : "evidence";
  document.querySelectorAll("nav a").forEach(link => {
    if (link.hash === "#" + section) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (view === "garden") main.innerHTML = gardenPreview();
  else if (section === "desk") main.innerHTML = renderDesk(catalog, resolved, questions);
  else {
    main.innerHTML = renderEvidence(evaluation, catalog, questions);
    const lab = document.createElement("div");
    lab.id = "semantic-lab";
    lab.innerHTML = renderSemanticLab(evaluation, catalog, semantic, selectedCase);
    main.querySelector(".research-benchmark").before(lab);
  }
}

document.addEventListener("change", event => {
  if (!event.target.matches("[data-semantic-case]")) return;
  selectedCase = event.target.value;
  document.getElementById("semantic-lab").innerHTML = renderSemanticLab(evaluation, catalog, semantic, selectedCase);
  main.querySelector("[data-semantic-case]").focus();
  status.textContent = "Query updated.";
});
document.addEventListener("click", event => {
  const action = event.target.closest("button")?.dataset;
  if (!action) return;
  if (action.demo === "garden") { location.hash = "garden"; return; }
  const key = action.resolve || action.undo;
  if (!key || !catalog.followUps.some(reply => reply.id + ":" + reply.field === key)) return;
  if (action.resolve) resolved.add(key);
  else resolved.delete(key);
  try { sessionStorage.setItem(storageKey, JSON.stringify([...resolved])); } catch {}
  render();
  const next = main.querySelector(`[data-${action.resolve ? "undo" : "resolve"}="${CSS.escape(key)}"]`);
  if (next) { next.closest("details").open = true; next.focus(); }
  status.textContent = action.resolve ? "Host reply applied in this staff session." : "Original listing restored.";
});
window.addEventListener("hashchange", () => {
  if (catalog) { render(); main.focus({ preventScroll: true }); }
});
async function read(name) {
  const response = await fetch("./data/" + name + ".json");
  if (!response.ok) throw new Error("Snapshot unavailable");
  return response.json();
}
try {
  [catalog, evaluation, questions, semantic] = await Promise.all(
    ["catalog", "evaluation", "host-questions", "semantic"].map(read)
  );
  render();
} catch {
  main.textContent = "The staff snapshot could not be opened. Reload to sign in again, or check the selected snapshot directory.";
}
