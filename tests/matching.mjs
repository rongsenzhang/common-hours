import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchOpportunities} from '../site/engine.js';

const data = JSON.parse(await readFile(new URL('../site/data/catalog.json', import.meta.url)));
const evaluation = JSON.parse(await readFile(new URL('../site/data/evaluation.json', import.meta.url)));
const ids = rows => rows.map(row => row.opportunity.id);
const search = (query, preferences = {}, method = 'hybrid', roles = data.opportunities) =>
  matchOpportunities(roles, {query, ...preferences}, method);

test('replays v1.0 B22 on the original catalogue and distinguishes new dog-walking roles', async () => {
  const archive = JSON.parse(await readFile(new URL('../fixtures/history/v1.0-B22.json', import.meta.url)));
  assert.deepEqual(archive.publishedHybridTop3, ['river-walk']);
  assert.deepEqual(archive.case.relevant, []);
  assert.equal(archive.opportunities.length, 15);
  assert.deepEqual(search(archive.case.query, {}, 'hybrid', archive.opportunities), {matches: [], review: [], excluded: []});

  const walkers = ['neighbourhood-dog-walker', 'shelter-dog-walker'];
  for (const query of ['walk dogs', 'pooch walking', 'I would like to walk a dog', 'take a dog for a stroll']) {
    assert.deepEqual(ids(search(query).matches).sort(), walkers, query);
  }
  assert.deepEqual(ids(search('litter walk').matches), ['river-walk']);
  assert.deepEqual(ids(search('sort donated blankets').matches), ['animal-supply-sorter']);
  // Removing both walkers leaves the near-miss supply sorter and litter walk, neither a valid substitute.
  const withoutWalkers = data.opportunities.filter((role) => !walkers.includes(role.id));
  assert.deepEqual(search('walking dogs', {}, 'hybrid', withoutWalkers), {matches: [], review: [], excluded: []});
});

test('compound activity requests need evidence of both action and object', () => {
  for (const query of ['walking horses', 'walk penguins in a park', 'groom dogs', 'sort batteries', 'train puppies']) {
    assert.deepEqual(search(query), {matches: [], review: [], excluded: []}, query);
  }
  const local = search('walk dogs', {time: 'weekend', stepFree: true});
  assert.deepEqual(ids(local.matches), ['shelter-dog-walker']);
  assert.deepEqual(ids(local.excluded), ['neighbourhood-dog-walker']);
  assert.deepEqual(local.excluded[0].issues.map(issue => issue.field), ['time', 'stepFree']);
  assert.deepEqual(ids(search('dog walking', {mode: 'remote'}).matches), []);
  assert.deepEqual(ids(search('rubbish', {stepFree: true}).excluded), ['river-walk']);
});

test('unknown access is reviewable until an evidence-backed correction is applied', () => {
  const prefs = {time: 'weekend', mode: 'onsite', stepFree: true};
  const queried = search('allotment', prefs);
  assert.deepEqual(ids(queried.review), ['garden-buddy']);
  assert.equal(queried.review[0].issues[0].field, 'stepFree');
  assert.equal(queried.matches.length, 0);
  const update = data.followUps.find(row => row.id === 'garden-buddy');
  const changed = data.opportunities.map(role => role.id === update.id ? {...role, [update.field]: update.value} : role);
  assert.equal(search('allotment', prefs, 'hybrid', changed).matches[0].opportunity.id, update.id);
  assert.equal(search('allotment', prefs).matches.length, 0);
});

test('time and mode sources are distinct and can be confirmed independently', () => {
  for (const [id, query, preferences] of [
    ['repair-cafe', 'repair', {time: 'weekend'}], ['phone-companion', 'telephone', {mode: 'remote', stepFree: true}],
  ]) {
    const update = data.followUps.find(row => row.id === id);
    assert.ok(ids(search(query, preferences).review).includes(id));
    const revised = data.opportunities.map(role => role.id === id ? {...role, [update.field]: update.value} : role);
    assert.ok(ids(search(query, preferences, 'hybrid', revised).matches).includes(id));
  }
});

test('a confirmed conflict outranks a different unresolved condition', () => {
  const result = search('garden', {time: 'weekday', stepFree: true});
  const row = result.excluded.find(row => row.opportunity.id === 'garden-buddy');
  assert.deepEqual(row.issues.map(issue => issue.status), ['conflict', 'unknown']);
  assert.ok(!ids(result.review).includes('garden-buddy'));
});

test('remote participation does not require a venue access assertion', () => {
  for (const id of ['poster-maker', 'archive-transcriber', 'reading-partner']) {
    assert.ok(ids(search('', {mode:'remote', stepFree:true}).matches).includes(id));
  }
  assert.ok(ids(search('litter', {stepFree:true}).excluded).includes('river-walk'));
});

test('a blank browse returns all fixtures while a nonempty query needs evidence', () => {
  assert.equal(search('   ').matches.length, data.opportunities.length);
  for (const query of ['astrophysics', 'help me', '!!']) {
    for (const method of ['baseline','hybrid']) {
      const result = search(query, {}, method);
      assert.deepEqual(result, {matches: [], review: [], excluded: []});
    }
  }
});

test('topic aliases and literal accent normalisation have inspectable evidence', () => {
  assert.equal(search('ornithology').matches[0].opportunity.id, 'wildlife-counter');
  assert.equal(search('ornithology', {}, 'baseline').matches.length, 0);
  assert.deepEqual(ids(search('ornithology').matches), ['wildlife-counter']);
  assert.ok(search('ornithology').matches[0].reasons.some(reason => reason.includes('tasks (“birds”)')));
  const cafes = ids(search('cafe', {}, 'baseline').matches);
  assert.deepEqual(cafes, ids(search('café', {}, 'baseline').matches));
  assert.deepEqual(new Set(cafes), new Set(['community-cafe-host', 'repair-cafe']));
});

test('rankings are independent of source order; scores are relative and bounded', () => {
  const result = search('digital arts');
  const reversed = search('digital arts', {}, 'hybrid', [...data.opportunities].reverse());
  assert.deepEqual(ids(result.matches), ids(reversed.matches));
  assert.ok(result.matches.every(row => row.score > 0 && row.score <= 1));
});

test('each opportunity and condition object appears once and shows only the matching category', () => {
  for (const mode of ['any', 'remote', 'onsite']) {
    for (const time of ['any', 'weekday', 'weekend']) {
      for (const stepFree of [true, false]) {
        const result = search('', {time, mode, stepFree});
        const everyId = Object.values(result).flatMap(ids);
        assert.equal(new Set(everyId).size, data.opportunities.length);
        assert.equal(everyId.length, data.opportunities.length);
        assert.ok(result.matches.every(row => row.issues.length === 0));
        assert.ok(result.review.every(row => row.issues.length && row.issues.every(i => i.status === 'unknown')));
        assert.ok(result.excluded.every(row => row.issues.some(i => i.status === 'conflict')));
      }
    }
  }
});

test('published benchmark top three matches the actual matcher on the judged catalogue for every case', () => {
  const judged = data.opportunities.filter(role => evaluation.roleIds.includes(role.id));
  assert.equal(judged.length, evaluation.catalogSize);
  for (const fixture of evaluation.cases) {
    for (const method of ['baseline','hybrid']) {
      const actual = search(fixture.query, fixture.preferences, method, judged);
      assert.deepEqual(ids(actual.matches).slice(0, 3), fixture[method].top3);
      assert.deepEqual(ids(actual.review), fixture[method].review);
      assert.deepEqual(ids(actual.excluded), fixture[method].excluded);
    }
  }
});
