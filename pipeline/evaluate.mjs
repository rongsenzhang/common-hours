import { readFile, writeFile } from 'node:fs/promises';
import { matchOpportunities } from '../site/engine.js';

const load = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const cases = await load('../fixtures/judgements.json');
const catalog = await load('../site/data/catalog.json');
const catalogIds = new Set(catalog.opportunities.map(role => role.id));
const methods = ['baseline', 'hybrid'];
const resultCases = [];
const methodMetrics = {};

const round = n => Math.round(n * 10000) / 10000;
const gain = index => 1 / Math.log2(index + 2);
const ids = rows => rows.map(row => row.opportunity.id);

if (new Set(cases.map(item => item.id)).size !== cases.length) throw new Error('Duplicate case IDs.');
for (const fixture of cases) {
  const {id, query, preferences = {}, relevant, review = [], excluded = [], why} = fixture;
  const labels = [...relevant, ...review, ...excluded];
  if (labels.some(roleId => !catalogIds.has(roleId)) || labels.length !== new Set(labels).size) {
    throw new Error('Invalid labels in ' + id);
  }
  const record = {id, query, preferences, relevant, review, excluded, why};
  for (const method of methods) {
    const result = matchOpportunities(catalog.opportunities, {...preferences, query}, method);
    const top3 = ids(result.matches.slice(0, 3));
    const found = top3.filter(roleId => relevant.includes(roleId));
    const dcg = top3.reduce((sum, roleId, i) => sum + (relevant.includes(roleId) ? gain(i) : 0), 0);
    const ideal = relevant.slice(0, 3).reduce((sum, _, i) => sum + gain(i), 0);
    const reviewIds = ids(result.review);
    const excludedIds = ids(result.excluded);
    const routed = review.filter(roleId => reviewIds.includes(roleId)).length
      + excluded.filter(roleId => excludedIds.includes(roleId)).length;
    record[method] = {top3, review: reviewIds, excluded: excludedIds, returnedCount: result.matches.length,
      hitAt3: relevant.length ? Number(found.length > 0) : null,
      ndcgAt3: ideal ? round(dcg / ideal) : null,
      zeroCorrect: relevant.length ? null : Number(!result.matches.length),
      correctRoutes: routed, labelledRoutes: review.length + excluded.length};
  }
  resultCases.push(record);
}
for (const method of methods) {
  const answerable = resultCases.filter(c => c.relevant.length);
  const unanswerable = resultCases.filter(c => !c.relevant.length);
  const sum = (rows, field) => rows.reduce((total, row) => total + row[method][field], 0);
  const routes = sum(resultCases, 'labelledRoutes');
  methodMetrics[method] = {
    ndcgAt3: round(sum(answerable, 'ndcgAt3') / answerable.length),
    hitAt3: round(sum(answerable, 'hitAt3') / answerable.length),
    zeroAccuracy: round(sum(unanswerable, 'zeroCorrect') / unanswerable.length),
    answerable: answerable.length, noAnswer: unanswerable.length,
    hits: sum(answerable, 'hitAt3'), correctZero: sum(unanswerable, 'zeroCorrect'),
    labelledRoutes: routes, correctRoutes: sum(resultCases, 'correctRoutes'),
    routeRecall: round(sum(resultCases, 'correctRoutes') / routes),
  };
}
const output = {
  version: catalog.version, caseCount: cases.length, catalogSize: catalog.opportunities.length,
  methodology: 'Authored synthetic judgements on the current catalogue. Literal word coverage is compared with TF-IDF, a controlled vocabulary and activity/object checks. Both methods use the same schedule, access and participation checks. Archived B22 tests the original catalogue.',
  methods: methodMetrics, cases: resultCases,
};
await writeFile(new URL('../site/data/evaluation.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(methodMetrics, null, 2));
