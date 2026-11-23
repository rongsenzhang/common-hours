# Run the matching exercise

[Open the exercise](https://rongsenzhang.github.io/common-hours/#exercise) or choose **Matching exercise** beside **Discover**. The seven fictional opportunities come from the candidate exercise. All matching runs in the browser. You can inspect and edit the implementation without an account or an API key.

## Run the two supplied cases

1. Select **Case A**. With weekday evenings, online or in-person participation, a three-mile travel limit and unverified clearance, the shortlist is **Digital access buddy**, then **Digital skills facilitator**.
2. Select **Case B**. The only change is in-person participation. **Digital skills facilitator** is the sole recommendation. In both cases, the form-filling role needs a venue distance and the youth reading role needs a clearance check.
3. Open **Compare with a simple filter**. In Case B the simple filter returns **Food parcel packer** and **Digital skills facilitator**. Both activities are feasible. Only the latter describes work that fits one of the volunteer's interests. Both methods use the same current inputs and evidence.

## Test one missing fact

In **Case B**, leave the volunteer’s travel limit at **3 miles**. Use the separate venue-distance control for **Form-filling volunteer**. The numbers below simulate what the coordinator might learn. Each refers to the distance from this volunteer to the venue.

| Venue distance | What happens to Form-filling volunteer | Why |
| --- | --- | --- |
| Unknown (supplied record) | Needs confirmation | The role takes place in person. The record gives no distance. |
| 2 miles (hypothetical) | First recommendation, ahead of Digital skills facilitator | Thursday evening is available, two miles is within reach, and helping individuals with online forms fits both interests. |
| 5 miles (hypothetical) | Ruled out | The venue is beyond the three-mile limit. |

Select either case again to restore the supplied conditions and the unknown venue distance. For a boundary test, choose **5 miles** for the simulated venue and then change the volunteer’s own limit to **5 miles**. The form-filling role now meets the distance limit exactly.

## Check how the records are interpreted

The wording examples run through the same activity matcher as the seven supplied records. Try reading the example about helping someone use their phone in a one-to-one session, then compare the expected and observed interests. The counterexamples check whether the matcher attributes an interest when a phrase refers to a different activity or is negated. These hand-picked cases demonstrate the behaviour of a small English vocabulary. They cannot estimate how often it will recognise volunteers’ own wording.

The ODI field notes relate the supplied activity text to `Role.description`, remote participation to `Role.allowsRemoteParticipation`, and the session to `Session.time` and `Session.location`. “Online forms” describes the task, while the supplied setting specifies in-person attendance. The original venue remains unknown in all three simulations. The host can describe a venue once, whereas the travel distance depends on the volunteer. Likewise, a role’s published clearance requirement and an individual’s verification status describe different facts. [Volunteering and Social Action data model](https://standard.volunteeringdata.io/ontology)

## Inspect or run your own copy

The [records and matching function](../site/exercise-engine.js) hold the seven original descriptions, the case presets, the small phrase mapping, the checks and the ranking. The [page](../site/exercise-view.js) uses the output of that function for both cases. The [exercise tests](../tests/exercise.mjs) cover case changes and the treatment of missing information.

To edit, [download the public source](https://github.com/rongsenzhang/common-hours/archive/refs/heads/main.zip), unzip it, and run the following from the folder that contains `site/`. Use a local web server so the browser can load JavaScript modules.

```sh
python3 -m http.server 8754 --bind 127.0.0.1 --directory site
```

Open [the local exercise](http://127.0.0.1:8754/#exercise). Changes to the volunteer controls take effect in the page. After editing the source, reload the page to try your change. The inputs are fictional and temporary.
