import { matchOpportunities } from "../site/engine.js";

const round = (value) => Math.round(value * 10000) / 10000;

export function semanticRank(roles, preferences, manifest, caseId) {
  const groups = { matches: [], review: [], excluded: [] };
  if (manifest?.status !== "ready" || manifest.provider !== "openai")
    return groups;
  const example = manifest.cases.find((item) => item.id === caseId);
  if (!example) return groups;
  const scores = new Map(
    example.scores
      .filter((row) => row.score >= manifest.cutoff)
      .map((row) => [row.roleId, row.score]),
  );
  const candidates = roles.filter((role) => scores.has(role.id));
  const gated = matchOpportunities(candidates, { ...preferences, query: "" });
  for (const [key, rows] of Object.entries(gated)) {
    for (const row of rows) {
      const score = scores.get(row.opportunity.id);
      const reason = `OpenAI embedding cosine ${score.toFixed(3)} for “${example.query}”.`;
      groups[key].push({ ...row, score, reasons: [...row.reasons, reason] });
    }
    groups[key].sort(
      (a, b) =>
        b.score - a.score || (a.opportunity.id < b.opportunity.id ? -1 : 1),
    );
  }
  return groups;
}

export function semanticMetrics(roles, evaluation, manifest) {
  if (manifest?.status !== "ready" || manifest.provider !== "openai")
    return null;
  const examples = new Map(manifest.cases.map((item) => [item.id, item]));
  const roleIds = new Set(roles.map((role) => role.id));
  const complete = evaluation.cases.every((c) => {
    const example = examples.get(c.id);
    return (
      example?.query === c.query &&
      example.scores.length === roleIds.size &&
      new Set(example.scores.map((row) => row.roleId)).size === roleIds.size &&
      example.scores.every(
        (row) => roleIds.has(row.roleId) && Number.isFinite(row.score),
      )
    );
  });
  if (!complete) return null;
  const metrics = {
    ndcgAt3: 0,
    hitAt3: 0,
    zeroAccuracy: 0,
    answerable: 0,
    noAnswer: 0,
    hits: 0,
    correctZero: 0,
    labelledRoutes: 0,
    correctRoutes: 0,
    routeRecall: 0,
  };
  const gain = (i) => 1 / Math.log2(i + 2);
  for (const item of evaluation.cases) {
    const result = semanticRank(roles, item.preferences, manifest, item.id);
    const top = result.matches.slice(0, 3).map((row) => row.opportunity.id);
    if (item.relevant.length) {
      metrics.answerable++;
      metrics.hits += Number(top.some((id) => item.relevant.includes(id)));
      const dcg = top.reduce(
        (sum, id, i) => sum + (item.relevant.includes(id) ? gain(i) : 0),
        0,
      );
      const ideal = item.relevant
        .slice(0, 3)
        .reduce((sum, _, i) => sum + gain(i), 0);
      metrics.ndcgAt3 += round(dcg / ideal);
    } else {
      metrics.noAnswer++;
      metrics.correctZero += Number(result.matches.length === 0);
    }
    for (const kind of ["review", "excluded"]) {
      const ids = new Set(result[kind].map((row) => row.opportunity.id));
      metrics.labelledRoutes += item[kind].length;
      metrics.correctRoutes += item[kind].filter((id) => ids.has(id)).length;
    }
  }
  metrics.ndcgAt3 = metrics.answerable
    ? round(metrics.ndcgAt3 / metrics.answerable)
    : null;
  metrics.hitAt3 = metrics.answerable
    ? round(metrics.hits / metrics.answerable)
    : null;
  metrics.zeroAccuracy = metrics.noAnswer
    ? round(metrics.correctZero / metrics.noAnswer)
    : null;
  metrics.routeRecall = metrics.labelledRoutes
    ? round(metrics.correctRoutes / metrics.labelledRoutes)
    : null;
  return metrics;
}
