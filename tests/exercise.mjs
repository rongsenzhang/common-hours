import assert from "node:assert/strict";
import test from "node:test";
import {exerciseEvidence, exerciseProfile, exerciseRoles, matchExercise} from "../site/exercise-engine.js";

const ids = rows => rows.map(({role}) => role.id);
const access = "digital-access-buddy", facilitator = "digital-skills-facilitator";
const mentor = "youth-reading-mentor", forms = "form-filling-volunteer";
const food = "food-parcel-packer", cafe = "community-cafe-host", conversation = "conversation-partner";

test("the seven supplied listings preserve the strong, weaker, unresolved and conflicting outcomes in A and B", () => {
  assert.equal(exerciseRoles.length, 7);
  const a = matchExercise(exerciseProfile("A"));
  const b = matchExercise(exerciseProfile("B"));
  assert.deepEqual(exerciseProfile("B"), {...exerciseProfile("A"), mode: "in-person"});
  assert.deepEqual(ids(a.recommendations), [access, facilitator]);
  assert.deepEqual(a.recommendations.map(row => row.fit), ["Strong fit", "Partial fit"]);
  assert.deepEqual(ids(b.recommendations), [facilitator]);
  assert.equal(b.recommendations[0].fit, "Partial fit");
  assert.deepEqual(ids(a.excluded), [cafe, conversation]);
  assert.deepEqual(ids(b.excluded), [access, cafe, conversation]);
  for (const result of [a, b]) {
    assert.deepEqual(ids(result.pending), [mentor, forms]);
    assert.deepEqual(ids(result.other), [food]);
    assert.match(result.pending[0].reasons.join(" "), /verify.*clearance/i);
    assert.match(result.pending[1].reasons.join(" "), /Ask the host.*no distance/i);
    for (const entry of [...result.pending, ...result.excluded]) assert.equal(entry.points, null);
  }
  assert.deepEqual(ids(a.baseline), [access, food, facilitator]);
  assert.deepEqual(ids(b.baseline), [food, facilitator]);
});

test("matching looks at evidence in the activity, and reads participation mode from its own field", () => {
  const formRole = exerciseRoles.find(role => role.id === forms);
  assert.deepEqual(exerciseEvidence(formRole), {individual: "individually", digital: "online forms"});
  const online = matchExercise({...exerciseProfile(), mode: "online", maxMiles: 0});
  assert.deepEqual(ids(online.recommendations), [access]);
  assert.ok(ids(online.excluded).includes(forms));
  assert.equal(online.pending.length, 0);
  assert.deepEqual(exerciseEvidence(exerciseRoles.find(role => role.id === facilitator)),
    {individual: null, digital: "smartphone basics"});
});

test("a change of distance or clearance only admits supported opportunities; equal scores use source order", () => {
  const profile = {...exerciseProfile("B"), maxMiles: 5, clearance: "verified"};
  const b = matchExercise(profile);
  assert.deepEqual(ids(b.recommendations), [mentor, conversation, facilitator]);
  assert.deepEqual(ids(b.pending), [forms]);
  assert.ok(ids(matchExercise({...profile, maxMiles: 4.9}).excluded).includes(conversation));
  assert.ok(ids(matchExercise({...profile, clearance: "none"}).excluded).includes(mentor));
  assert.deepEqual(ids(matchExercise({...profile, days: ["Thu"], individual: true, digital: false}).recommendations),
    [mentor]);
});

test("the shortlist honours revised interests, no interests, revised time and days with no matching role", () => {
  const profile = exerciseProfile();
  const onlyDigital = matchExercise({...profile, individual: false});
  assert.deepEqual(onlyDigital.recommendations.map(row => row.fit), ["Strong fit", "Strong fit"]);
  const flexible = matchExercise({...profile, period: "any", clearance: "verified", individual: false, digital: false});
  assert.deepEqual(ids(flexible.recommendations), [access, cafe, mentor]);
  assert.deepEqual(ids(flexible.other), [food, facilitator]);
  assert.deepEqual(ids(flexible.baseline), ids(flexible.recommendations));
  const daytime = matchExercise({...profile, days: ["Tue"], period: "daytime", digital: false, individual: false});
  assert.deepEqual(ids(daytime.recommendations), [cafe]);
  for (const days of [[], ["Sat", "Sun"]]) {
    const none = matchExercise({...profile, days});
    assert.deepEqual(none.recommendations, []);
    assert.deepEqual(none.pending, []);
    assert.equal(none.excluded.length, exerciseRoles.length);
  }
});

test("invalid radius cannot turn missing data into a confirmed match, and case presets are independent", () => {
  for (const maxMiles of ["", null, -1, NaN, Infinity]) {
    assert.throws(() => matchExercise({...exerciseProfile(), maxMiles}), RangeError);
  }
  exerciseProfile().days.length = 0;
  assert.equal(exerciseProfile().days.length, 5);
});
