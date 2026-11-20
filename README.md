# Common Hours

An independent application demonstrator for the intelligent volunteer management KTP between Nottingham Trent University and TeamKinetic. It lets a volunteer find an opportunity and a coordinator check the information behind a recommendation. The catalogue contains 15 fictional Greater Manchester roles from 10 fictional hosts.

**[Open the live demo](https://rongsenzhang.github.io/common-hours/) · [Try the coordinator walkthrough](https://rongsenzhang.github.io/common-hours/#desk) · [Inspect the research evidence](https://rongsenzhang.github.io/common-hours/#evidence)**

## A two-minute walkthrough

1. Open **Coordinator desk** and choose **View volunteer search**. The visitor wants allotment work at weekends and needs step-free access. The garden role appears under **To confirm**.
2. Return to the desk. Read the original session reference and fictional host reply. Confirm step-free access, then reopen the volunteer search. The same garden role now appears under **Matches**. Open its title to inspect its evidence.
3. Open **Evidence**. Compare the literal baseline with the hybrid ranker, inspect a failure, and try the OpenAI semantic comparison. Its release status and model are visible on the page. The original benchmark is fixed when you edit a listing in your browser.

The desk is a simulation. Confirmations and bookmarks are local to one browser. The prototype covers discovery and review, and does not enrol anyone with a real organisation.

## What the project demonstrates

| Area | Inspectable work |
| --- | --- |
| Product research | [Company, prior art and five alternatives](docs/market-research.md), including TeamKinetic’s existing work on conversational discovery |
| Architecture | [Technical route](docs/roadmap.md), Python ETL, SQLite schema, field-level source tracking and a static web application |
| Retrieval | [Model card](docs/model-card.md), the [shared ranking engine](site/engine.js), [judgements](fixtures/judgements.json) and [per-query evaluation](site/data/evaluation.json) |
| OpenAI | [Release integration](docs/ai.md). The trusted build can prepare constrained questions and semantic comparisons from synthetic records. Visitors do not need an account or a key. |
| Knowledge transfer | [Nine duties and all selection criteria](docs/role-evidence.md), [interview protocol, steering brief, teaching exercise and supervision guide](docs/field-workbook.md) |
| Software delivery | [Regression tests](tests/), [browser journey checks](qa/browser.cjs), [verification and Pages deployment](.github/workflows/deploy.yml), [versioned releases](https://github.com/rongsenzhang/common-hours/releases) |

## Findings from the fixed examples

For 17 queries with a relevant, feasible result, the hybrid retriever put a relevant role in the top three 16 times. The literal baseline did so 10 times. For 11 queries expected to return no confirmed match, each method correctly returned none nine times. “Walk dogs” still retrieved a litter walk. All 28 cases, including mismatches, are inspectable in the site.

The cases were authored for a small synthetic dataset. No volunteer recruitment, usability observation, placement outcome or partner sign-off is claimed. The [field workbook](docs/field-workbook.md) sets out how to test the assumptions with volunteers and coordinators.

## Run locally

Use Python 3.9 or later and Node.js 22 or later. The catalogue, core application and offline checks use the standard libraries. From the project root:

```sh
python3 pipeline/build.py
node pipeline/evaluate.mjs
python3 -E -s -m ai.build_questions
python3 -E -s -m ai.build_semantic
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.mjs
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000`. Generated SQLite lives in `.work/catalog.sqlite`. The repository includes the data required to explore the site immediately. To reproduce the optional browser check, install Playwright, install its Chromium browser and run `node qa/browser.cjs http://localhost:8000/`. See the [AI guide](docs/ai.md) for publish-time inference, fallback behaviour, model identifiers and secret configuration.

## Attribution

All host organisations, opportunities, replies and scenarios in the application are fictional. The garden scene is an AI-generated illustration. DM Sans and Instrument Serif are bundled with their SIL Open Font Licenses in [site/assets](site/assets/). External research sources are linked in the [research report](docs/market-research.md). Common Hours is an independent portfolio project. The partners have not endorsed or commissioned it.
