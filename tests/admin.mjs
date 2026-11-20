import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { alphabeticalCases } from "../admin/queries.js";
import { renderSemanticLab } from "../admin/semantic-view.js";
import { renderEvidence } from "../admin/research-view.js";

const data = async name => JSON.parse(await readFile(new URL("../site/data/" + name + ".json", import.meta.url)));
const [catalog, evaluation, semantic] = await Promise.all(["catalog", "evaluation", "semantic"].map(data));

test("both benchmark controls show alphabetical query text and preserve case IDs", () => {
  const initial = evaluation.cases.map(entry => entry.id);
  const sorted = alphabeticalCases(evaluation.cases).map(entry => entry.id);
  assert.notDeepEqual(initial, sorted);
  const list = renderEvidence(evaluation, catalog);
  const menu = renderSemanticLab(evaluation, catalog, semantic, "B07");
  assert.deepEqual([...menu.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]), sorted);
  assert.deepEqual([...list.matchAll(/class="research-case-id">([^<]+)/g)].map(match => match[1]), sorted);
  assert.match(menu, /<option value="B07" selected>/);
  assert.deepEqual(evaluation.cases.map(entry => entry.id), initial);
});
test("equal query text orders by stable numeric ID", () => {
  const input = [{id:"B10", query:"walk"}, {id:"B09", query:"WALK"}, {id:"B51", query:"Allotment"}];
  assert.deepEqual(alphabeticalCases(input).map(row => row.id), ["B51","B09","B10"]);
});
