# OpenAI in the release

Common Hours runs two independent model calls during publication. One compares search examples with role descriptions. The other helps volunteers ask about missing details. The deployed files record the actual provider status for each call, so one can succeed when the other is unavailable.

## Compare opportunity search using embeddings

The build sends 15 synthetic opportunity descriptions and 28 fixed query examples in a single request to `text-embedding-3-small`. The role text includes title, description, activities, interests, organisation and area. Time, delivery mode and venue access stay in the rule-based checks. The request contains the authored query strings only from the judgement file. Relevance labels, explanations, volunteer searches and host follow-ups are excluded.

The API returns one 256-dimensional vector per input. The builder checks model identity, vector count, position, size and values. It computes cosine similarity between each query and role, rounds to six decimal places and publishes 420 scores. The cutoff of **0.32 inclusive** was fixed before the first model run. It is an exploratory threshold. Its value has received no tuning against these 28 cases. The website uses the same eligibility checks for the semantic and lexical methods. A coordinator can update a missing fact and see its effect without recomputing the topic score. A cosine score measures similarity between two texts. It does not estimate a person's probability of suitability or volunteering.

Open `data/semantic.json` beneath the deployed site's address. A successful batch records `provider: openai`, `status: ready`, the model name, dimension count and the scored examples. When the key is missing or a batch fails validation, the file keeps its list of examples with empty scores and reports `provider: none`. The website can still run the lexical searches. Browser calculations for nDCG@3, hit@3, correct empty results and routing recall use the original synthetic judgements and list their denominators. Exact queries can be replayed with changed constraints. New free-text queries use the browser matcher. [Embedding builder](../ai/build_semantic.py) · [Ranking and metrics](../site/semantic.js) · [Official embeddings API](https://developers.openai.com/api/reference/resources/embeddings/methods/create)

This small benchmark can reveal missed matches and unsuitable results for a fixed catalogue. A field evaluation would need independently judged cases, participant tasks and realistic provider data. Raw embeddings are discarded after computing the score table.

## Prepare a question for the host

Open a role with an unresolved detail in the demo and read its suggested question. For example, the source for the garden opportunity confirms that volunteers work on site but leaves step-free access blank. The question asks about a route from arrival to the activity. Only a host's answer can confirm the detail. The volunteer search and the coordinator's recorded confirmations operate independently of the wording model.

### See which wording was actually published

Open `data/host-questions.json` beneath the deployed site's address. Each entry gives its role, field, source-record reference and the question a person can ask. The top-level fields describe that particular build. A developer checkout starts with a reproducible editor-written edition. The Pages workflow can produce a different edition in its deployment artifact.

| Published fields | Meaning |
| --- | --- |
| `provider: openai`, `status: ready` | The release runner called OpenAI, received a completed response from the named snapshot and validated a full set of wording choices. |
| `provider: curated`, `status: unconfigured` | The release used the editor-written defaults. This is also the default for a local build. |
| `provider: curated`, `status: fallback` | The release attempted OpenAI, then used the complete editor-written set after an unavailable service or an unacceptable response. The workflow log records a brief diagnostic category. |

### The wording model's decision

For each unknown time, delivery mode or step-free access field, a single release-time request supplies a fictional role title, its activities, the missing field and the recorded delivery mode. The model selects an opening and the emphasis of the question from a short reviewed vocabulary. For instance, a role with unknown delivery mode receives conditional wording if the missing fact concerns access to a venue. This constrained task trades linguistic variety for reviewability.

Python takes the record reference from the catalogue, checks that the response covers exactly the requested gaps, validates every wording choice against that field's allowed options, and publishes the assembled questions. The model never supplies role attributes, rankings, evidence references or host replies. The browser reads the published file. Visitor searches and local review activity stay out of the model request. [Builder](../ai/build_questions.py) · [Validation tests](../tests/test_ai_questions.py)

## Reproduce or operate the build

From the repository root, rebuild the editor-written edition and run its tests.

```sh
python3 pipeline/build.py
python3 -E -s -m ai.build_questions
python3 -E -s -m ai.build_semantic
python3 -m unittest discover -s tests -p 'test_ai*.py'
node --test tests/semantic.mjs
```

The publish job accepts a repository Actions secret named `OPENAI_API_KEY`. A push to `main` or a manual run on `main` rebuilds the deployment. The key is scoped to the model step in a fresh runner job, after the independent verification job succeeds. Pull requests execute the checks. The browser receives only static files. Adding or changing a secret takes effect on the next trusted publish run. [Workflow](../.github/workflows/deploy.yml) · [GitHub Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

The builder calls the Responses API with a pinned GPT-5.4 mini snapshot, strict structured output and `store: false`. One additional attempt is allowed on transient service or connection errors. A known billing quota error returns directly to the editor-written edition. Build logs report the provider and status. The deployed JSON is the record of which edition a visitor saw. The tests exercise success, invalid responses, quota failure and transient recovery using local fixtures. Actual model execution requires a successful publish run with `provider` set to `openai`. [Model](https://developers.openai.com/api/docs/models/gpt-5.4-mini) · [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) · [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
