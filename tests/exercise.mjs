import assert from "node:assert/strict";
import test from "node:test";
import {
  checkExerciseRequirements, exerciseEvidence, exerciseLanguageExamples,
  exerciseProfile, exerciseRoles, matchExercise,
} from "../site/exercise-engine.js";

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

test("the hypothetical venue distance changes only the form-filling role and leaves both source cases intact", () => {
  const source = structuredClone(exerciseRoles);
  for (const caseId of ["A", "B"]) {
    const profile = exerciseProfile(caseId);
    const original = matchExercise(profile);
    assert.deepEqual(matchExercise(profile, {formFillingMiles: null}), original);
    const nearby = matchExercise(profile, {formFillingMiles: 2});
    const distant = matchExercise(profile, {formFillingMiles: 5});
    const nearbyTitles = caseId === "A" ? [access, forms, facilitator] : [forms, facilitator];
    assert.deepEqual(ids(nearby.recommendations), nearbyTitles);
    assert.deepEqual(ids(nearby.pending), [mentor]);
    assert.deepEqual(ids(distant.recommendations), ids(original.recommendations));
    assert.deepEqual(ids(distant.pending), [mentor]);
    assert.deepEqual(ids(distant.excluded).filter(id => id !== forms), ids(original.excluded));
    assert.deepEqual(ids(nearby.other), ids(original.other));
    const near = nearby.recommendations.find(row => row.role.id === forms);
    assert.equal(near.points, 2);
    assert.match(near.reasons.join(" "), /hypothetical.*2 miles.*within.*3-mile/i);
    assert.match(distant.excluded.find(row => row.role.id === forms).reasons.join(" "), /hypothetical.*5 miles.*beyond.*3-mile/i);
    assert.equal(near.role.whenWhere, "Thu evening · in person, distance not recorded");
    assert.ok(ids(nearby.baseline).includes(forms));
    assert.ok(!ids(distant.baseline).includes(forms));
    assert.deepEqual(profile, exerciseProfile(caseId));
    assert.deepEqual(matchExercise(profile), original);
  }
  assert.deepEqual(exerciseRoles, source);
});

test("a hypothetical distance honours the inclusive boundary, participation and timing", () => {
  const b = exerciseProfile("B");
  for (const miles of [2, 5]) {
    const options = {formFillingMiles: miles};
    assert.ok(ids(matchExercise({...b, maxMiles: miles}, options).recommendations).includes(forms));
    assert.ok(ids(matchExercise({...b, maxMiles: miles - 0.1}, options).excluded).includes(forms));
    assert.ok(ids(matchExercise({...b, mode: "online"}, options).excluded).includes(forms));
    assert.ok(ids(matchExercise({...b, days: ["Mon"]}, options).excluded).includes(forms));
  }
  for (const invalid of ["2", 0, 3, -1, Infinity]) {
    assert.throws(() => matchExercise(b, {formFillingMiles: invalid}), RangeError);
  }
});

test("independent wording probes preserve the original evidence span and reject counterexamples", () => {
  assert.equal(exerciseLanguageExamples.length, 6);
  for (const example of exerciseLanguageExamples) {
    const actual = exerciseEvidence({activity: example.text});
    for (const key of ["individual", "digital"]) {
      assert.equal(Boolean(actual[key]), example[key], `${key}: ${example.text}`);
      if (actual[key]) assert.ok(example.text.includes(actual[key]));
    }
  }
  assert.deepEqual(exerciseEvidence({activity: exerciseLanguageExamples[0].text}),
    {individual: "one-to-one", digital: "use their phone"});
  assert.deepEqual(exerciseEvidence({activity: "Pack boxes individually and record your own hours online."}),
    {individual: null, digital: null});
  assert.deepEqual(exerciseEvidence({activity: "Volunteers use their phone to help pack parcels."}),
    {individual: null, digital: null});
  assert.deepEqual(exerciseEvidence({activity: "Show adults how to complete forms online in one-on-one sessions."}),
    {individual: "one-on-one", digital: "forms online"});
  assert.deepEqual(exerciseEvidence({activity: "One-to-one support is not available. Teach a group smartphone basics."}),
    {individual: null, digital: "smartphone basics"});
  assert.deepEqual(exerciseEvidence({activity: "No online forms, but help adults individually to practise reading."}),
    {individual: "individually", digital: null});
});

test("eligibility wording is independent of skill tags, and unfamiliar requirements prompt a human check", () => {
  const template = exerciseRoles.find(role => role.id === mentor);
  const profile = exerciseProfile("B");
  for (const text of ["Verified safeguarding clearance", "Safeguarding clearance must be verified."]) {
    const role = {...template, requirement: text};
    assert.match(checkExerciseRequirements(role, profile).checks.join(" "), /verify.*clearance/i);
    assert.equal(checkExerciseRequirements(role, {...profile, clearance: "none"}).conflicts.length, 1);
    assert.equal(checkExerciseRequirements(role, {...profile, clearance: "verified"}).checks.length, 0);
  }
  assert.equal(checkExerciseRequirements({...template, requirement: "None listed"}, profile).checks.length, 0);
  for (const requirement of ["", null, "Driving licence and induction", "Verified safeguarding clearance and photo ID"]) {
    const role = {...template, requirement};
    const checked = checkExerciseRequirements(role, {...profile, clearance: "verified"});
    assert.match(checked.checks.join(" "), /clarify the role’s requirement/i);
  }
});
