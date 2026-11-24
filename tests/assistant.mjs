import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answerVolunteerQuestion as ask } from "../site/assistant.js";
import { inferActivity, topicTokens } from "../site/assistant-topics.js";

const roles = JSON.parse(
  readFileSync(new URL("../site/data/catalog.json", import.meta.url)),
).opportunities;
const ids = (result) => [...result.matches, ...result.toConfirm];

test("dog walking questions find real matching tasks, then refine the same topic", () => {
  const first = ask("Can you recommend some dog walking projects?", roles);
  assert.deepEqual(
    new Set(first.matches),
    new Set(["shelter-dog-walker", "neighbourhood-dog-walker"]),
  );
  const weekend = ask("Only weekends", roles, first.state);
  assert.deepEqual(weekend.matches, ["shelter-dog-walker"]);
  const weekday = ask("What about weekdays?", roles, weekend.state);
  assert.deepEqual(weekday.matches, ["neighbourhood-dog-walker"]);
  const remote = ask("Can I do it from home?", roles, weekday.state);
  assert.deepEqual(ids(remote), []);
  assert.equal(remote.state.preferences.time, "weekday");
  assert.equal(remote.state.preferences.mode, "remote");
  assert.equal(remote.state.preferences.query, first.state.preferences.query);
});

test("broad interests give genuine distinct alternatives, unlike an explicit activity", () => {
  assert.deepEqual(
    new Set(ask("I want to help with dogs", roles).matches),
    new Set([
      "shelter-dog-walker",
      "neighbourhood-dog-walker",
      "animal-supply-sorter",
    ]),
  );
  assert.deepEqual(
    new Set(ask("How can I help animals?", roles).matches),
    new Set([
      "shelter-dog-walker",
      "neighbourhood-dog-walker",
      "animal-supply-sorter",
    ]),
  );
  const first = ask("I would like to help with food.", roles);
  const next = ask("Show more options", roles, first.state);
  const last = ask("Show more options", roles, next.state);
  assert.equal(first.matches.length, 3);
  const shown = [...first.matches, ...next.matches, ...last.matches];
  assert.equal(shown.length, new Set(shown).size);
  assert.deepEqual(new Set(shown), new Set([
    "pantry-packer", "meal-cook", "recipe-copy-editor", "allergen-label-reader", "fruit-stall-steward",
    "food-parcel-packer", "community-cafe-host",
  ]));
  assert.deepEqual(ask("Show more options", roles, last.state).matches, []);
});

test("no records are invented and operating on the earlier catalogue reproduces abstention", () => {
  const before = roles.filter(
    (r) =>
      ![
        "shelter-dog-walker",
        "neighbourhood-dog-walker",
        "animal-supply-sorter",
        "cycle-workshop",
      ].includes(r.id),
  );
  assert.deepEqual(ids(ask("Can I walk dogs at weekends?", before)), []);
  for (const q of [
    "Help me walk cats",
    "I want to foster dogs",
    "Is there an astronomy club?",
    "I want to repair bicycles",
    "I want to groom dogs",
  ])
    assert.deepEqual(ids(ask(q, roles)), [], q);
  assert.deepEqual(ask("Can I collect litter by the river?", before).matches, [
    "river-walk",
  ]);
});

test("unknown access is labelled, corrected source facts change the result, conflicts stay excluded", () => {
  const q = "I’d like to grow vegetables and need step-free access";
  const unresolved = ask(q, roles);
  assert.deepEqual(
    ask("I like gardening and need step-free access.", roles).toConfirm,
    ["garden-buddy"],
  );
  assert.deepEqual(
    ask("I need step-free access", roles, ask("I like gardening", roles).state)
      .toConfirm,
    ["garden-buddy"],
  );
  assert.deepEqual(ask("我想周末做园艺，需要无台阶通道", roles).toConfirm, [
    "garden-buddy",
  ]);
  assert.deepEqual(unresolved.matches, []);
  assert.deepEqual(unresolved.toConfirm, ["garden-buddy"]);
  assert.match(unresolved.details["garden-buddy"], /confirm.*step-free/i);
  assert.deepEqual(
    ids(
      ask("Is the first role wheelchair accessible?", roles, unresolved.state),
    ),
    [],
  );
  const verified = roles.map((role) =>
    role.id === "garden-buddy" ? { ...role, stepFree: "yes" } : role,
  );
  assert.deepEqual(ask(q, verified).matches, ["garden-buddy"]);
  assert.deepEqual(
    ids(ask("Can I walk dogs on weekdays with step-free access?", roles)),
    [],
  );
});

test("locally fitted topic model handles a novel paraphrase and rejects unrelated questions", () => {
  assert.equal(
    inferActivity(topicTokens("sound out words with learners")),
    "reading",
  );
  assert.equal(inferActivity(topicTokens("astronomy club")), null);
  assert.deepEqual(
    ask("Can I help adults sound out words from home?", roles).matches,
    ["reading-partner"],
  );
});

test("pagination and ordinal answers use the remembered list without presenting new suggestions", () => {
  const first = ask("What can I do from home?", roles);
  assert.equal(ids(first).length, 3);
  const second = ask("Show more options", roles, first.state);
  assert.ok(ids(second).length > 0);
  assert.ok(ids(second).every((id) => !ids(first).includes(id)));
  const detail = ask("Tell me about the second role", roles, first.state);
  assert.deepEqual(ids(detail), [ids(first)[1]]);
  assert.match(detail.text, /listed tasks/i);
  assert.equal(typeof detail.details[ids(first)[1]], "string");
  const previous = structuredClone(first.state);
  ask("What about weekdays?", roles, first.state);
  assert.deepEqual(
    first.state,
    previous,
    "a follow-up must not mutate an earlier turn",
  );
});

test("unsupported personal conditions stay unresolved until a deliberate restart", () => {
  const start = ask("I want to walk dogs", roles);
  for (const q of [
    "I can only do Saturday mornings.",
    "I need a wheelchair-accessible toilet",
    "I do not want to work with dogs",
  ]) {
    const unresolved = ask(q, roles, start.state);
    assert.equal(unresolved.state.blocked, true);
    assert.match(unresolved.text, /start over/i);
    assert.deepEqual(ids(unresolved), []);
    for (const followup of [
      "What about weekends?",
      "Show more options",
      "What about the first one?",
    ]) {
      const response = ask(followup, roles, unresolved.state);
      assert.deepEqual(ids(response), []);
      assert.equal(response.state.blocked, true);
    }
    const reset = ask("Start over", roles, unresolved.state);
    assert.equal(reset.state.preferences.query, "");
    assert.deepEqual(
      ask("Can I walk dogs at weekends?", roles, reset.state).matches,
      ["shelter-dog-walker"],
    );
  }
});

test("common Chinese questions, a vague first prompt, fictional sign-up and the input limit", () => {
  const zh = ask("我想周末遛狗，有推荐吗？", roles);
  assert.deepEqual(zh.matches, ["shelter-dog-walker"]);
  assert.match(zh.text, /岗位/);
  assert.deepEqual(ask("工作日呢？", roles, zh.state).matches, [
    "neighbourhood-dog-walker",
  ]);
  assert.deepEqual(ids(ask("我想周末骑马，有推荐吗？", roles)), []);
  assert.deepEqual(ids(ask("What should I try?", roles)), []);
  assert.match(ask("Can I sign up?", roles).text, /fictional/i);
  assert.deepEqual(ids(ask("dog ".repeat(200), roles)), []);
});
