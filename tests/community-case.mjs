import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {communityCaseId, matchCommunityCase} from "../site/community-case.js";
import {exerciseProfile, EXERCISE_CASE_TEXT} from "../site/exercise-engine.js";

const {opportunities} = JSON.parse(readFileSync(new URL("../site/data/catalog.json", import.meta.url)));
const ids = rows => rows.map(row => row.role.id);
const sample = {
  id: "practice", title: "Practice", mode: "onsite", time: "weekday", stepFree: "yes",
  caseFacts: {slots: [{day:"Mon", period:"evening"}], distanceMiles: 3, clearance:"none-listed",
    individualEvidence:"Help one visitor",digitalEvidence:"Set up email"},
};
function match({role = {}, facts = {}, profile = {}} = {}) {
  const r = {...sample,...role,caseFacts:{...sample.caseFacts, ...facts}};
  return matchCommunityCase([r], {...exerciseProfile("A"), ...profile});
}

test("short labels and either complete original case resolve independently of previous input", () => {
  for (const id of ["A","B"]) {
    assert.equal(communityCaseId("case " + id.toLowerCase()), id);
    assert.equal(communityCaseId(EXERCISE_CASE_TEXT[id]), id);
    assert.equal(communityCaseId("Case " + id + "\n" + EXERCISE_CASE_TEXT[id]), id);
  }
  assert.equal(communityCaseId("Case B but I can now travel 15 miles"), null);
  assert.equal(communityCaseId("walking dogs"), null);
});

test("different datasets naturally produce different shortlists; switching off remote changes only the mode", () => {
  assert.equal(opportunities.length, 100);
  const a = matchCommunityCase(opportunities, exerciseProfile("A"));
  const b = matchCommunityCase(opportunities, exerciseProfile("B"));
  assert.deepEqual(ids(a.recommendations), ["email-practice-partner","bus-app-coach","video-call-coach"]);
  assert.deepEqual(ids(b.recommendations), ["bus-app-coach","writing-partner","patch-project-companion"]);
  assert.ok(b.pending.find(({role}) => role.id === "photo-transfer-tutor"));
  for (const set of [a,b]) {
    const allIds = Object.values(set).flatMap(ids);
    assert.equal(allIds.length, 100);
    assert.equal(new Set(allIds).size, 100);
  }
  const uncapped = matchCommunityCase(opportunities, exerciseProfile("B"), {limit: Infinity});
  assert.ok(uncapped.recommendations.length > 3);
  assert.deepEqual(ids(b.recommendations), ids(uncapped.recommendations.slice(0,3)));
});

test("distance is inclusive, missing distance requires confirmation and remote needs no venue", () => {
  assert.equal(match().recommendations.length, 1);
  assert.match(match({facts:{distanceMiles:3.1}}).excluded[0].reasons[0], /beyond/);
  assert.match(match({facts:{distanceMiles:null}}).pending[0].reasons[0], /distance/);
  assert.equal(match({role:{mode:"hybrid"},facts:{distanceMiles:5}}).recommendations.length, 1);
  assert.equal(match({role:{mode:"hybrid"},facts:{distanceMiles:5},profile:{mode:"in-person"}}).excluded.length, 1);
  assert.equal(match({role:{mode:"unknown"},facts:{distanceMiles:5}}).pending.length, 1);
  assert.equal(match({role:{mode:"remote",stepFree:"na"},facts:{distanceMiles:null},profile:{stepFree:true}}).recommendations.length, 1);
  assert.equal(match({role:{stepFree:"no"},profile:{stepFree:true}}).excluded.length, 1);
});

test("time checks both availability dimensions on the same session", () => {
  assert.equal(match({facts:{slots:[{day:"Mon",period:"daytime"},{day:"Sun",period:"evening"}]}}).excluded.length, 1);
  assert.equal(match({facts:{slots:[]}}).pending.length, 1);
  assert.equal(match({role:{time:"weekend"},facts:{slots:[]}}).excluded.length, 1);
});

test("safeguarding verification is role-specific and missing evidence never boosts a rank", () => {
  for (const clearance of ["required","unknown"])
    assert.equal(match({facts:{clearance}}).pending.length, 1);
  assert.equal(match({facts:{clearance:"required"},profile:{clearance:"none"}}).excluded.length, 1);
  assert.equal(match({facts:{clearance:"required"},profile:{clearance:"verified"}}).pending.length, 1);
  assert.equal(match({facts:{clearance:"required"},profile:{clearance:"verified",verifiedRoleId:"other"}}).pending.length, 1);
  assert.equal(match({facts:{clearance:"required"},profile:{clearance:"verified",verifiedRoleId:"practice"}}).recommendations.length, 1);
  assert.equal(match({facts:{digitalEvidence:null}}).recommendations[0].fit,"Partial fit");
  assert.equal(match({facts:{digitalEvidence:null,individualEvidence:null}}).other.length,1);
  assert.throws(() => match({profile:{maxMiles:-1}}), /conditions/);
});
