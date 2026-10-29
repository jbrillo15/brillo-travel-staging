# Brillo Travel: user acceptance test script (HANDOFF §12 L6)

**Who:** Lindsay does the tasks; Jordan watches, times and takes notes.
**When:** Tue Nov 3, evening. About 30 minutes.
**Where:** Lindsay's iPhone, in **Brillo TEST** (the staging app and sheet). Nothing here touches the real sheet.
**Pass:** Lindsay finishes all 10 tasks **without help**. Every moment of confusion is noted, even when she gets there. Each note becomes an issue in `ISSUES.md`.

## Before she starts (Jordan, about 5 minutes)

1. Brillo TEST is on her home screen and set up (RUNBOOK B5). Settings shows the latest staging version.
2. In Brillo TEST: Settings → Developer → **Simulate Japan date and time** → **Fri Nov 20, 2:00 PM**. The top of Today should read "Day 2 of 8 · Osaka".
3. Wi-Fi on. Location Services on for Safari websites (Nearby asks once).
4. Hand her the phone on the **Today** screen. Start a timer for each task.

## Rules while she works

- Read each task out loud exactly as written. Don't name the screen or the button.
- No hints. If she asks, say "do what you'd do in Japan." If she's stuck for 2 minutes, or says she'd give up, mark the task **Needed help** and show her, then move on.
- Write down every pause, wrong tap, back-track or "hmm", with what she expected to find.

## Tasks

| # | Read this to Lindsay | Done means |
|---|---|---|
| 1 | "You're in a taxi. Show the driver where tonight's hotel is." | The hotel card shows the Japanese name and address, full screen. |
| 2 | "You just paid ¥1,200 cash for ramen. Log it." | The expense shows in Budget: ¥1,200, Food, Cash, paid by Lindsay, today. |
| 3 | "How much can we still spend today?" | She reads out the "left today" amount from Budget (or Today). |
| 4 | "Tick off three things you've packed in your backpack. What's still left in it?" | Three ticks in Packing; she reads out what's left in her backpack. |
| 5 | "Find the nearest convenience store." | Google Maps opens with convenience stores near her. |
| 6 | "A waiter asks about your allergy. Show them." | The allergy card is on screen. |
| 7 | "You're standing somewhere you like. Save it as an idea, and plan it for tomorrow." | A new idea saved with her location and added to Sat Nov 21. |
| 8 | "Get train directions to the next thing on today's plan." | Google Maps opens with transit directions to the next plan item. |
| 9 | "What time do we check out tomorrow, and what's the confirmation number?" | She reads out the check-out time and the confirmation number. |
| 10 | "A jacket costs ¥8,800. How much is that in dollars?" | She reads out a dollar amount (the calculator, or the ≈ $ on a form). |

## Log (Jordan fills in)

| # | Time | Without help? | What confused her |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |

**Last question for Lindsay:** "Would you rely on this in Japan? What would you change first?"

## After

1. Settings → Developer → **Use real time**.
2. Jordan sends the log (a photo of it is fine) to Claude, who logs it in `docs/qa/0.9.0/uat-log.md` and turns each confusion note into an issue.
3. Test entries (the ramen, the ticks, the idea) stay on the staging sheet. They're test data.
