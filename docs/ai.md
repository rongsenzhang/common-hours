# How Common Hours answers a question

## Volunteer questions

**Live AI** uses the OpenAI Responses API with [GPT-6.2 Astra](https://developers.openai.com/api/docs/models/gpt-6.2-astra) (`gpt-6.2-astra`). Each submitted message travels from GitHub Pages to our Cloudflare Worker with up to eight recent exchanges from the same conversation. By default the assistant searches 100 fictional community opportunities, including when you paste Case A and follow up with Case B. Each reply identifies the model returned by OpenAI. [Live questions](https://rongsenzhang.github.io/common-hours/#ask) · [Server implementation](../server/live.mjs)

To compare the same case with the recruitment task, select **Use the seven exercise roles** or ask “Use only the seven roles in the matching exercise.” Those seven listings come directly from the task and have their own activities, sessions and requirements. Live AI can use the current volunteer profile and the exercise matching rules to explain the result. To resume the wider search, ask “Search all 100 community roles again.” [Seven original task records](https://rongsenzhang.github.io/common-hours/#exercise-records)

The Worker checks role IDs, schedules, participation and step-free access against the catalogue before returning up to three general suggestions. For volunteer profiles it can also show up to three roles that need confirmation. A missing practical fact can send a role to **To confirm**. Visitors can ask about an exact start time, but the catalogue records days and time bands. The assistant directs them to ask the host. General conversational advice is generated text and can contain mistakes. The 36-query benchmark measures Finder retrieval on its original 19 judged listings. The separate live-provider checks exercise individual conversations. [Model card](model-card.md) · [Live checks](../qa/openai-live-smoke.mjs)

Someone who is unsure of their skills can start with a conversation. The assistant can ask a focused question about everyday experience, then use the answer and any later constraints when suggesting tasks. A case follow-up carries the checked profile (days, time band, mode, radius, clearance and preferences) alongside recent messages. For equally well evidenced opportunities the model can select a different order from Discover. Role explanations can link the visitor’s own wording to an excerpt from the listing. A volunteer's hard restrictions still decide which roles qualify.

The browser keeps this chat's history in memory. The Worker does not write messages or replies to storage, and sends `store: false` with every OpenAI request. OpenAI's own API data controls still apply. All visitors can use Live AI without a daily or per-network request quota. OpenAI bills these calls to the site owner and applies the account’s provider limits. **On-device search** keeps its conversations separate, processes messages in the tab and can be selected when the live service is busy. [OpenAI data controls](https://platform.openai.com/docs/guides/your-data) · [On-device classifier](../site/assistant-topics.js)

## Publishing live chat

GitHub repository secrets `OPENAI_API_KEY` and `CLOUDFLARE_API_TOKEN` are read by the trusted main-branch publication workflow. Set the repository variable `CLOUDFLARE_ACCOUNT_ID` to select the hosting account. The workflow deploys the API key as an encrypted Worker secret and checks a real reply from the public endpoint before packaging its URL into Pages. Browser assets contain the endpoint URL. A release failure leaves the last published Pages site available. Rerun the publication workflow after changing the provider key or renewing the deployment token. [Deployment code](../release/deploy-chat.py) · [Workflow](../.github/workflows/deploy.yml)

## OpenAI during release

In addition to live chat verification, the release job can make two build-time calls to OpenAI using the Actions secret `OPENAI_API_KEY`. Both requests use authored, fictional inputs. The public package contains volunteer-facing facts and resolved question wording. The staff snapshot contains the provider metadata, technical evidence and benchmark scores. [Workflow](../.github/workflows/deploy.yml) · [Public packager](../pipeline/package_public.py) · [Staff guide](admin.md)

### Semantic comparison

The builder sends 19 fictional opportunity descriptions and 36 fixed query strings in one embedding batch. Role descriptions include titles, tasks, interests, summaries, organisations and areas. The relevance labels, eligibility fields, host replies and visitor searches stay outside the request. After checking the model identity, dimensions, indices and numeric values, the builder computes up to 684 query–role cosine scores. It discards the raw vectors. The exploratory cutoff remains 0.32 inclusive, inherited from the v1.0 experiment. Passing that cutoff qualifies a role for the separate schedule, participation and access checks. [Embedding builder](../ai/build_semantic.py) · [Staff comparison](../admin/semantic.js)

Open the signed-in staff dashboard to inspect queries in alphabetical order. Its `data/semantic.json` records the provider, status and scores for that release. A complete OpenAI batch has `provider: openai` and `status: ready`. Without a key, or when a batch fails validation, the build includes empty scores and the comparison reports the model as unavailable. The fallback file in the source checkout is reproducible offline. [Dashboard operations](admin.md)

The historical [v1.0 release](https://github.com/rongsenzhang/common-hours/releases/tag/v1.0.0) ran 28 queries against 15 roles, producing 420 comparisons on that catalogue. Its technical evidence was part of the original public demonstration. The v1.1 Pages distribution excludes the staff dashboard and semantic manifest. A result on either synthetic catalogue describes only that version and its authored queries.

### Suggested wording for a host

A separate call to the Responses API proposes wording for missing fields in the current catalogue. A pinned GPT-5.4 mini snapshot selects an opening and focus from a reviewed set. The request includes only the role title, tasks, affected field and recorded mode. The builder validates the allowed choices, coverage of the expected gaps and source references, then assembles each question. For example, a missing access detail on the garden role results in a question about the route to the activity area. The host still needs to provide the answer. [Question builder](../ai/build_questions.py) · [Validation tests](../tests/test_ai_questions.py)

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

On a trusted publication run, verification occurs before model generation. Only the deployment and provider steps receive the credentials they use. The private mirror step receives its own deployment credential. A new key takes effect on the next trusted publish run. Use the full private snapshot to establish what that run produced. [Release workflow](../.github/workflows/deploy.yml) · [Staff publication](../release/publish-admin.sh)
