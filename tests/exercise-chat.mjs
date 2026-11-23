import assert from "node:assert/strict";
import test from "node:test";
import {askExercise, isExerciseChatRequest, isSuppliedExerciseCase} from "../site/exercise-chat.js";
import {EXERCISE_CASE_TEXT, exerciseProfile, matchExercise} from "../site/exercise-engine.js";

const {A, B} = EXERCISE_CASE_TEXT;
const ids = items => items.map(row => row.role.id);

test("both supplied prompts, pasted headings and shortcuts run the matching exercise with the original inputs", () => {
  for (const [id, prompt, title] of [["A", A, "Online or in person"], ["B", B, "In person only"]]) {
    for (const input of [prompt, "Case " + id, "Run Case " + id, "Load Case " + id,
      "Case " + id + " · " + title + "\n“" + prompt + "”", prompt.replaceAll("’", "'").replaceAll(". ", ".\n")]) {
      assert.equal(isSuppliedExerciseCase(input), true, input);
      assert.equal(isExerciseChatRequest(input), true, input);
      const answer = askExercise(input);
      assert.deepEqual(answer.state, {profile: exerciseProfile(id), formFillingMiles: null}, input);
      assert.deepEqual(answer.result, matchExercise(exerciseProfile(id)), input);
      assert.match(answer.reply, /supplied/i);
    }
  }
});

test("a full rephrasing and an edited copied prompt use stated constraints", () => {
  const rest = "I prefer helping people individually, ideally using my digital skills. I'm free on weekday evenings. I can travel up to 3 miles. I'm unsure whether my safeguarding clearance is valid for this role.";
  for (const [id, mode] of [["A", "I can volunteer online or in person."], ["B", "I can only volunteer in person."]]) {
    assert.deepEqual(askExercise(mode + " " + rest).result, matchExercise(exerciseProfile(id)));
  }
  const edit = A.replace("three miles", "five miles");
  assert.equal(isSuppliedExerciseCase(edit), false);
  assert.equal(isExerciseChatRequest(edit), true);
  const answer = askExercise(edit);
  assert.equal(answer.state.profile.maxMiles, 5);
  assert.deepEqual(answer.result, matchExercise({...exerciseProfile("A"), maxMiles: 5}));
});

test("the follow-up applies only in-person participation and retains previous edits", () => {
  const start = askExercise(A);
  const presetB = matchExercise(exerciseProfile("B"));
  for (const input of [B, "I can't volunteer online anymore.", "I can only volunteer in person now", "In person only."]) {
    assert.deepEqual(askExercise(input, start.state).result, presetB);
  }
  const travel = askExercise("My travel limit is 5 miles", start.state);
  const venue = askExercise("The form-filling venue is 2 miles away.", travel.state);
  const carried = askExercise(B, venue.state);
  assert.equal(carried.state.profile.maxMiles, 5);
  assert.equal(carried.state.formFillingMiles, 2);
  assert.deepEqual(carried.result, matchExercise({...exerciseProfile("B"), maxMiles: 5}, {formFillingMiles: 2}));
  assert.deepEqual(askExercise("Case B", carried.state).result, presetB);
  assert.deepEqual(start.state.profile, exerciseProfile("A"));
});

test("a venue simulation cannot overwrite the volunteer travel limit or the supplied listing", () => {
  const original = askExercise("Case B");
  const near = askExercise("The form-filling venue is 2 miles away", original.state);
  assert.equal(near.result.recommendations[0].role.id, "form-filling-volunteer");
  assert.match(near.reply, /number 1/);
  assert.match(near.result.recommendations[0].role.whenWhere, /distance not recorded/);
  const far = askExercise("The form-filling venue is 5 miles away", near.state);
  assert.match(far.reply, /beyond your 3-mile/i);
  assert.equal(far.state.profile.maxMiles, 3);
  assert.ok(ids(far.result.excluded).includes("form-filling-volunteer"));
  const reset = askExercise("The form-filling venue distance is unknown", far.state);
  assert.deepEqual(reset.result, original.result);
  const radius = askExercise("I can travel up to five miles.", reset.state);
  assert.ok(ids(radius.result.recommendations).includes("conversation-partner"));
  assert.ok(ids(radius.result.pending).includes("form-filling-volunteer"));
});

test("unsupported or conflicting conditions never produce a partial recommendation", () => {
  const start = askExercise("Case B").state;
  const remote = askExercise("Online only", start).state;
  const ambiguous = askExercise("Online is fine.", remote);
  assert.match(ambiguous.reply, /also attend in person/);
  assert.equal(ambiguous.result, null);
  assert.deepEqual(ambiguous.state, remote);
  for (const message of ["5 miles", "My travel limit is -5 miles", "My travel limit is 5 miles, and I need a wheelchair-accessible venue.",
    "Case A: I need a paid job", A + " I need a step-free venue.", "Case B but I want online and weekends.",
    "My travel limit is five miles, my travel limit is 3 miles.", "My safeguarding clearance is verified for some other role."]) {
    const answer = askExercise(message, start);
    assert.equal(answer.result, null, message);
    assert.deepEqual(answer.state, start);
  }
  for (const message of ["Food", "In person only", "", "The form-filling venue is 2 miles away"]) {
    const answer = askExercise(message);
    assert.equal(answer.state, null);
    assert.equal(answer.result, null);
  }
  assert.deepEqual(askExercise("Case A: in person only, my travel limit is 5 miles.").result,
    matchExercise({...exerciseProfile("B"), maxMiles: 5}));
});

test("automatic routing recognises the exercise without hijacking unrelated catalogue requests", () => {
  for (const text of ["Case A: I need a paid job", "Case B · In person only\nWhat about Saturdays?", A + " I need a step-free venue."]) {
    assert.equal(isSuppliedExerciseCase(text), false);
    assert.equal(isExerciseChatRequest(text), true);
  }
  for (const text of ["I can only volunteer in person", "In case a shift opens, call me", "I want to work in a café", "Five miles"]) {
    assert.equal(isExerciseChatRequest(text), false);
  }
});
