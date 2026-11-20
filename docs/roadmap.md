# Common Hours · technical route

Independent demonstrator for the NTU × TeamKinetic KTP, reference 552664. The working question is how a volunteer and a coordinator can distinguish a relevant role from a role that actually meets a person's stated requirements. The release covers a small fictional Greater Manchester network.

| Stage | Design decision | Acceptance evidence |
| --- | --- | --- |
| Discovery | Review the company's public product families, existing AI work, open standards and five alternatives. Translate findings into testable assumptions about volunteers and coordinators. | [Market research](market-research.md), [interview and workshop guide](field-workbook.md) |
| Data | Keep opportunity, host and session sources separate. Python joins records using stable keys, validates them, builds SQLite and exports a small static catalogue with field provenance. Host follow-ups are a distinct evidence source. | [Pipeline](../pipeline/), [input fixtures](../fixtures/), [catalogue](../site/data/catalog.json) |
| Retrieval | Apply declared time, participation and step-free requirements. Rank eligible candidates with lexical retrieval and a controlled vocabulary. Compare against a literal baseline under identical constraints. Require evidence of both an explicit activity and its object in the hybrid finder. Keep unknowns inspectable. | [Matching implementation](../site/engine.js), [model card](model-card.md), [benchmark](../site/data/evaluation.json) |
| Interaction | Public mobile/desktop Finder and Ask use volunteer-facing facts, explicit preferences and meaningful empty states. A separate staff console holds the coordinator queue, source records, A–Z query browser and embeddings. A simulated coordinator correction affects the staff preview. | [Website](https://rongsenzhang.github.io/common-hours/), [browser checks](../qa/) |
| AI integration | A trusted release job can use an encrypted repository secret to ask OpenAI for role-related follow-up questions and compare embeddings against 36 labelled cases at a predeclared cutoff. Release metadata identifies the actual generation method. For live chat, a Cloudflare Worker calls the OpenAI Responses API for each turn and checks model-selected roles against the catalogue. Visitors can also use an on-device classifier. | [Integration and operator guide](ai.md), [workflow](../.github/workflows/) |
| Evaluation | Freeze synthetic relevance judgements separately from the engine. Show expected and returned results, denominators, failure cases and exclusions. Use human research to test whether the apparent gains carry over. | [Benchmark outputs](../site/data/evaluation.json), [field protocol](field-workbook.md) |
| Knowledge transfer | Provide traceability for each principal duty and selection criterion, a decision brief, a study plan, guided practical work and a supervision checklist. | [Role evidence](role-evidence.md), [field workbook](field-workbook.md) |
| Release | Validate data, run regression checks, test public mobile/desktop journeys and staff authentication separately, publish a stripped volunteer site and a staff snapshot, then verify both entry points. | [Public source](https://github.com/rongsenzhang/common-hours), [releases](https://github.com/rongsenzhang/common-hours/releases) |

## Data flow

```text
Fictional roles CSV + host JSON + session CSV + follow-up JSON
  → validate identifiers, field values and relationships
  → SQLite → full catalogue with field sources
              ├─ volunteer-only export → Finder and Ask → roles and practical facts
              ├─ live chat Worker + OpenAI → interpret latest turn → check listed roles and conditions
              ├─ staff workspace → provider follow-up → private corrected preview
              └─ release AI workflow → validated wording → public questions
36 labelled cases → baseline, hybrid and optional embeddings → staff comparison A–Z
```

The [volunteer Finder](https://rongsenzhang.github.io/common-hours/#discover) and [Ask](https://rongsenzhang.github.io/common-hours/#ask) run on Pages. The [staff guide](admin.md) covers the private repository and loopback console. The source repository and historical release are public and contain fictional research fixtures.

## Delivery beyond this demonstrator

1. With a volunteer coordinator, a volunteer and a university supervisor, review consent, proposed measures, local vocabulary and how often listings are updated. Agree which unknown facts should block a recommendation.
2. Run the proposed usability tasks. Record observed problems, proposed changes, owner and retest outcome. Invite people who prefer assisted or non-digital support.
3. With partner approval, map real sample exports and permission boundaries, test source freshness, and have independent assessors judge relevance. Compare results across organisations and access requirements.
4. Pilot with a coordinator able to pause or reverse use. Agree on operating costs, support ownership, verification intervals and training before widening deployment.

Recruitment, participation outcomes and partner adoption require external evidence. The steering and teaching materials can be used at those stages.
