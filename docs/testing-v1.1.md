# Test the catalogue and on-device role finder

Open [Ask the role finder](https://rongsenzhang.github.io/common-hours/#ask) on a phone or computer and select **On-device search**. Start a new chat between scenarios, but keep follow-up questions in the same conversation. For the model-backed assistant, use the [Live AI testing guide](testing-live.md).

| Scenario | Action | Expected result |
| --- | --- | --- |
| Find the two dog walks | Ask `Can I walk dogs?` | **Shelter dog walking buddy** and **Neighbourhood dog walker** appear. Open the cards to check the work, timing and route. Riverside litter collection is a different activity. |
| Change availability | Follow up with `Only weekends`, then `What about weekdays?` | The weekend search returns the shelter walk on a level route. Weekdays return the neighbourhood walk, whose route includes steps. |
| Request an incompatible setting | Continue with `Can I do it from home?` | Both walks require attendance, so the shortlist is empty. |
| Request alternatives | In a new chat ask `What can I do from home?`, then `Show more options`. | Each reply offers up to three roles. The next reply shows different listings. Check **To confirm** for participation details and **Save role** to revisit a listing under **Discover → Saved**. |
| Check an access requirement | In [Discover](https://rongsenzhang.github.io/common-hours/), enter `allotment` under **Your preferences**, select **Weekends** and **At the venue**, then select **Step-free access required** and **Find roles**. On a narrow screen, open **Edit** first. | **Community garden buddy** appears under **To confirm** because the route to the beds still needs checking. |
| Distinguish similar activities | Reset the Discover filters and search separately for `walk horses` and `litter walk`. | The first search returns no match. The second finds **Riverside litter walk**, with steps and uneven ground noted in its details. |
| Check staff access | Open the public site, then open the private staff repository in a signed-out browser window. | Volunteers can access discovery, matching and chat. Staff records require an authorised GitHub account. |

## Reproduce the original search error

1. In the [v1.0 release](https://github.com/rongsenzhang/common-hours/releases/tag/v1.0.0), the catalogue had no dog-walking role. A search for *walk dogs* suggested *Riverside litter walk*.
2. Inspect the [frozen B22 example](../fixtures/history/v1.0-B22.json). Run `node --test tests/matching.mjs` from the repository root. The regression test expects an empty result when searching the original catalogue.
3. Repeat the search in the current catalogue, which includes dog walking. Then try *walk horses* to check that the finder can withhold an unsupported suggestion.

## Inspect the staff view

With an authorised GitHub account, open the [staff repository](https://github.com/rongsenzhang/common-hours-admin). Find **walk dogs · B29** in the alphabetical query index and compare the methods. The [staff instructions](admin.md) cover the interactive dashboard and how to record or undo a coordinator check. Changes made in the simulation apply to that review session.
