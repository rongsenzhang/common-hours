const repository = "https://github.com/rongsenzhang/common-hours/blob/main";
const methodNames = {
  baseline: "Keyword baseline",
  hybrid: "Hybrid retrieval",
};

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

function countLabel(n, singular, plural = singular + "s") {
  return `${n} ${n === 1 ? singular : plural}`;
}

function link(path, title) {
  return `<a href="${repository}/${path}">${escapeHtml(title)} <span aria-hidden="true">↗</span></a>`;
}

function roleList(ids, titles) {
  if (!ids.length) return '<span class="research-muted">None</span>';
  return ids.map((id) => escapeHtml(titles.get(id) || id)).join(" · ");
}

function prettyPreferences(preferences) {
  const time = { weekday: "Weekday", weekend: "Weekend", flexible: "Flexible" };
  const mode = {
    onsite: "At the venue",
    remote: "From home",
    hybrid: "Hybrid",
  };
  return (
    [
      time[preferences.time],
      mode[preferences.mode],
      preferences.stepFree ? "Step-free access required" : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Any time or setting"
  );
}

function resultList(ids, titles) {
  if (!ids.length) return '<p class="research-none">No confirmed result</p>';
  return `<ol class="research-result-list">${ids
    .map((id) => `<li>${escapeHtml(titles.get(id) || id)}</li>`)
    .join("")}</ol>`;
}

function caseEntry(item, titles) {
  const expected = item.relevant.length
    ? countLabel(item.relevant.length, "expected match", "expected matches")
    : "No confirmed match expected";
  const actual = Object.entries(methodNames)
    .map(([method, label]) => {
      const values = item[method];
      return `<section><h3>${label}</h3>
      <p class="research-output-label">First three confirmed</p>
      ${resultList(values.top3, titles)}
      <dl class="research-case-values">
        <div><dt>Returned</dt><dd>${countLabel(values.returnedCount, "confirmed match", "confirmed matches")}</dd></div>
        <div><dt>Needs confirmation</dt><dd>${roleList(values.review, titles)}</dd></div>
        <div><dt>Conflicts</dt><dd>${roleList(values.excluded, titles)}</dd></div>
      </dl></section>`;
    })
    .join("");
  return `<details class="research-case">
    <summary><span class="research-case-id">${escapeHtml(item.id)}</span>
      <span class="research-case-text">${escapeHtml(item.query)}</span>
      <span class="research-case-total">${escapeHtml(expected)}</span></summary>
    <div class="research-case-body"><p><b>Selected conditions</b> · ${escapeHtml(prettyPreferences(item.preferences))}</p>
      <p><b>Reference judgement</b> · ${escapeHtml(item.why)}</p>
      <dl class="research-reference">
        <div><dt>Relevant and confirmed</dt><dd>${roleList(item.relevant, titles)}</dd></div>
        <div><dt>Expected for review</dt><dd>${roleList(item.review, titles)}</dd></div>
        <div><dt>Expected conflict</dt><dd>${roleList(item.excluded, titles)}</dd></div>
      </dl>
      <div class="research-case-outputs">${actual}</div></div>
  </details>`;
}

function scoreBar(name, hits, count, style) {
  const width = count ? (100 * hits) / count : 0;
  return `<div class="research-bar-row"><div class="research-bar-caption"><span>${name}</span>
    <strong>${hits} <small>/ ${count}</small></strong></div>
    <div class="research-track" aria-hidden="true"><span class="${style}" style="width:${width.toFixed(2)}%"></span></div></div>`;
}

function methodNote(ai) {
  if (!ai || !Array.isArray(ai.questions))
    return "The release provenance for host questions is unavailable.";
  const active = ai?.provider === "openai" && ai?.status === "ready";
  const count = ai.questions.length;
  const model = active && ai.model ? ` (${escapeHtml(ai.model)})` : "";
  if (active)
    return `The release job used OpenAI${model} to select phrasing for ${countLabel(count, "host question")} from reviewed options. Questions are bundled with the site.`;
  const status =
    ai.status === "fallback"
      ? "The release job used its curated fallback."
      : "The optional OpenAI workflow was unconfigured for this release.";
  return `${status} The site bundles ${countLabel(count, "editorially curated host question")}.`;
}

export function renderEvidence(evaluation, catalog, ai) {
  const { baseline, hybrid } = evaluation.methods;
  const titles = new Map(
    catalog.opportunities.map((role) => [role.id, role.title]),
  );
  const garden = evaluation.cases.find((item) => item.id === "B07");
  const dog = evaluation.cases.find((item) => item.id === "B22");
  const cases = evaluation.cases
    .map((item) => caseEntry(item, titles))
    .join("");
  return `<div class="research-view">
    <header class="research-title">
      <h1>Search <em>evidence</em></h1>
      <p>How well does Common Hours find a relevant, feasible role?
        Compare two retrieval methods on ${evaluation.caseCount} authored queries and ${evaluation.catalogSize} fictional opportunities.</p>
    </header>
    <section class="research-benchmark" aria-labelledby="research-benchmark-title">
      <div class="research-score-card">
        <h2 id="research-benchmark-title">A relevant role in the <em>first three</em></h2>
        ${scoreBar("Hybrid retrieval", hybrid.hits, hybrid.answerable, "research-fill-hybrid")}
        ${scoreBar("Keyword baseline", baseline.hits, baseline.answerable, "research-fill-baseline")}
        <p>Each of these ${hybrid.answerable} queries has at least one eligible reference role.
          Both methods use the same catalogue and practical constraints.</p>
      </div>
      <div class="research-metrics">
        <table><caption>Benchmark measures</caption><thead><tr><th scope="col">Measure</th><th scope="col">Keyword</th><th scope="col">Hybrid</th></tr></thead>
        <tbody><tr><th scope="row">Ranking quality <small>nDCG@3 · ${hybrid.answerable} answerable cases</small></th>
          <td>${baseline.ndcgAt3.toFixed(4)}</td><td>${hybrid.ndcgAt3.toFixed(4)}</td></tr>
        <tr><th scope="row">Correct empty result <small>${hybrid.noAnswer} no-answer cases</small></th>
          <td>${baseline.correctZero} / ${baseline.noAnswer}</td><td>${hybrid.correctZero} / ${hybrid.noAnswer}</td></tr>
        <tr><th scope="row">Correct review or exclusion <small>${hybrid.labelledRoutes} labelled routing checks</small></th>
          <td>${baseline.correctRoutes} / ${baseline.labelledRoutes}</td><td>${hybrid.correctRoutes} / ${hybrid.labelledRoutes}</td></tr></tbody></table>
        <p>nDCG gives more credit for relevant roles near the top of the list. Its maximum value is 1.</p>
      </div>
    </section>
    <section class="research-examples" aria-labelledby="research-example-title">
      <div class="research-example"><span class="research-subtitle">Ranking example · ${garden.id}</span>
        <h2 id="research-example-title">“${escapeHtml(garden.query)}”</h2>
        <p>The concept vocabulary connects allotments with gardening. The reference judgement identifies the garden role as relevant.</p>
        <div class="research-ranking-example">
          <div><h3>Keyword baseline</h3>${resultList(garden.baseline.top3, titles)}</div>
          <div><h3>Hybrid retrieval</h3>${resultList(garden.hybrid.top3, titles)}</div>
        </div>
      </div>
      <div class="research-example research-failure"><span class="research-subtitle">Failure case · ${dog.id}</span>
        <h2>“${escapeHtml(dog.query)}”</h2>
        <p>Both methods return <strong>${escapeHtml(titles.get(dog.hybrid.top3[0]))}</strong> because the activity involves a walk. The catalogue contains no dog-walking role.</p>
        <p class="research-failure-action">An independent set of no-answer queries would help test when the finder should ask for clarification.</p>
      </div>
    </section>
    <details class="research-cases"><summary>Inspect all ${evaluation.caseCount} test cases</summary>
      <p>Open a query to compare the reference judgement, returned roles and the handling of missing or conflicting information.</p>
      <div>${cases}</div></details>
    <section class="research-methods" aria-label="Methods and evidence limits">
      <div><h2>What powers the finder?</h2>
        <p>Hybrid retrieval combines word similarity with a curated vocabulary. The browser checks selected time, setting and access requirements separately. Search terms stay in the browser.</p>
        <p>${methodNote(ai)} Host questions cannot change the ranking or confirm a listing fact.</p>
        ${link("docs/ai.md", "AI integration and provenance")}
      </div>
      <div><h2>What remains to test?</h2>
        <p>The listings and relevance judgements were authored for this prototype. Volunteers and coordinators have yet to validate these rankings, the time required to check a listing or the effect on participation.</p>
        <p>The field workbook includes interview prompts, a usability protocol, a steering brief and a teaching exercise.</p>
        ${link("docs/field-workbook.md", "Field and teaching workbook")}
      </div>
    </section>
    <section class="research-documents" aria-labelledby="research-docs-title"><h2 id="research-docs-title">Project documents</h2>
      <ul><li>${link("docs/model-card.md", "Model and evaluation report")}</li><li>${link("docs/market-research.md", "Company and market research")}</li>
        <li>${link("docs/roadmap.md", "Technical roadmap")}</li><li>${link("docs/role-evidence.md", "KTP role evidence")}</li>
        <li>${link("site/data/evaluation.json", "Full benchmark data")}</li><li>${link("fixtures/judgements.json", "Reference judgements")}</li></ul>
    </section></div>`;
}
