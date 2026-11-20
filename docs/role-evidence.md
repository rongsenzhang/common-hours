# Common Hours and the TeamKinetic KTP

Common Hours is an independent portfolio project about finding volunteering opportunities and checking their published details. The role combines applied research, engineering, evaluation and knowledge transfer. A reviewer can inspect software, reproduce a small experiment and try the teaching exercise. Fieldwork, partner decisions and an applicant's employment or academic record need separate evidence.

This map follows the four-page NTU person specification supplied with the vacancy. The [NTU advertisement](https://vacancies.ntu.ac.uk/Job/JobDetail?JobId=2699&utm_source=chatgpt.com) describes the work setting. The [KTP programme listing](https://iuk-ktp.org.uk/job/volunteer-management-data-scientist-software-engineer-ktp-associate/) publishes the research remit and essential requirements.

## Three ways to inspect the work

1. Run the volunteer search with a stated preference and a fixed requirement. Inspect the reasons for the results. Open the coordinator desk and inspect the provider evidence for the garden opportunity. Follow the [guided practical](field-workbook.md#teaching-practical).
2. Compare the retrieval approaches using the [release evaluation](../site/data/evaluation.json), [model card](model-card.md) and [test suite](../tests/). Follow one catalogue entry back to its inputs using the [pipeline](../pipeline/).
3. Read the [steering brief](field-workbook.md#steering-brief), then use the [field study](field-workbook.md#field-evaluation) to challenge a claim about volunteer or coordinator outcomes.

## The nine principal duties

| Duty in the specification | Evidence a reviewer can inspect | Evidence that requires people or a longer project |
| --- | --- | --- |
| 1. Conduct and record individual or joint research and development | The [market review](market-research.md) grounds research questions. The [interview and workshop scripts](field-workbook.md#discovery), [data pipeline](../pipeline/), [ranking implementation](../site/engine.js) and [evaluation](../site/data/evaluation.json) cover discovery design through experimentation. | Recruit participants, obtain the relevant approvals, run interviews and usability tests, and revise requirements from observations. |
| 2. Interpret research, develop ideas and report findings | The [model card](model-card.md) and [steering brief](field-workbook.md#steering-brief) describe how to read the benchmark, why unknown access matters and which hypothesis to test next. | Check proposed improvements with actual organisations and users before treating them as priorities. |
| 3. Write reports or papers and present to project stakeholders | The [technical report](model-card.md), [non-technical steering brief and presentation prompts](field-workbook.md#steering-brief), and [paper outline](field-workbook.md#research-output) address different audiences. | Present to stakeholders, record their response, and undertake formal research or publication if warranted. |
| 4. Contribute to research plans and coordinate contacts | The [field evaluation](field-workbook.md#field-evaluation) sets the tasks, order, measures and stopping rules. The [milestones](field-workbook.md#milestones-and-development) assign contact roles and decision owners. | Secure agreement from participating groups and confirm who will act in each role. |
| 5. Maintain skills and build collaborative contacts through CPD | The [development plan](field-workbook.md#milestones-and-development) specifies study activities, proposed collaborators and observable outputs. | Attend training, seek feedback, log learning and apply it to a revision. |
| 6. Record resources, maintain files and data accuracy | Inspect the [versioned catalogue](../site/data/catalog.json), [pipeline](../pipeline/), [tests](../tests/) and [resource register procedure](field-workbook.md#data-stewardship). | Agree accuracy and refresh responsibilities with real data owners and verify permissions before integration. |
| 7. Attend and contribute to meetings | The [meeting pack](field-workbook.md#meeting-pack) includes a timed agenda, decisions, minute fields and follow-up ownership. | Convene the meeting, contribute and file the agreed minutes. |
| 8. Help supervise projects and contribute to courses, tutorials or practical work | The [guided practical](field-workbook.md#teaching-practical) includes a research question, reproducible tasks, a worked answer and marking criteria. | Deliver it with a learner or cohort, review their work and adapt the teaching. |
| 9. Guide staff and students assisting with research | The [supervision guide](field-workbook.md#supervising-a-research-assistant) delegates work, defines checkpoints, sets escalation rules and provides a sign-off rubric. | Appoint and supervise a researcher, give feedback and observe independent competence. |

## Essential criteria

The codes below follow the order within each category in NTU's specification. The final column describes what the portfolio demonstrates and where further evidence belongs.

| Code | Criterion | Evidence and scope |
| --- | --- | --- |
| K1 | Applied AI and the development, testing and evaluation lifecycle | Trace the [ranking logic](../site/engine.js) to the [evaluation and limitations](model-card.md). |
| K2 | Engineering maintainable software and AI applications | Inspect the separation between [data preparation](../pipeline/), [retrieval](../site/engine.js) and [tests](../tests/). |
| K3 | Data engineering, relational modelling and integration | Trace source transformation, relations, joins and validation in the [pipeline](../pipeline/). The demonstration uses synthetic inputs. |
| K4 | Experiment design, benchmarking and interpretation | Inspect the baseline, comparison, relevance judgements, sample size and metrics in the [model card](model-card.md) and [evaluation file](../site/data/evaluation.json). |
| K5 | Responsible AI and data governance | Inspect requirement handling in the [engine](../site/engine.js), the [data protocol](field-workbook.md#data-stewardship) and the limits on interpretation in the [model card](model-card.md). |
| S1 | Substantial programming using modern practices | Review the implemented [application](../site/), [pipeline](../pipeline/) and [checks](../tests/). Prior substantial applications remain relevant to an experience assessment. |
| S2 | Design, build, test and evaluate an applied AI solution | Trace the [retriever](../site/engine.js), [tests](../tests/) and [experiment](../site/data/evaluation.json) end to end. |
| S3 | Extract, clean, transform, integrate and validate data using databases | Follow a single opportunity through the [pipeline](../pipeline/) into the [catalogue](../site/data/catalog.json). Production scale and data complexity require further evidence. |
| S4 | Investigate alternatives and solve problems from evidence | Compare retrieval approaches, inspect counterexamples and apply the [steering decision rule](field-workbook.md#steering-brief). |
| S5 | Translate user and operating requirements into designs | The [requirements register](field-workbook.md#requirements-register) links design assumptions, constraints, acceptance checks and a field question. |
| S6 | Communicate technical ideas to different audiences | Compare the [technical model card](model-card.md) with the facilitator's [two-minute briefing](field-workbook.md#steering-brief). |
| S7 | Document methods, designs, decisions and results | See the [roadmap](roadmap.md), [evaluation report](model-card.md), [release results](../site/data/evaluation.json) and [decision record](field-workbook.md#steering-brief). |
| S8 | Plan a substantial programme, manage milestones and collaborate across functions | Inspect the [gated work plan](field-workbook.md#milestones-and-development), role assignments and meeting pack. Delivery and collaboration over time need project records and referees. |
| E1 | Significant applied AI, ML or intelligent software development and evaluation experience | This release is a code and evaluation sample. The applicant should support the extent and duration of experience with dated projects or research. |
| E2 | Contribution to medium or large software, data or AI projects | Review the [software structure](../site/) and [tests](../tests/) for a bounded prototype. Team contributions and scale require separate project history. |
| E3 | Database, ETL and multisource structured-data experience | The [pipeline](../pipeline/) supplies a runnable example. Prior operational experience belongs in the application. |
| E4 | Interpret complex technical or research evidence to make development decisions | The [model card](model-card.md) and [steering brief](field-workbook.md#steering-brief) link a comparison, its limits and a follow-up experiment. |
| E5 | Technical reports, documentation and communicating findings | Compare the [technical report](model-card.md), [steering brief](field-workbook.md#steering-brief) and [teaching notes](field-workbook.md#teaching-practical). Live delivery requires independent evidence. |
| E6 | Collaborative delivery with technical and non-technical stakeholders to deadlines | The [meeting and milestone packs](field-workbook.md#meeting-pack) are work samples. Name a real collaboration, personal contribution and agreed outcome separately. |
| Q1 | Relevant undergraduate and Master's degrees or equivalent qualifications or professional experience | Individual qualifications and equivalence must be evidenced in the application. |

## Desirable criteria

| Code | Criterion | Evidence and scope |
| --- | --- | --- |
| K1 | Knowledge-intensive AI, semantic technologies or recommendation | The [retrieval model](model-card.md) and [engine](../site/engine.js) show how opportunity concepts inform ranking. |
| K2 | Modern AI deployment environments | Inspect the [deployment route](roadmap.md) and working browser-based deployment. Private, GPU and enterprise deployments need their own evidence. |
| K3 | Efficiency, sustainability or Green AI | The [model card](model-card.md) explains the computation used for a request. The proposed [cost and performance check](field-workbook.md#field-evaluation) distinguishes measured latency from energy or carbon estimates. |
| K4 | VCSE, charity, volunteering, public service, higher education or knowledge transfer | The [sector review](market-research.md) and [knowledge-transfer exercise](field-workbook.md#teaching-practical) ground a volunteering scenario. |
| S1 | Design knowledge models, ontologies, graphs or semantic representations | Inspect the relationships used by the [engine](../site/engine.js) and how their source terms enter the [pipeline](../pipeline/). |
| S2 | Build retrieval, recommendation, conversational or language systems | Exercise the [opportunity finder](../site/) and inspect the [comparison](../site/data/evaluation.json). |
| S3 | Deploy, version, test or containerise software | Inspect the [deployment path](roadmap.md), repository history and [tests](../tests/). |
| S4 | Gather and analyse user requirements | The [interview guide, workshop and coding example](field-workbook.md#discovery) demonstrate method design. Field execution is pending. |
| E1 | Develop recommendation, retrieval, NLP or conversational systems | The [running implementation](../site/engine.js) and [evaluation](../site/data/evaluation.json) are one example. |
| E2 | Knowledge modelling or semantic data technologies | Inspect the data representation in the [catalogue](../site/data/catalog.json) and its use in the [model](model-card.md). |
| E3 | Deploy AI or ML using cloud, private, local or containerised infrastructure | The [roadmap](roadmap.md) documents the inference and hosting boundary. Production operation is a separate experience claim. |
| E4 | Work with sensitive data and implement privacy or responsible AI | Inspect the [governance procedure](field-workbook.md#data-stewardship) and constraint handling. The fixtures contain synthetic opportunities. Sensitive-data work needs actual evidence. |
| E5 | User-centred development, elicitation, testing, training or knowledge transfer | The [workbook](field-workbook.md) includes a runnable exercise and field protocols. Real facilitation and learner outcomes remain to be evidenced. |
| E6 | Academic research, publication or presenting findings | Inspect the [report and paper outline](field-workbook.md#research-output) as writing samples. Published papers and presentations require independent citations. |
| Q1 | Relevant PhD or equivalent research experience | Individual degree or research evidence belongs in the application. |

The reader can judge planning, problem solving and accountability from the study design, design decisions and review gates. NTU's other behavioural expectations include adaptability, self-development, relationships and achieving outcomes through others. Dated examples, feedback and the applicant's own explanation should support those claims.
