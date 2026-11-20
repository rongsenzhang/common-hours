# Common Hours field and teaching workbook

Use this workbook to teach the prototype, plan discovery and decide whether a partner pilot is justified. The exercises use fictional volunteering opportunities. The study design, contact roles and meeting forms are proposals. No participant quotations, minutes, approvals or field findings have been collected.

Volunteer tasks use the [public Finder](https://rongsenzhang.github.io/common-hours/#discover) or [Ask](https://rongsenzhang.github.io/common-hours/#ask). Coordinator and benchmark tasks use the [staff console](admin.md). Its local verification previews use fictional evidence and stay in that staff session. The public catalogue remains the published snapshot.

## Requirements register

The [public product review](market-research.md) supplies context for these hypotheses. Discovery should establish whether each one matters to participating volunteers and coordinators.

| ID and proposed need | Implemented design | Acceptance check | Question for discovery |
| --- | --- | --- | --- |
| R1. A volunteer uses ordinary words for an interest. | Retrieve against opportunity text and related concepts. | Search for an allotment, inspect the garden opportunity and explain which task makes it relevant. Compare with [keyword retrieval](model-card.md). | Which words would you naturally use for a role like this? |
| R2. A volunteer needs a feasible shift and format. | Treat selected schedule and format as explicit conditions. | Change one condition in Discover. Inspect which roles move out of the confirmed matches. | Which constraints can you vary and which have to be met? |
| R3. A volunteer needs clear evidence about step-free access. | Distinguish supported, unknown and incompatible requirements. | Require step-free access for the garden opportunity before and after the synthetic provider follow-up. Compare the public initial state with the signed-in staff preview. | What information would you need before deciding whether to travel? |
| R4. A coordinator needs to verify a missing fact. | A desk links unresolved opportunity information to a provider note and a review action. | Locate the garden record, identify the field and evidence, and apply a supported decision. Open the desk’s **Preview volunteer result**. | What evidence is sufficient, and who is allowed to update the record? |
| R5. A project team needs to review the evidence behind a ranking decision. | Expose a baseline, comparison, fixtures, metrics and interpretation. | Trace a judgement from [test cases](../fixtures/judgements.json) to [results](../site/data/evaluation.json). | Which ranking failures should stop a release? |

## Discovery

**Recruitment proposal.** Invite volunteers through a partner organisation and coordinators through a separate route. Seek variation in device, digital confidence, access preferences and experience of volunteering. Offer an accessible participation mode and a choice of device. Participation must be voluntary. A coordinator should not sit in on a volunteer interview unless requested by that participant. The partner research lead must approve recruitment, consent, data handling and any compensation before invitations.

**Individual interview, 25 minutes.** Use participant codes such as V01 or C01 and explicitly obtain consent for any recording. Offer a notes-only option. Read the following opening.

> We are exploring how people find volunteering opportunities and check the information they need. You can skip questions, pause or leave. We are testing the design. Please use the fictional example and avoid sharing names or other people's personal details.

| Minutes | Volunteer prompts | Coordinator prompts |
| --- | --- | --- |
| 0–5 | Tell me about your most recent search for an opportunity. What did you do first? | Walk me through the last time someone asked about a vacancy or a shift. |
| 5–12 | What did you look for before deciding to make contact? What was missing? | How did you check the answer? Which system or person was responsible? |
| 12–18 | Using the fictional role, show where you would look for time, format or access details. What would you do next? | Using the fictional incomplete record, show what you would check before updating it. |
| 18–23 | What would change your decision here? How would you know the information was current? | What would make an update unsafe or hard to undo? What information should volunteers see? |
| 23–25 | Summarise what you heard and invite corrections. Ask whether there is a missing priority. | Use the same member-check and invite an example that contradicts your interpretation. |

**Joint workshop, 40 minutes.** Invite a volunteer representative, coordinator, accessibility lead, engineer and research facilitator when willing. Individually map the steps from discovering a role to contacting its host (8 minutes). Compare maps and mark points where information changes hands (8). Ask pairs to classify three fictional records as confirmed, unknown or incompatible and discuss disagreements (12). Write two candidate acceptance checks together (8). Record dissent, decision owner and next check (4). Participants may submit written comments privately.

**Analysis procedure.** With permission, capture a de-identified observation per line. Separate the observer's note, participant's words and analyst interpretation. Two team members independently code an initial sample, compare interpretations and agree a working codebook. Retain contradictions, then group observations by task and participant type. One observed failure can reveal a safety issue. Frequency alone does not determine severity.

| Example analytical record | Contents |
| --- | --- |
| Illustrative input | In a fictional walkthrough, a participant pauses at an empty access field and asks who can confirm it. |
| Code and counterexample to look for | `missing-evidence`, `confirmation-owner`. Look for people who successfully found the verification route. |
| Hypothesis and proposed change | The distinction between missing information and a confirmed fact may be unclear. Test explicit wording and a named follow-up route. |
| Evidence needed | Observe a different participant explain the two states unaided. Check that the proposed owner can actually perform the action. |

## Field evaluation

**Research question.** Can volunteers recognise a feasible opportunity and can coordinators resolve a missing fact without overclaiming its suitability? The release provides an [offline benchmark](../site/data/evaluation.json) for retrieval. Human comprehension, participation, placement and saved staff time require different evidence.

**Proposed first round.** Six volunteers and four coordinators can form a small purposive usability sample. This is a planning target for identifying failure modes. Record the achieved sample, recruitment source and exclusions. Run one volunteer and one coordinator pilot before opening recruitment more widely. Have a reviewer other than the developer facilitate where feasible.

| Task | Participant action | What the observer records |
| --- | --- | --- |
| V1. Feasible opportunity | Find an in-person weekend gardening opportunity and decide whether the access information is sufficient. | First action, time, chosen role, interpretation of unknown access, prompt use and confidence. |
| V2. No viable match | Use a prepared combination from a [no-answer test case](../fixtures/judgements.json). Explain the result and what you would change. | Whether the participant invents eligibility, abandons or changes a negotiable constraint deliberately. |
| C1. Verify a fact | Review the synthetic garden follow-up, identify the field and source, decide whether to update and check the effect. | Decision appropriateness, time, evidence cited and ability to explain the resulting volunteer view. |
| C2. Evidence missing | Discuss a paper variation in which the host note only says “give us a call.” Say what would justify confirming step-free access. | Whether the participant preserves the unknown state and identifies an appropriate verification action. |

**Protocol.** Start from a clean copy or fresh browser session and check the garden record is unresolved. Ask participants to think aloud as comfortably as possible. Use one neutral rescue prompt after a sustained pause and annotate it. Capture outcomes as independent success, assisted success, failure or withdrawal. Include the case ID, device, study condition and elapsed seconds. Rotate the order of independent tasks, but always check the volunteer's initial state before a coordinator changes it. For a future head-to-head study, prepare matched tasks from fixtures and rotate which interface or approach appears first.

**Analysis.** Report counts and denominators for each role. Report task time as median and range for completers, alongside failure, withdrawal and assistance counts. Show each access misunderstanding and its context. Invite independent review of a sample of coded observations. If a participant cannot access a control, log the device, input method, exact task and effect. Protect the participant's identity in screenshots and write-ups.

**Decision gates.** If an unsupported access claim appears, pause that protocol step, restore the fictional record and examine the evidence path. Before proposing a wider pilot, require zero confirmed results that violate hard constraints on the regression fixtures, an answer for every unresolved high-severity usability issue and an agreed escalation owner. A small round with zero observed errors still leaves uncertainty. Re-test corrected cases with new participants. Insufficient recruitment or an interrupted study produces an explicitly incomplete report.

**Efficiency check.** Run the same fixture batch on specified hardware and record cold and warm elapsed time, number of records, build version and asset sizes. Repeat runs and report variation, including the browser/device and whether a cache was warm. Report joules or carbon only if measured energy and documented assumptions are available. A browser-local query requires no hosted model call.

## Data stewardship

| Resource | Provenance and unit | Stewardship action |
| --- | --- | --- |
| [Opportunities](../fixtures/roles.csv), [hosts](../fixtures/hosts.json), [sessions](../fixtures/sessions.csv) | Synthetic records identified by stable keys. | Review identifiers, relations, allowed values, duplicate rows and missing values when changing inputs. |
| [Provider follow-ups](../fixtures/follow-ups.json) | Synthetic notes associated with opportunity records. | Compare the statement with the exact field under review. Retain uncertainty if a statement is inadequate. |
| [Relevance judgements](../fixtures/judgements.json) | Authored evaluation cases with expected results. | On any amendment, document the rationale and inspect changes in the benchmark. Seek independent adjudication before external claims. |
| [Generated catalogue](../site/data/catalog.json) and [release evaluation](../site/data/evaluation.json) | Derived release data. | Regenerate using the [project instructions](../README.md), run checks and compare the versioned diff. Keep inputs, code and outputs together in the release. |
| Future field observations | Participant-controlled, de-identified, potentially sensitive. | Agree purpose, access, storage, retention period and deletion owner with the partner first. Store consent separately. Keep raw notes and contact details out of the public repository. |

For a live integration, a business owner would need to verify permission, data freshness and the escalation route for each field. Record who approved an update, when, what they reviewed, the previous and current value and how to roll back. A correction made in the signed-in staff console is a session-local trial interaction. Publishing authoritative corrections would require durable audit records, assigned staff identities and a data owner.

## Steering brief

**Decision requested of a future steering group.** Authorise a small study of search explanations and access verification using synthetic records. Any production or partner-data pilot would need a separate decision.

**What exists.** Visitors can search, ask follow-up questions and read practical role facts. In the separate staff workspace, a coordinator can inspect source records, confirm a synthetic host reply and preview its effect. A keyword baseline and a hybrid retriever are evaluated with the same authored cases. The [model card](model-card.md) provides the measurements, data size and caveats. The [machine-readable release results](../site/data/evaluation.json) let a technical reviewer inspect outcomes per case.

**Release findings.** On 19 fictional listings and 36 authored cases, the baseline placed a judged-relevant role in the first three on 16 of 23 answerable queries. Hybrid retrieval did so on 22 of 23. The respective nDCG@3 values were 0.6957 and 0.9565. For 13 cases with no confirmed match, the baseline correctly returned none in ten cases and the hybrid in all 13. The hybrid routed all 12 labelled review or exclusion pairs as expected. The baseline routed 11. These are fixed Finder tests. Conversational accuracy and real participant outcomes need their own assessment.

| Case | What happened | Development implication |
| --- | --- | --- |
| B07, “allotment” | The concept vocabulary connects the query to the garden role. | Retain concept evidence in the explanation so a reviewer can inspect how the role surfaced. |
| v1.0 B22, “walk dogs” | The archived catalogue contained no dog-walking role. Its old hybrid engine returned the litter walk. | Replay the [frozen case](../fixtures/history/v1.0-B22.json) with the current engine and confirm an empty result. |
| v1.1 B29–B37 | The current catalogue contains two dog walks. Schedule or access can narrow the choice. A horse walk or dog grooming request has no match. | Compare a positive match, an unsupported activity, a practical conflict and the valid litter walk. Add independently authored requests to the next study. |
| B28, “teach adults to sound out words” | The hybrid's top three miss the reference adult reading role. | Have volunteers supply paraphrases and freeze an independent test set before changing the vocabulary. |

**Interpretation.** The benchmark measures agreement with the fixture judgements. Improvement on that set could partly reflect overlap between authored examples and the vocabulary model. An access answer requires evidence about the host's premises. Ask independent reviewers to write fresh queries and assess feasibility before seeing either system's rankings. A follow-up study could compare Finder and Ask on unseen requests and count both missed opportunities and misleading suggestions, including how easily people can clarify an empty result.

| Proposed decision or risk | Accountable role | Evidence to review at the next gate |
| --- | --- | --- |
| Keep uncertain access separate from confirmed suitability. | Business data owner | One supported follow-up, one insufficient note, one explicit incompatibility, plus user interpretation. |
| Check whether retrieval improvements extend beyond authored cases. | Academic evaluation lead | Independently judged cases, rater disagreements, case-level differences and selected failure analyses. |
| Establish whether coordinators can maintain these records. | Volunteer management lead | Observed verification time, abandoned corrections and who has authority to confirm an update. |
| Agree accessibility and data-handling arrangements before fieldwork. | Study lead with partner accessibility and data leads | Accessible materials, consent process, storage and deletion decisions, and route to stop participation. |

**Two-minute stakeholder presentation.** Open with a volunteer who wants a weekend gardening role and needs step-free access. Show the uncertain result, ask the audience what they would need to know, then switch to the authenticated staff desk and inspect the synthetic host evidence. Apply the supported update and open the private volunteer-result preview. Explain the difference between ranking a relevant role and confirming a practical requirement. End on the proposed study, named decision owners and how a failed check would change the design.

## Research output

A short technical paper or internal research note can use the following structure.

1. **Question.** Does concept-aware retrieval change the position of relevant opportunities while respecting explicit practical constraints?
2. **Materials.** Identify the tagged release, synthetic source tables, authored judgements and cases with no feasible answer. Document who created the judgements and where leakage could arise.
3. **Methods.** Describe both systems, identical query conditions, metric definitions and handling of empty relevance sets. Provide the [reproduction instructions](../README.md) and [evaluation implementation](../pipeline/evaluate.mjs).
4. **Results.** Report the released counts and metrics directly from the [evaluation file](../site/data/evaluation.json). Include a case with different rankings and a case where human verification is required.
5. **Limitations and next study.** Discuss external validity, author bias, subjectivity of relevance and the absence of participant or partner testing. Attach the proposed field protocol and researcher responsibilities.

The [model card](model-card.md) is the technical release report. This outline supports a future paper or presentation. Submission, peer review and dissemination would need author and partner agreement.

## Milestones and development

| Proposed gate | Work and collaborators | Exit evidence |
| --- | --- | --- |
| Prototype review | Associate demonstrates the release to an academic adviser, engineering representative, coordinator and volunteer representative. | Agreed risks, open needs, owner and date for each follow-up. |
| Discovery and design | Research facilitator recruits with a VCSE partner and checks proposed requirements with volunteers and coordinators. | Consent and data plan, coded observations, conflicting cases and a revised requirements register. |
| Independent evaluation | An independent assessor judges new queries. Engineering reproduces the benchmark and compares failure cases. | Appraisal of relevance, feasibility, limitations, median runtime and device-level findings. |
| Controlled partner pilot | Subject to approval, a provider and business owner agree a small scope, data contract, review access and rollback. | Signed-off correction workflow, monitoring owner and evidence required to stop or continue. |
| Knowledge transfer | Associate and a partner trainer deliver the practical, observe independent reproduction and review maintenance instructions. | Learner evidence, updated runbook and named successor able to reproduce a release. |

**CPD plan.** For each activity record date, provider, learning objective, evidence of completion, an applied change and reviewer feedback. The proposed learning cycle is (1) an inclusive research session with a VCSE accessibility adviser, producing a revised task script, (2) an evaluation seminar with an IR researcher, producing a revised judgement protocol, and (3) a reproducibility pairing session with a software maintainer, producing an independently repeated release. The prospective contacts have no assigned commitment.

## Meeting pack

**Thirty-minute review agenda.** Spend 3 minutes confirming the decision sought and interests represented, 7 on the volunteer and coordinator demonstration, 7 on evaluation and one failure case, 8 on alternatives and participant impact, and 5 recording the decision, owner and review date. Suggested actions include approving a bounded test, requesting a specific change or deferring with a stated reason.

| Record after an actual meeting | Fields |
| --- | --- |
| Attendance and context | Date, participants/roles, release examined, unresolved interests or absences. |
| Decision and dissent | Decision text, alternative considered, evidence referenced, reservations and who is accountable. |
| Action | One owner, deliverable, due date, dependency and the test for closure. |
| Next review | Date, escalation route, evidence still required and person responsible for circulating agreed notes. |

## Teaching practical

**Objective.** In 15 minutes, a learner should be able to distinguish relevance, practical feasibility and evidence, and explain a ranking decision in plain English. Use a fresh copy of Common Hours, the [garden fixture](../fixtures/roles.csv), [provider notes](../fixtures/follow-ups.json) and the [model card](model-card.md).

1. Open Discover. Search for **allotment**, choose a weekend and an in-person role, then require step-free access. Find **Community garden buddy**, including any results that need confirmation. Record what the listing establishes and which fact remains unknown.
2. Predict which field must change before this opportunity can be treated as meeting all those requirements. Identify which search setting describes interest and which settings impose conditions.
3. Open the coordinator desk in a staff session and select **Preview volunteer result**. Return to the desk and read the garden provider's fictional follow-up. If it supports step-free access, apply that value and reopen the preview. Record the result and explain the change in one sentence.
4. Read one [evaluation case](../fixtures/judgements.json). Explain separately how you would test retrieval relevance and how you would test whether a confirmed match violates a stated condition. Name one conclusion about real participants that this exercise cannot establish.

**Worked answer.** “Allotment” supplies a topic. Weekend, in-person attendance and required step-free access constrain feasibility. At the start, the garden role is in the review group and there are zero confirmed matches. Follow-up F01 confirms the level entrance and step-free paths to the raised beds. With the same schedule and mode, recording that fact moves the garden role into the confirmed group in the staff preview. The weekday seed-library role remains excluded. A ranking measure tests ordering against reference judgements. A separate check should reject any confirmed result with a conflicting required condition. This run supplies no evidence about whether real volunteers would apply or attend.

**Assessment.** Award one point each for identifying the interest and constraints, recording the initial uncertainty, citing the exact evidence for the update, describing the resulting state, and separating relevance from verification and real-world impact. Require four of five and a correct treatment of unknown access before sign-off. If the learner treats uncertainty as confirmed, repeat with the insufficient-note paper variation before reassessment.

## Supervising a research assistant

**Assignment.** Give a student or assistant two synthetic roles and ask them to draft one ordinary-language query, one no-answer query and one uncertain-access case. Ask for an expected set of feasible results, an explicit reason, the evidence consulted and a proposal for integrating the cases into the test fixture. Work on a branch. An academic or technical supervisor reviews before case judgements change.

| Checkpoint | Supervisor action | Learner evidence |
| --- | --- | --- |
| Start | Confirm purpose, scope, data handling and how to flag uncertainty. Ask the learner to restate the task. | One-paragraph plan, named source records and a risk. |
| Midpoint | Independently judge one case and compare interpretations. Ask what observation would falsify the expectation. | One case with traceable rationale and a documented disagreement or check. |
| Review | Observe independent rerun, inspect proposed fixture changes and invite a short non-technical explanation. | Reproducible inputs, output, rationale, limitations and a short handover. |
| Sign-off | Accept or return specific revisions. Record the reviewer, date and evidence. Escalate disputed access claims to the data owner. | All three cases have stable IDs and expected outcomes, every hard-condition decision cites evidence, and unresolved disagreements are visible. |

A learner who cannot reproduce a result pairs with the supervisor for a second run. A learner who receives real personal data stops, keeps it out of the repository and contacts the designated study lead. The supervisor confirms the project route before further handling.
