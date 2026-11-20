# Matching model and evaluation

A volunteer describes an activity and selects practical requirements. The matcher retrieves related listings, then checks each listing against the selected time, participation mode and step-free access. A coordinator can inspect the underlying fields. A ranking score measures similarity to a query. It gives no estimate of a volunteer's ability, suitability or likelihood of attending.

## From fixtures to a searchable catalogue

Three independently structured fictional feeds represent 15 roles from 10 invented host organisations across eight themes. The role file supplies listing text and interests, the host directory supplies organisation names and areas, and the session feed supplies timing, participation mode and venue access. A separate file contains three fictional host replies for a coordinator exercise.

The Python pipeline checks for duplicate keys, broken references, missing session rows, unrecognised vocabulary and inconsistent remote/venue-access combinations. It joins the inputs in a local SQLite database, preserves missing values as unknown and writes a browser-readable catalogue. Every published opportunity field has a source filename and row identifier. The database also contains the three optional follow-up facts. A first-time search always uses the original listing facts.

| Initial catalogue measure | Result |
|---|---|
| Mode | 9 at a venue, 4 fully remote, 1 with a choice of routes, 1 unknown |
| Timing | 5 weekday, 6 weekend, 3 offering either, 1 unknown |
| Venue access | 7 confirmed step-free, 1 known to have steps, 3 unknown, 4 remote listings where the question does not apply |
| Follow-up exercise | Evidence is available for the garden entrance and route, repair workshop timetable and telephone companion's participation mode. The wildlife survey route remains unresolved. |

An organisation’s area is its base. A remote volunteer can participate from home. The area does not express user distance or travel time.

### Relationship to the UK volunteering data model

| Demo field | Related concept in the Volunteering and Social Action Ontology | Transformation still needed for exchange |
|---|---|---|
| Organisation | Organisation name attached to an Activity | Assign a stable organisation identifier |
| Title, summary, tasks | Activity and Role titles and descriptions | Separate the activity from the role and give both identifiers |
| Mode | Role allowsRemoteParticipation | Preserve unknown separately and distinguish fully remote from a choice of routes |
| Step-free venue access | Role accessibility | Obtain fuller access information and map the source vocabulary |
| Interests and tasks | Related to Role skill and requirement | Separate interests, skills and prerequisites, then map them with host input |
| Time and area | Session time and location | Supply precise sessions, reuse temporal identifiers and model the actual venue |

The ontology also describes publication windows. A live import would need withdrawal and expiry handling, including the activity's publishEnd. The shipped catalogue is a static fictional snapshot. This crosswalk records conceptual overlap. JSON-LD identifiers, a conformant exchange adapter and verified feeds would be separate integration work. [Ontology reference](https://standard.volunteeringdata.io/ontology)

## Rankers and visibility rules

Both rankers receive the same catalogues, topic text and practical constraints.

1. **Literal baseline.** Normalise case and accents, split into alphanumeric words and remove a small English stop list. The score is the fraction of distinct query words that appear anywhere in a listing's searchable fields. Ties use the stable role identifier.
2. **Hybrid retrieval.** Fit inverse document frequencies to the supplied catalogue on demand. Title words receive a frequency weight of 3, interests and tasks a weight of 2, and summary, organisation and area words a weight of 1. Apply logarithmic term frequency, smoothed inverse document frequency and cosine similarity. A second cosine compares binary concept vectors derived from 16 small, hand-authored groups of related words. The final score uses 65% lexical similarity and 35% concept similarity. The vocabulary and fixed weights are visible in the engine. Matching explanations expose literal words and the exact field and word supporting a related concept. [Matching code](../site/engine.js)
3. **Visibility.** Match the requested settings against the published fields. An explicit conflict moves the listing to the excluded group. A relevant listing with an unresolved selected condition goes to the review group. A confirmed conflict takes precedence over another unknown. A flexible schedule supports either day group. A hybrid listing explicitly offers either a venue route or a fully remote route. A remote route requires no assumption about the physical venue. Confirming step-free access answers only that question.
4. **No evidence.** A nonempty topic with zero retrieval signal produces no candidates in any group. Leaving the topic blank allows browsing by practical requirements. A single incidental word can still produce a false positive.

The matcher uses corpus statistics and an authored concept vocabulary. It needs no account, network model call, supervised training data or language-model key. English free text only influences topic relevance. Structured fields carry time, delivery mode and step-free requirements. Negative or complex natural-language constraints require personal review.

## Benchmark

The 28 versioned synthetic scenarios include 17 with an expected confirmed recommendation and 11 with no expected confirmed recommendation. Eight explicitly labelled routes identify an expected review or conflict. A case can contain a route label as well as a relevant result. Each case records the request, structured conditions, relevant IDs, expected routes and a plain-language judgement. The output contains the actual top three IDs, review and conflict groups, returned count and per-case measurements for both rankers. All results use the initial uncorrected catalogue. [Judgements](../fixtures/judgements.json) · [Per-case results](../site/data/evaluation.json)

| Metric | Literal | Hybrid | Denominator |
|---|---:|---:|---|
| nDCG@3 | 0.5882 | 0.9412 | 17 answerable cases |
| Hit@3 | 10/17 | 16/17 | 17 answerable cases |
| Correctly returned no confirmed result | 9/11 | 9/11 | 11 no-answer cases |
| Retrieved and correctly routed a labelled review or conflict | 7/8 | 8/8 | 8 explicitly labelled case–listing pairs |

nDCG@3 uses binary relevance and discounts each rank by its logarithm, then divides by the best possible score for that case. Hit@3 counts any labelled relevant ID in the first three confirmed results. No-answer accuracy requires an empty confirmed group, even when a review candidate exists. Route recall counts expected review/conflict IDs found in the correct group. Extra routes and unjudged items are visible in the case output. Route recall alone does not measure precision.

**Inspection examples.** B07 tests whether “allotment” retrieves the garden. B14 uses a weekend and step-free constraint to demonstrate a related but unconfirmed garden. B17 records the known stairs on a litter walk. In B13, other listings share words with “community kitchen cook” and appear despite the only cooking role having an incompatible schedule. In B22 “walk dogs” retrieves a litter walk. In B28 “teach adults to sound out words” misses the reading role. These failures show both overmatching and gaps in the vocabulary.

The judgements, fixtures and vocabulary were authored for the same demonstration. They are small, unblinded and have favourable overlap on several alias cases. No independent annotators, volunteer feedback, production data, held-out generalisation study or demographic fairness evaluation contributed to these scores. They describe software behaviour on these fixtures. Recruitment, satisfaction, time saved and volunteer retention require separate field evidence.

## Reproduce

From the repository root with Python 3.9+ and a current Node 22 LTS or newer:

```sh
python3 pipeline/build.py
node pipeline/evaluate.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.mjs
```

Python and Node use their standard libraries. The generated local database is at `.work/catalog.sqlite`. The two public JSON files are versioned so the demonstration can load without a backend. Re-running the build replaces the local outputs. Use the published fixtures to reproduce the release and a separate copy to experiment. [Pipeline](../pipeline/build.py) · [Evaluation](../pipeline/evaluate.mjs)

## Further validation

Recruit volunteers and coordinators with relevant lived experience, including people using assistive technology. Ask them to supply realistic requests and independently judge the suitability of anonymised listings. Collect disagreement separately from missing metadata. Freeze the vocabulary and evaluation rules before measuring a fresh held-out set. Compare against current search on the same candidate pool, recording harmful constraint violations, genuine no-answer behaviour, time to a suitable shortlist and whether users can explain and correct a result. Follow the organisation's access, consent and governance process before involving people or integrating live data.
