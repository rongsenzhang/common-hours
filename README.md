# Common Hours

Find volunteering opportunities around Greater Manchester and ask follow-up questions about the activities, timing and access. The independent NTU–TeamKinetic application demo uses 19 fictional roles from 13 fictional hosts. All volunteers can use it without an account.

[Find a role](https://rongsenzhang.github.io/common-hours/) · [Ask the role finder](https://rongsenzhang.github.io/common-hours/#ask) · [按步骤测试 / testing guide](docs/testing-v1.1.md)

## Try it

1. Open **Ask the role finder** and ask **Can I walk dogs?**. Open either of the two listings to see the actual task, timing and route.
2. Follow up with **Only weekends**. The shelter walk remains. Ask **What about weekdays?** and the neighbourhood walk replaces it.
3. Choose **Start a new chat**. Ask **What can I do from home?**, then **Show more options**. The assistant separates confirmed possibilities from details that a host still needs to check.
4. In **Discover**, search for **litter walk** and open the riverside role. Its description explains that the trail has steps and uneven ground. Save the role to revisit it on the same device.

The assistant runs a lightweight activity classifier and reads the catalogue in the browser. It supports English and selected Chinese volunteering phrases. The response describes listed activities and keeps practical conditions explicit. Conversations expire on reload. Bookmarks persist on the device.

## What changed after v1.0

The original catalogue had no dog-walking role. A shared word in “walk dogs” and “Riverside litter walk” caused a false recommendation. We preserved the published result and the original inputs. The regression check applies the current search to that original catalogue and expects an empty result. A separate test uses the expanded catalogue and expects both listed dog walks. [Historical release](https://github.com/rongsenzhang/common-hours/releases/tag/v1.0.0) · [Frozen example](fixtures/history/v1.0-B22.json) · [Tests](tests/matching.mjs)

On the current 36 authored cases, the default search placed a relevant role in the first three on 22 of 23 answerable queries and correctly withheld a confirmed recommendation on 13 of 13 no-answer queries. Both numbers describe synthetic examples. Independent judgements and observed use by volunteers and coordinators remain open. The [field workbook](docs/field-workbook.md) sets out those tasks.

## Staff workspace

The GitHub Pages release contains the volunteer interface, public listing details and host questions. The technical benchmark, OpenAI comparisons, source records and coordinator simulation are available in the [private staff repository](https://github.com/rongsenzhang/common-hours-admin) for authorised GitHub accounts. Its dashboard lists queries alphabetically. The [staff instructions](docs/admin.md) explain how to use the interactive version. The implementation and reproducible fictional fixtures are available in this portfolio repository; generated staff snapshots go to the private repository.

The release job calls OpenAI using a GitHub Actions secret for the synthetic benchmark and host-question wording. Volunteer messages stay on the visitor’s device. [AI integration](docs/ai.md) · [Matching model](docs/model-card.md) · [Technical route](docs/roadmap.md) · [Company and competitor research](docs/market-research.md) · [KTP evidence](docs/role-evidence.md)

## Run locally

Use Python 3.9+ and Node.js 22+. Run from the repository root. Choose a new output directory for each packaged preview.

```sh
python3 pipeline/build.py
node pipeline/evaluate.mjs
python3 -m ai.build_questions
python3 -m ai.build_semantic
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.mjs
python3 pipeline/package_public.py --output .work/volunteer-preview
python3 -m http.server 8754 --bind 127.0.0.1 --directory .work/volunteer-preview
```

Open the printed local address. To run the browser checks, install Playwright and its Chromium browser, then run `node qa/browser.cjs http://127.0.0.1:8754/` and `node qa/admin-browser.cjs site/data`. The release workflow runs these journeys before publishing.

## Attribution

All organisations, roles, replies and scenarios are fictional. The garden image is an AI-generated illustration. DM Sans and Instrument Serif are bundled with their SIL Open Font Licenses in [site/assets](site/assets/). This independent portfolio project has not been commissioned or endorsed by the partners.
