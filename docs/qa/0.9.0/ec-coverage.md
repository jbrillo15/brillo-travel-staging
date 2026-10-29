# Edge-case coverage — v0.9.0 (HANDOFF §10)

Every §10 row mapped to the test that covers it. Test files are under `tests/`;
`U` = `tests.html`, `S` = `server-harness.html`, `E` = `e2e.html`, `DQ` = the
device-QA row in `device-qa.md`, `F` = the Nov 7–8 field test.

Run on 2026-10-28 (sweep): unit 139/139 · server 39/39 · E2E 71/71 (after the accessibility audit). New in this sweep are marked **new**.

## Time and dates

| ID | Needs | Covered by | Status |
|---|---|---|---|
| EC-01 | U, E | U `time` "EC-01 / AC-T1" · E "AC-T1: phone in Pacific time" | ✅ |
| EC-02 | U | U `time` "EC-02" | ✅ |
| EC-03 | U | U `time` "EC-03" | ✅ |
| EC-04 | U, DQ | U `time` three EC-04 tests · E "EC-04: reopening the next morning" · DQ-03 (zone switch step) | ✅ U/E · DQ pending |
| EC-05 | U | U `time` "EC-05" · E (in the EC-04 test) | ✅ |
| EC-06 | U | U `time` "EC-06" · U `parse` "V-05" | ✅ |
| EC-07 | U | U `time` "EC-07" | ✅ |

## Sheet and data

| ID | Needs | Covered by | Status |
|---|---|---|---|
| EC-10 | S | S "EC-10" · S "rows are found by ID even after someone sorts the tab" · S "a person sorting the tab between two ops" | ✅ |
| EC-11 | S, U | U `parse` "V-09 / EC-11" · S "a renamed column: the op is refused" · S "V-09: a missing tab" | ✅ |
| EC-12 | U | U `parse` "EC-12" | ✅ |
| EC-13 | S | S "EC-13" | ✅ |
| EC-14 | U | U `parse` "V-06 / EC-14" | ✅ |
| EC-15 | S, E | S "ping echoes Japanese and emoji (EC-15)" · U `parse` "EC-15" · E **new** "EC-15: Japanese text and emoji render intact" | ✅ |
| EC-16 | S | S two EC-16 tests | ✅ |
| EC-17 | S | S "EC-17" | ✅ |
| EC-18 | DQ | DQ-06 (offline variant step) | DQ pending |

## Network and sync

| ID | Needs | Covered by | Status |
|---|---|---|---|
| EC-20 | U, DQ | U `core` "EC-20" · U `outbox` "EC-20/24" · DQ-07 | ✅ U · DQ pending |
| EC-21 | S, U | S "idempotency: replaying an applied opId returns duplicate" · U `outbox` "duplicate and stale also settle an op" | ✅ |
| EC-22 | S, DQ | S **new** "EC-22: both phones log an expense in the same second" · DQ-04 | ✅ S · DQ pending |
| EC-23 | S, U | S "last write wins by clientUpdatedAt" · U `outbox` "duplicate and stale" | ✅ |
| EC-24 | DQ, F | U `core` "EC-24" (extra) · DQ-10 (cellular-only) · F | DQ/F pending |
| EC-25 | U | U `core` "EC-26 / EC-25" · U `outbox` **new** "EC-25: quota or internal script error during push" | ✅ |
| EC-26 | S, E | S "EC-26" · U `core` "EC-26: AUTH → setup needed" · E **new** "EC-26: the sheet refuses the code (AUTH)" | ✅ |
| EC-27 | U, F | U `outbox` "batches of 50" · F | ✅ U · F pending |
| EC-28 | DQ | U `outbox` "enqueue saves the op on the phone before anything is sent" (extra) · DQ-04 (kill-mid-sync step) | DQ pending |

## iOS and installable web app

| ID | Needs | Covered by | Status |
|---|---|---|---|
| EC-30 | DQ | E "first run" (EC-30 hint) · DQ-02 | DQ pending |
| EC-31 | U, DQ | U `core` "EC-31" · U `outbox` two EC-31 tests · DQ-11 | ✅ U · DQ pending |
| EC-32 | DQ | DQ-03 · DQ-14 | DQ pending |
| EC-33 | E, DQ | E "update prompt: shows the new version, waits for the tap" · DQ-11 | ✅ E · DQ pending |
| EC-34 | DQ | DQ-08 | DQ pending |
| EC-35 | DQ | E "EC-35" (extra) · DQ-12 | DQ pending |
| EC-36 | DQ | E **new** "EC-36 / DQ-10: Large Text" (10 screens at 23 px and 33 px bold) · DQ-10 | ✅ E · DQ pending |
| EC-37 | DQ | DQ-09 | DQ pending |
| EC-38 | DQ | E "AC-C3: no Japanese voice → no Play buttons" (extra) · DQ-13 | DQ pending |
| EC-40 | DQ | DQ-14 | DQ pending |

## Money

| ID | Needs | Covered by | Status |
|---|---|---|---|
| EC-50 | E | E "edit sends only the changed field … a large amount asks first (EC-50)" | ✅ |
| EC-51 | U | U `budget` "AC-B2 / EC-51" | ✅ |
| EC-52 | U | U `budget` **new** "EC-52: a Suica top-up is Transit spending in Daily" · E "Suica shows the top-up tip" | ✅ |
| EC-53 | U | U `budget` "Shopping: tax refund reduces spent" · U `budget` **new** "EC-53: Pending → Received" | ✅ |
| EC-54 | U | U `budget` "EC-54" | ✅ |
| EC-55 | U, E | U `budget` "Bookings due: Pay-at-hotel … until check-in" | ✅ (§10 reworded Oct 28) |
| EC-56 | U | U `budget` "EC-56" | ✅ |
| EC-57 | U, S | U `budget` "EC-57 / AC-B6" · U `parse` "FX error → null" · S **new** "EC-57: a live FX cell showing #N/A" | ✅ |
| EC-58 | U | U `budget` "EC-58" | ✅ |

## People and content

| ID | Needs | Covered by | Status |
|---|---|---|---|
| EC-60 | U, E | U `model` "AC-C2: only a verified allergy card row counts" · E "AC-C1 / AC-C2" | ✅ |
| EC-61 | E | U `parse` "V-12" · E **new** "EC-61: a hotel with no Japanese address" | ✅ |
| EC-62 | U | U `geo` "AC-N1 sort: … ideas without coordinates last (EC-62)" | ✅ |

## Notes

- **EC-55.** §10 reworded Oct 28 (Jordan): the due date is the one in the booking
  confirmation email; no Today reminder. Unit test only.
- **DQ steps not in the §12 L5 table:** EC-04 (change the phone's time zone mid-session),
  EC-18 (edit the sheet while a phone is offline) and EC-28 (force-quit during a sync)
  have no DQ row of their own. They run as extra steps under DQ-03, DQ-06 and DQ-04 in
  `device-qa.md`.
