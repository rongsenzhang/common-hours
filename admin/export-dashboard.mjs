import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { alphabeticalCases, prettyPreferences } from "./queries.js";
import { semanticMetrics, semanticRank } from "./semantic.js";

const { values } = parseArgs({
  options: { "data-dir": { type: "string" }, output: { type: "string" } }
});
if (!values["data-dir"] || !values.output) {
  throw new Error("Use --data-dir DIR --output FILE.");
}
const data = async name => JSON.parse(await readFile(path.join(values["data-dir"], name + ".json"), "utf8"));
const [catalog, evaluation, semantic, questions] = await Promise.all(
  ["catalog", "evaluation", "semantic", "host-questions"].map(data)
);
const roles = catalog.opportunities;
const names = new Map(roles.map(role => [role.id, role.title]));
function md(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replace(/[\\|`*_[\]]/g, "\\$&").replace(/\s+/g, " ").trim();
}
const roleList = ids => ids.map(id => md(names.get(id) || id)).join(", ") || "None";
const metrics = semanticMetrics(roles, evaluation, semantic);
const sorted = alphabeticalCases(evaluation.cases);
const rows = ["# Common Hours staff dashboard", "",
  "Review the volunteer search benchmark and coordinator exercises for this release.",
  "", "[Open volunteer site](https://rongsenzhang.github.io/common-hours/) · [Staff console instructions](https://github.com/rongsenzhang/common-hours/blob/main/docs/admin.md)",
  "", "## Interactive console", "",
  "In this private repository, open **Code → Codespaces**. Start the console in its terminal with `python3 admin/serve.py --data-dir data`. Open port 8765 with **Private** visibility and sign in using the access code shown in that terminal.",
  "", "## Release benchmark", "",
  `${evaluation.caseCount} authored queries · ${evaluation.catalogSize} fictional opportunities. The tests use fixed relevance judgements.`,
  "", "| Method | Relevant in first three | Correct empty result | Correct review or exclusion |",
  "| --- | --- | --- | --- |"];
function totals(name, result) {
  return result ? `| ${name} | ${result.hits}/${result.answerable} | ${result.correctZero}/${result.noAnswer} | ${result.correctRoutes}/${result.labelledRoutes} |`
    : `| ${name} | Unavailable | Unavailable | Unavailable |`;
}
rows.push(totals("Keyword baseline", evaluation.methods.baseline), totals("Hybrid retrieval", evaluation.methods.hybrid),
  totals("OpenAI embeddings", metrics), "",
  `Embedding snapshot: ${md(semantic.status)}${semantic.model ? " · " + md(semantic.model) : ""}. Host question snapshot: ${md(questions.status)} · ${md(questions.provider)}.`,
  "", "## Benchmark queries A–Z", "");
for (const item of sorted) {
  rows.push(`- [${md(item.query)} · ${md(item.id)}](#${item.id.toLowerCase()})`);
}
rows.push("", "The v1.0 catalogue had no dog-walking role. Its hybrid finder incorrectly recommended a litter walk. [Inspect the frozen B22 regression](https://github.com/rongsenzhang/common-hours/blob/main/fixtures/history/v1.0-B22.json) · [Jump to the current dog-walking query](#b29).");
const outputs = result => [roleList(result.top3), roleList(result.review), roleList(result.excluded)].join(" | ");
for (const item of sorted) {
  rows.push("", "### " + item.id, "", "**" + md(item.query) + "**", "",
    "Selected conditions: " + md(prettyPreferences(item.preferences)) + ".", "", md(item.why), "", `Reference matches: ${roleList(item.relevant)}. For review: ${roleList(item.review)}. Conflicts: ${roleList(item.excluded)}.`,
    "", "| Method | First three confirmed | For review | Conflicts |", "| --- | --- | --- | --- |",
    `| Keyword baseline | ${outputs(item.baseline)} |`, `| Hybrid retrieval | ${outputs(item.hybrid)} |`);
  if (metrics) {
    const groups = semanticRank(roles, { ...item.preferences, query: item.query }, semantic, item.id);
    const ids = group => group.map(row => row.opportunity.id);
    rows.push(`| OpenAI embeddings | ${outputs({ top3: ids(groups.matches.slice(0, 3)), review: ids(groups.review), excluded: ids(groups.excluded) })} |`);
  } else {
    rows.push("| OpenAI embeddings | Unavailable | Unavailable | Unavailable |");
  }
}
await writeFile(values.output, rows.join("\n") + "\n", "utf8");
