# Test Live AI conversations

Open [Ask the role finder](https://rongsenzhang.github.io/common-hours/#ask) on a phone or computer and select **Live AI**. A successful reply shows the model name returned by OpenAI. The following examples use fictional volunteer opportunities.

## Compare the two catalogues

Run Case A and Case B in the [matching exercise](https://rongsenzhang.github.io/common-hours/#exercise) to see the results for the seven supplied records. [Discover A](https://rongsenzhang.github.io/common-hours/#discover-case-a) and [Discover B](https://rongsenzhang.github.io/common-hours/#discover-case-b) use the same volunteer conditions across 100 listings, including those seven. Look for **From the matching exercise** on shortlisted and unconfirmed listings. Venue distances are measured from the fictional volunteer’s starting point.

1. In Live AI, enter `Case A` or paste the original case. Check the explanation against the weekday evenings, three-mile travel limit, one-to-one work and digital support preferences. Follow up with the original Case B text. Every confirmed recommendation should now allow in-person participation.
2. Ask `Why do these roles suit me?` and compare the reasons with your preferences and the listings. Select **Use the seven exercise roles** and ask `Why this list? Reason?`. Look for a distinction between helping someone individually and teaching a group, and for any facts a host or coordinator needs to check.
3. Start a new chat with `I'd like to volunteer but I'm not sure what I'd be good at.` Answer the follow-up with `People often ask me to help them use their phones. I'm usually free after work.` Add `In person only, within two miles.` Check which roles still fit and what remains uncertain.
4. In a new chat, try `I like teaching one person at a time to use a phone. I can only volunteer online on weekday evenings.` Ask why the suggested tasks fit your experience. Then add `I can only start at exactly 6:35 p.m.` The listings give broad periods, so the assistant should ask you to confirm the time with the host.

## Check common conversations

Keep the first four messages in one conversation. Start fresh for each of the last two.

| Message | What to check |
| --- | --- |
| Can I walk dogs at weekends? | **Shelter dog walking buddy** appears. Open the role to see the activity and availability. |
| How are you? | The assistant responds to the greeting without adding role cards. |
| Are you Gemini? | The assistant identifies OpenAI. The model name appears beside its reply. |
| What about weekdays instead? | The assistant remembers dog walking and recommends **Neighbourhood dog walker**. |
| I want to help at the community garden at weekends. I need a step-free route to the beds. | **Community garden buddy** appears under **To confirm**. The host needs to check the route to the beds. |
| What should I ask the organiser before my first volunteer shift? | The assistant gives practical preparation advice. The wording can vary. |

Try the same greeting in **On-device search**, then switch back to **Live AI**. Each mode keeps its own conversation in the current tab. Reloading starts a fresh chat. The demo sets no per-visitor message limit. If OpenAI is busy, try again later or use on-device search.

The [live verification workflow](https://github.com/rongsenzhang/common-hours/actions/workflows/live-smoke.yml) checks conversations with the actual model. Separate browser tests use fixed replies to check sending a message, cancelling, recovering from errors and opening a role card on desktop and mobile.
