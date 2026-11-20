import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {semanticMetrics, semanticRank} from '../admin/semantic.js';

const {opportunities: catalogue} = JSON.parse(await readFile(new URL('../site/data/catalog.json', import.meta.url)));
const roles = catalogue.filter(r => ['garden-buddy', 'river-walk', 'seed-sorter'].includes(r.id));
const caseId = 'test-case';
const prefs = {stepFree: true};
const example = {id: caseId, query: 'garden', preferences: prefs, relevant: [], review: ['garden-buddy'], excluded: ['river-walk']};
const scores = roles.map(r => ({roleId: r.id, score: r.id === 'garden-buddy' ? 0.32 : r.id === 'river-walk' ? 0.7 : 0.319}));
const snapshot = {provider: 'openai', status: 'ready', cutoff: 0.32, cases: [{id: caseId, query: example.query, scores}]};

test('cosine threshold is inclusive and the same access gates route uncertain and conflicting cases', () => {
  const result = semanticRank(roles, prefs, snapshot, caseId);
  assert.equal(result.matches.length, 0);
  assert.deepEqual(result.review.map(r => [r.opportunity.id, r.score]), [['garden-buddy', 0.32]]);
  assert.deepEqual(result.excluded.map(r => [r.opportunity.id, r.score]), [['river-walk', 0.7]]);
  assert.ok(result.review[0].issues.some(i => i.field === 'stepFree'));
});

test('corrected source facts change the decision without changing semantic topic scores', () => {
  const corrected = roles.map(r => r.id === 'garden-buddy' ? {...r, stepFree: 'yes'} : r);
  const {matches} = semanticRank(corrected, prefs, snapshot, caseId);
  assert.deepEqual(matches.map(r => [r.opportunity.id, r.score]), [['garden-buddy', 0.32]]);
});

test('reports denominators, withholds unavailable metrics and never invents scores', () => {
  const evaluation = {cases: [example]};
  const metrics = semanticMetrics(roles, evaluation, snapshot);
  assert.equal(metrics.labelledRoutes, 2);
  assert.equal(metrics.routeRecall, 1);
  assert.equal(metrics.zeroAccuracy, 1);
  assert.equal(metrics.hitAt3, null);
  assert.equal(semanticMetrics(roles, evaluation, {status: 'fallback', provider: 'none'}), null);
  assert.equal(semanticMetrics(roles, {cases: [{...example, id: 'missing'}]}, snapshot), null);
  assert.deepEqual(semanticRank(roles, prefs, null, caseId), {matches: [], review: [], excluded: []});
});
