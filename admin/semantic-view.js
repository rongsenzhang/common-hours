import { matchOpportunities } from "../site/engine.js";
import { alphabeticalCases, prettyPreferences } from "./queries.js";
import { semanticMetrics, semanticRank } from "./semantic.js";

function escapeText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (letter) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        letter
      ],
  );
}

function scoreList(groups, label, unavailable) {
  if (unavailable)
    return `<p class="semantic-empty">${escapeText(unavailable)}</p>`;
  const top = groups.matches.slice(0, 3);
  const items = top
    .map(
      (row) =>
        `<li><span>${escapeText(row.opportunity.title)}</span><strong>${row.score.toFixed(3)}</strong></li>`,
    )
    .join("");
  const ranks = top.length
    ? `<ol class="semantic-ranks" aria-label="${label} confirmed results and scores">${items}</ol>`
    : '<p class="semantic-empty">No confirmed role returned.</p>';
  return `${ranks}<p class="semantic-routes">${groups.review.length} for review · ${groups.excluded.length} conflicting</p>`;
}

function metricTable(hybrid, embeddings) {
  const rows = [
    ["Ranking quality", "nDCG@3", (method) => method.ndcgAt3.toFixed(4)],
    [
      "A relevant role in the first three",
      "Answerable cases",
      (method) => `${method.hits} / ${method.answerable}`,
    ],
    [
      "Correct empty result",
      "No-answer cases",
      (method) => `${method.correctZero} / ${method.noAnswer}`,
    ],
    [
      "Correct review or exclusion",
      "Labelled routing checks",
      (method) => `${method.correctRoutes} / ${method.labelledRoutes}`,
    ],
  ];
  return `<table class="semantic-measures"><caption>Results across all labelled queries</caption><thead><tr>
    <th scope="col">Measure</th><th scope="col">Hybrid</th><th scope="col">Embeddings</th></tr></thead><tbody>
    ${rows
      .map(
        ([
          label,
          detail,
          value,
        ]) => `<tr><th scope="row">${label}<small>${detail}</small></th>
      <td>${value(hybrid)}</td><td>${embeddings ? value(embeddings) : "Unavailable"}</td></tr>`,
      )
      .join("")}
    </tbody></table>`;
}

export function renderSemanticLab(
  evaluation,
  catalog,
  semantic,
  caseId,
) {
  const sorted = alphabeticalCases(evaluation.cases);
  const item = sorted.find((row) => row.id === caseId) || sorted[0];
  if (!item) return "";
  const roles = catalog.opportunities;
  const prefs = { ...item.preferences, query: item.query };
  const hybrid = matchOpportunities(roles, prefs, "hybrid");
  const published =
    semantic?.provider === "openai" && semantic?.status === "ready";
  const cached = published
    ? semantic.cases?.find((row) => row.id === item.id)
    : undefined;
  const embeddings = cached
    ? semanticRank(roles, prefs, semantic, item.id)
    : null;
  const strongest = cached?.scores?.reduce(
    (best, row) =>
      Number.isFinite(row.score) && (!best || row.score > best.score)
        ? row
        : best,
    null,
  );
  const closestRole =
    strongest && roles.find((role) => role.id === strongest.roleId);
  const aggregate = published
    ? semanticMetrics(roles, evaluation, semantic)
    : null;
  const cutoff = Number.isFinite(semantic?.cutoff) ? semantic.cutoff : 0.32;
  const unavailable =
    semantic?.status === "fallback"
      ? "The release run used its fallback. Embedding scores are unavailable."
      : published
        ? "This query has no published embedding scores."
        : "Embedding scores have yet to be published for this release.";
  const options = sorted
    .map(
      (row) =>
        `<option value="${escapeText(row.id)}"${row.id === item.id ? " selected" : ""}>${escapeText(row.query)} · ${escapeText(row.id)}</option>`,
    )
    .join("");
  const approach = published
    ? `<p class="semantic-provenance">OpenAI · ${escapeText(semantic.model || "Model unspecified")}</p>`
    : "";
  return `<section class="semantic-lab" aria-labelledby="semantic-title">
    <header class="semantic-intro"><div><h2 id="semantic-title">Embedding <em>comparison</em></h2>
      <p>Try the same published query with concept-aware hybrid retrieval and OpenAI text embeddings. Each method applies the same practical requirements.</p>
    </div>${approach}</header>
    <div class="semantic-input"><label for="semantic-case">Benchmark query (A–Z)</label>
      <select id="semantic-case" data-semantic-case>${options}</select></div>
    <p class="semantic-reference"><strong>Selected conditions</strong> · ${escapeText(prettyPreferences(item.preferences))}</p>
    <p class="semantic-reference"><strong>Reference judgement</strong> · ${escapeText(item.why)}</p>
    <div class="semantic-columns">
      <section class="semantic-method"><h3>Hybrid retrieval</h3>
        <p class="semantic-definition">Word and concept similarity</p>
        ${scoreList(hybrid, "Hybrid", "")}</section>
      <section class="semantic-method semantic-model"><h3>OpenAI embeddings</h3>
        <p class="semantic-definition">Cosine similarity · cut-off ${cutoff.toFixed(2)}</p>
        ${scoreList(embeddings, "Embedding", embeddings ? "" : unavailable)}
        ${closestRole ? `<p class="semantic-closest">Highest cosine before eligibility checks · ${escapeText(closestRole.title)} (${strongest.score.toFixed(3)})</p>` : ""}</section>
    </div>
    <details class="semantic-about"><summary>Benchmark totals and method</summary>
      ${metricTable(evaluation.methods.hybrid, aggregate)}
      <p>The cosine cut-off of ${cutoff.toFixed(2)} was declared before the first API run. Each score orders text similarity within its own method. Numerical scores from the two methods use different scales.</p>
      <p>The release workflow computes embeddings for fictional listings and the fixed benchmark questions. This dashboard reads the saved scores. Volunteer searches run separately.</p>
      <a href="./data/semantic.json">Score file served by this release</a>
      · <a href="https://github.com/rongsenzhang/common-hours/blob/main/admin/semantic.js">Scoring implementation <span aria-hidden="true">↗</span></a>
    </details></section>`;
}
