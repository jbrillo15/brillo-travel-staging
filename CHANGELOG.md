# Changelog

Versions follow semantic versioning. 0.x during the build; 1.0.0 is the trip
release. The version here must match `js/config.js` and the service worker
cache name (a unit test checks this).

## 0.4.6

- **Printable itinerary.** The bottom of the Trip screen has a new "Printable itinerary" link. It shows every day of the trip on one page (flights, plans with times, places in English and Japanese, how to get there, bookings, allergy notes, and the hotel each night), plus a last page of hotels in large Japanese for taxi drivers. "Print or save as PDF" prints it black on white with no app buttons; in the iPhone print screen, pinch out on the preview to save it as a PDF.
- **Large text.** With a large iOS Text Size, Settings no longer scrolls sideways, and screen headers, the add-expense amount, long category buttons and the tab labels stay on screen (they wrap instead). Nothing changes at the normal size.

## 0.4.5

The Phrases button in the Cards header is bright lime instead of white, so it stands out.

## 0.4.4

- A bold **Phrases** button sits in the Cards header beside Close, so the phrase list is one tap from the moment Cards opens (the allergy card still opens first, unmoved). On a phrase it reads "All phrases".
- The pronunciation, what you say out loud, is now large and upright in the section's color (white in the Allergy section, where red means a warning). On a phrase opened full screen it's large too, under a "Say it" label.

## 0.4.3

Phrases read in a new order: the Japanese on top, then the English in bold as the line that stands out, then how to say it. On a phrase opened full screen the Japanese stays big for staff, with the English in bold under it.

## 0.4.2

More color. Six category colors say what kind of thing something is, the same on every screen: lime for food and drink, violet for sights, pink for shopping, cyan for getting around, tan for stays, and periwinkle for basics and help. They tint the pictograms, card edges, filter buttons, phrase sections, quick searches, budget envelopes, expense rows and the Lists overview. City colors still mark the day's line and badges, and the Now, done, budget and allergy colors keep their meanings.

## 0.4.1

Phrases: each category (Basics, Restaurant, Allergy and so on) is now its own clearly marked section, with a big header that stays at the top while you scroll through it, a phrase count, and a row of buttons to jump straight to a section. Allergy phrases are edged in the allergy color. A phrase opened full screen names its section.

## 0.4.0

Nearby, cards and phrases.

- **Nearby:** ideas from the sheet sorted by walking time from where you are (80 m a minute), with a category filter and "Show all by city". Each idea shows its English and Japanese name, why it's worth it, its allergy note, and Directions, Add to a day, Done, Skip and a taxi card. A planned idea shows on that day's Today and Trip screens, offline too. Location is asked only on Nearby; without it, the list sorts from today's plan or tonight's hotel and says so.
- **Quick searches** open Google Maps for ramen, sushi (after an allergy-card reminder), cafés, convenience stores, ATMs, pharmacies, coin lockers and restrooms.
- **Add an idea** with a name, category, city and note, and "I'm here" to save the spot.
- **Allergy card:** a Medical section under the food allergy text, from verified sheet rows, with the sheet's medical words shown large.
- **Phrases:** from the Cards button, grouped by Basics, Restaurant, Allergy, Directions, Stores, Hotel, Emergency and Taxi. Japanese large with romaji and English, a Play button when the phone has a Japanese voice, an "Unverified" label where the wording isn't from a published source, and each phrase full screen on a tap.
- **Info:** visitor hotline, embassy and consulate numbers from the sheet's Settings; 110 and 119 always show; insurance shows "Not set" until it's added.
- **About line:** a short "what is this place" line under each plan item's title on Today and Trip, from the sheet's new About column.
- Script 0.2.2 reads the About column and the Medical words setting.

## 0.3.2

Staging only: a "tap debug" switch in Settings → Developer that shows on screen what each tap reaches, to find why text boxes don't take taps on iPhone. The real-trip app never shows it.

## 0.3.1

Add-expense form fixes for iPhone.

- The Category, Paid with and Paid by labels read sideways on iPhone, and the stretched label covered the Amount field so it couldn't be tapped. They're plain labels now, and the amount field keeps its width at large Text Size settings.

## 0.3.0

Budget.

- **Left today:** the daily number from the Daily budget, spread over the days that are left, with dollars beside it and a meter that turns amber below a quarter and red when over. Before Nov 19 it previews the daily share; after Nov 26 it shows trip totals.
- **Envelopes:** Shopping (with tax-free purchases waiting for a refund), Cash on hand (starting cash + ATM withdrawals − cash spending) and Bookings (paid, plus hotels marked "Pay at hotel" still to pay). Bookings and ATM withdrawals never count against the daily number.
- **Add, edit and delete expenses** on either phone, offline too: a big yen field, category chips that pick the envelope, Card / Cash / Suica, who paid, date and note. A Suica tip, a tax-free toggle for Shopping, and a confirm step from ¥20,000. Deleting marks the row Deleted in the sheet; nothing is removed.
- **Calculator:** type a price in yen to see dollars and what it would leave for today, then log it in one tap.
- **Exchange rate:** the sheet's live rate, else the last good rate this phone saw (with its date), else the sheet's fallback rate.
- **Export CSV** through the share sheet, with JPY and USD columns.

## 0.2.2

Personal art.

- New app icon: the cartoon of Jordan, Lindsay and Penny. Phones keep the old icon until Brillo is removed from the home screen and added again.
- Today, before and after the trip: the lake photo of all three with the countdown under it. The greeting shows the phone owner's face.
- Lists: open items show the owner's face (both faces for "Both"); done items show who ticked them.
- Ticking an item pops the ticker's face up from the checkbox. Finishing a whole list shows all three faces and "<List> done!". With Reduce Motion the pop is skipped and the list card shows without moving.

## 0.2.1 (PROD Oct 25)

Fixes from the Oct 21 production-readiness check, before the first PROD release.

- **Adding a list item and saving an edit work again.** Add item did nothing and Save on the edit screen did nothing, on every browser. The tests filled the field in a way that hid it; they now type into the real fields.
- **A setup code only works on its own site.** The test app (STAGING) refuses the real-trip code and says to open the other Brillo icon, and the real-trip app refuses a test code, so test builds can never write to the real sheet. A pointer saved before this change is ignored.
- **The edit screen keeps what you typed.** A background sync, or switching to another app and back, no longer redraws the form and loses unsaved text.
- If the item was deleted on the other phone while its edit screen was open, Save now says so instead of doing nothing.
- **Save sends only what you changed.** It no longer sends back an older name when the other phone renamed the item meanwhile, and no longer blanks an owner, bag or due date the form can't show.
- Script 0.2.1: a change is refused (it shows under Sync issues) when a column it writes is missing or renamed, instead of being dropped while reporting success. Before writing, the script re-checks that the row still holds the item's ID, and checks again between the parts of one change, so someone sorting the tab at that moment can't put it on the wrong row. Only the changed cells are written.

## 0.2.0 (staging)

- **Lists:** the Pre-trip, Packing, Departure day and Return packing checklists from the sheet, shared by both phones. Tap a row to tick it; add items, edit owner, bag, due date and notes, or delete one (it stays in the sheet, marked Deleted). Packing can be grouped by bag with a count per bag. Overdue items are marked in amber, and overdue Pre-trip items show on Today, where they can be ticked.
- **Changes work offline.** Every change is saved on the phone first and shows at once, marked "Waiting to sync". Brillo sends queued changes, then fetches the sheet, a couple of seconds after a change and at every usual sync. Changes are never dropped on their own: one the sheet refuses waits under Sync issues until you retry or discard it.
- If both phones change the same item, the later change wins on both.
- While the app and the sheet's script don't match, nothing is sent, and that state is remembered after the app closes. With a script older than 0.2.0, changes wait on the phone with a banner saying so.
- The sync line counts queued changes ("2 changes waiting", "Offline · 2 changes saved on this phone").
- Script 0.2.0: writes (`mutate`) with each change applied once, the newest edit winning, rows found by ID, and text always stored as text. `resetStaging` clears only the live tests' own rows.

## 0.1.4 (staging)

- Today: the day line ("Day 2 of 8 · Osaka") moves under the greeting on one full line, so it no longer wraps beside the station mark.
- A day in a city without a line color (say a Nara day trip) gets its initial in a gray ring instead of the blue travel-day badge, so blue means travel days only.
- Before and after the trip, the header mark is announced as "Trip starts Nov 18" or "Trip complete" instead of "Travel day".
- The station letter is lighter than the day number, so Osaka's "O" never reads as a zero.
- The yen pictogram shows a ¥.

## 0.1.3 (staging)

- New look, design 0.5 "Metro", based on Tokyo and Osaka Metro signs: a neutral charcoal shell, city colors from real rail lines (Osaka Sennichimae pink, Kyoto Karasuma green, Tokyo Hanzomon purple, Shinkansen blue for travel days), flat panels with hairlines and a faint city light at the top.
- Station marks: each day's badge is a white disc ringed in the line color, with the city's initial over the day number (K 03). Trip shows each city's name in Japanese too.
- The day is drawn as a metro map: a thick line with white stations, gold for Now. Now / Next is a flat panel with a gold top band.
- Solid pictograms on line-color tiles, in the style of Japanese public signs; all 29 redrawn.
- Type is Avenir Next, built into iPhone. No web font downloads.
- The screen entrance animation is new; nothing animates continuously.

## 0.1.2 (staging)

- If the sheet's script speaks a different API version than the app, Brillo keeps showing the saved plan, says which side needs updating ("App and sheet don't match"), and stops retrying until the next normal sync (HANDOFF §13). Settings shows the script's version next to the app's.
- Stronger tests: no skipped or repeated trip day across the flight and the zone switch, no app file reading the phone's own time zone, Today re-deriving after midnight on return (EC-04); merged cells and formula results (EC-13); a second snapshot during ID assignment (EC-17).
- RUNBOOK: token rotation (B4) written out with `tools/rotate_token.py`; phone setup (B5) and script deploy (B6) split to one action per step, with the UTF-8 copy fix.

## 0.1.1 (staging)

- After a successful setup-code paste, the "Setup code needed" banner no longer lingers until the next screen change. Found in the first live end-to-end check.

## 0.1.0 (staging)

Phase 1, the read path (HANDOFF §14).

- Installable home-screen app shell with an offline service worker. Updates wait until you tap Update.
- Setup by pasting a setup code inside the installed app; "Whose phone is this?".
- Pull-only sync from the sheet, with a status line, a Sheet problem banner, and Data health.
- Today: before the trip (countdown, next pre-trip items, packing progress, to-book items), travel day (flights with zones and layover), in trip (Now / Next, the day as a train line, tonight's hotel, Route home after 6 PM), after the trip (summary).
- Trip: day list, day detail, item detail with transit Directions, taxi card and booking ref.
- Cards: allergy card (not-set-up state until the verified text is in the sheet), hotel card in Japanese with +81 dialing, taxi card, booking refs grouped in fours. Wake lock or a brightness hint.
- Info (basic) and Settings, with staging-only Developer tools (simulated Japan time, reset local data).
- Script: snapshot with ensureIds under the script lock; the V-01 to V-12 checks are shared with the phone through `js/parse.js` (deployed as `Parse.gs`).
- Lists, Budget and Nearby show what's coming in v0.2 to v0.4.

## Earlier (Phase 0)

- Phase 0: project scaffold, RUNBOOK, ISSUES log.
- Staging secrets moved from `local/secrets.json` to `~/.config/brillo-travel/secrets.json` (root CLAUDE.md: no secrets under Desktop). README and RUNBOOK updated.
