# Common Hours · technical route

Independent demonstrator for the NTU × TeamKinetic KTP, reference 552664. The working question is how a volunteer and a coordinator can distinguish a relevant role from a role that actually meets a person's stated requirements. The release covers a small fictional Greater Manchester network.

| Stage | Design decision | Acceptance evidence |
| --- | --- | --- |
| Discovery | Review the company's public product families, existing AI work, open standards and five alternatives. Translate findings into testable assumptions about volunteers and coordinators. | [Market research](market-research.md), [interview and workshop guide](field-workbook.md) |
| Data | Keep opportunity, host and session sources separate. Python joins records using stable keys, validates them, builds SQLite and exports a small static catalogue with field provenance. Host follow-ups are a distinct evidence source. | [Pipeline](../pipeline/), [input fixtures](../fixtures/), [catalogue](../site/data/catalog.json) |
| Retrieval | Apply declared time, participation and step-free requirements. Rank eligible candidates with lexical retrieval and a controlled vocabulary. Compare against a literal baseline under identical constraints. Keep unknowns inspectable. | [Matching implementation](../site/engine.js), [model card](model-card.md), [benchmark](../site/data/evaluation.json) |
| Interaction | Mobile-first web app with a volunteer finder, coordinator work queue and research view. Use explicit preferences, meaningful empty states and record-level provenance. A coordinator can apply a fictional host response locally and see its effect. | [Website](https://rongsenzhang.github.io/common-hours/), [browser checks](../qa/) |
| AI integration | A trusted release job can use an encrypted repository secret to ask OpenAI for role-related follow-up questions and compare embeddings against the same 28 labelled cases at a predeclared cutoff. Release metadata identifies the actual generation method. Visitors see the questions without sending their search terms to an inference service. | [Integration and operator guide](ai.md), [workflow](../.github/workflows/) |
| Evaluation | Freeze synthetic relevance judgements separately from the engine. Show expected and returned results, denominators, failure cases and exclusions. Use human research to test whether the apparent gains carry over. | [Benchmark outputs](../site/data/evaluation.json), [field protocol](field-workbook.md) |
| Knowledge transfer | Provide traceability for each principal duty and selection criterion, a decision brief, a study plan, guided practical work and a supervision checklist. | [Role evidence](role-evidence.md), [field workbook](field-workbook.md) |
| Release | Validate data, run regression checks, exercise the volunteer and coordinator flows at two screen widths, publish source and a tagged release, then verify the public URL. | [Public source](https://github.com/rongsenzhang/common-hours), [releases](https://github.com/rongsenzhang/common-hours/releases) |

## Data flow

```text
Fictional roles CSV + host JSON + session CSV + follow-up JSON
  → validate identifiers, field values and relationships
  → SQLite → public catalogue with field sources
              ├─ visitor preferences → browser ranking → reasons or review
              ├─ coordinator reads a follow-up → browser-only correction → rerank
              └─ release AI workflow → validated host questions → public role card
Separate labelled cases → both retrieval methods → per-case results and headline metrics
```

## Delivery beyond this demonstrator

1. With a volunteer coordinator, a volunteer and a university supervisor, review consent, proposed measures, local vocabulary and how often listings are updated. Agree which unknown facts should block a recommendation.
2. Run the proposed usability tasks. Record observed problems, proposed changes, owner and retest outcome. Invite people who prefer assisted or non-digital support.
3. With partner approval, map real sample exports and permission boundaries, test source freshness, and have independent assessors judge relevance. Compare results across organisations and access requirements.
4. Pilot with a coordinator able to pause or reverse use. Agree on operating costs, support ownership, verification intervals and training before widening deployment.

Recruitment, participation outcomes and partner adoption require external evidence. The steering and teaching materials can be used at those stages.
