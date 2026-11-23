# Run the matching exercise

[Open the exercise](https://rongsenzhang.github.io/common-hours/#exercise) or choose **Matching exercise** beside **Discover**. The seven fictional opportunities come from the candidate exercise. All matching runs in the browser. You can inspect and edit the implementation without an account or an API key.

1. Select **Case A**. The volunteer wants individual and digital support activities on weekday evenings. They accept online roles and can travel up to three miles for an in-person role. Clearance for a new role is unverified.
2. Select **Case B**. Only the participation setting changes to in person. Both presets run the same function. Compare the shortlist and the cases that still need a check.
3. In Case B, change the limit to **5 miles**. Conversation partner now meets the travel requirement. Form-filling volunteer still has an unknown venue distance.
4. Return to Case B and mark clearance as **verified for this role**. Youth reading mentor can now be ranked. Return to either preset to reset the inputs.
5. Compare the ranked shortlist with the feasibility-only baseline. Both check exactly the same requirements. The baseline takes the first three feasible records in source order. The shortlist also considers the selected interests.

## Inspect or run your own copy

The [records and matching function](../site/exercise-engine.js) hold the seven original descriptions, the case presets, the small phrase mapping, the checks and the ranking. The [page](../site/exercise-view.js) uses the output of that function for both cases. The [exercise tests](../tests/exercise.mjs) cover case changes and the treatment of missing information.

To edit, [download the public source](https://github.com/rongsenzhang/common-hours/archive/refs/heads/main.zip), unzip it, and run the following from the folder that contains `site/`. Use a local web server so the browser can load JavaScript modules.

```sh
python3 -m http.server 8754 --bind 127.0.0.1 --directory site
```

Open [the local exercise](http://127.0.0.1:8754/#exercise). Changes to the volunteer controls take effect in the page. After editing the source, reload the page to try your change. The inputs are fictional and temporary.
