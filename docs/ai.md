# How Common Hours answers a question

## Volunteer questions

A visitor can ask for an activity and then refine time, participation mode or step-free access. The browser classifies the activity against short, labelled descriptions and checks the requested conditions against the published role facts. It can return confirmed matches, flag a field for host confirmation, ask for clarification or explain an empty result. Role cards link to the facts used in the recommendation. The conversation stays in browser memory for the current visit. The public assistant makes no per-message call to OpenAI. [Ask](https://rongsenzhang.github.io/common-hours/#ask) · [Local classifier](../site/assistant-topics.js) · [Conversation logic](../site/assistant.js)

The assistant covers supported English questions and selected Chinese phrases. Specific claims about an unlisted requirement need a host's answer. Separate regression cases exercise language parsing, unsupported requests, follow-ups and source-grounded answers. The staff benchmark measures Finder retrieval on its own set of fixed queries. [Tests](../tests/) · [Model card](model-card.md)

## OpenAI during release

The verified release job can call OpenAI twice using the Actions secret `OPENAI_API_KEY`. Both requests use authored, fictional inputs. The public package contains volunteer-facing facts and resolved question wording. The staff snapshot contains the provider metadata, technical evidence and benchmark scores. [Workflow](../.github/workflows/deploy.yml) · [Public packager](../pipeline/package_public.py) · [Staff guide](admin.md)

### Semantic comparison

The builder sends 19 fictional opportunity descriptions and 36 fixed query strings in one embedding batch. Role descriptions include titles, tasks, interests, summaries, organisations and areas. The relevance labels, eligibility fields, host replies and visitor searches stay outside the request. After checking the model identity, dimensions, indices and numeric values, the builder computes up to 684 query–role cosine scores. It discards the raw vectors. The exploratory cutoff remains 0.32 inclusive, inherited from the v1.0 experiment. Passing that cutoff qualifies a role for the separate schedule, participation and access checks. [Embedding builder](../ai/build_semantic.py) · [Staff comparison](../admin/semantic.js)

Open the signed-in staff dashboard to inspect queries in alphabetical order. Its `data/semantic.json` records the provider, status and scores for that release. A complete OpenAI batch has `provider: openai` and `status: ready`. Without a key, or when a batch fails validation, the build includes empty scores and the comparison reports the model as unavailable. The fallback file in the source checkout is reproducible offline. [Dashboard operations](admin.md)

The historical [v1.0 release](https://github.com/rongsenzhang/common-hours/releases/tag/v1.0.0) ran 28 queries against 15 roles, producing 420 comparisons on that catalogue. Its technical evidence was part of the original public demonstration. The v1.1 Pages distribution excludes the staff dashboard and semantic manifest. A result on either synthetic catalogue describes only that version and its authored queries.

### Suggested wording for a host

A separate call to the Responses API proposes wording for the five missing fields in the current catalogue. A pinned GPT-5.4 mini snapshot selects an opening and focus from a reviewed set. The request includes only the role title, tasks, affected field and recorded mode. The builder validates the allowed choices, coverage of the expected gaps and source references, then assembles each question. For example, a missing access detail on the garden role results in a question about the route to the activity area. The host still needs to provide the answer. [Question builder](../ai/build_questions.py) · [Validation tests](../tests/test_ai_questions.py)

In the private `data/host-questions.json`, `openai / ready` identifies a successful model-assisted release. `curated / unconfigured` identifies the offline edition, and `curated / fallback` identifies a release that used the reviewed defaults after a service or validation problem. The public file exposes only the role identifier, field and wording.

## Reproduce and inspect

From the source repository, build the offline research inputs and run the tests.

```sh
python3 pipeline/build.py
node pipeline/evaluate.mjs
python3 -E -s -m ai.build_questions
python3 -E -s -m ai.build_semantic
python3 -m unittest discover -s tests -p 'test_ai*.py'
node --test tests/*.mjs
```

On a trusted publication run, verification occurs before model generation. The job scopes the secret to its OpenAI step and passes a separate deployment credential to the private mirror step. A new key takes effect on the next trusted publish run. Use the full private snapshot to establish what that run produced. [Release workflow](../.github/workflows/deploy.yml) · [Staff publication](../release/publish-admin.sh)
