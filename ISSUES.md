# Issues

Severity (HANDOFF §12): **P0** blocks trip use, loses or corrupts data, or the
allergy card is wrong or unreachable · **P1** core flow broken, no workaround ·
**P2** wrong but has a workaround, or confusing · **P3** cosmetic.

Zero open P0/P1 is required for every release.

| ID | Sev | Found in | Summary | Steps to reproduce | Status | Fixed in |
|---|---|---|---|---|---|---|
| I-1 | P1 → not a bug | spike-1, iOS 18.1.1 | Google Maps transit-directions link (AC-I2) marked as not working | Spike L1 → Open | Closed Oct 14: Maps opened and said "No routes found" because the route started at Jordan's location in the US. Retest with a Kyoto origin | spike test design |
| I-2 | P2 | spike-1, iOS 18.1.1 | `googletranslate://` app link didn't switch apps; the app wasn't installed | Spike L4 → Open | Closed Oct 15: with the app installed, the link opens Translate (spike run 2, iOS 18.1.1). Keep the website fallback for when it isn't installed | not a bug |
| I-3 | P3 | spike-1 | Spike page blamed a later relaunch on the last link tapped (`tel:` prompt never hides the page), so L10 showed a false "reloaded" | Spike L10 → Cancel → force-quit within 15 min → reopen | Closed Oct 15: L10 retest on spike-2 passes; the `tel:` prompt doesn't reload the page | spike-2 |
| I-4 | P2 | O-12 data check | One hotel's only listed phone is a 0570 Navi Dial number, which may not connect from a US phone or data-only eSIM | Hotel card → call | Open: hotel card shows a hint (Phase 1) | — |
| I-5 | P2 | 0.4.5, a11y audit (Oct 28) | With large iOS Text Size, Settings scrolled sideways (from the largest standard size); at accessibility sizes the screen headers, the Add-expense amount row, long category chips and the tab labels ran past the right edge | Settings → Text Size max (or Accessibility → Larger Text), open Settings / Add expense | Fixed: grid/flex children shrink and wrap, headers wrap Cards to its own row, tab labels capped at 17px; E2E "EC-36 / DQ-10" checks 10 screens at 23px and 33px bold | 0.4.6 |
