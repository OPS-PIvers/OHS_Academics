# Consecutive weeks on the F List (Hub column AE)

Column AE on **⭐Academics & Attendance Hub** ("Consecutive Weeks on D/F List") holds each student's current streak of weekly F Lists in a row. `FListCounter.js` keeps it up to date from the **F List** tab, so no other data sheet is needed.

## How it counts

A daily trigger at 6am runs `incrementFListWeekCounts`. When a new weekly list has been loaded:

- **Students on the list** get **+1**.
- **Students not on the list** are reset to blank, because the streak is broken.

A list only counts as a new week when all of these are true:

1. The F List tab is not empty.
2. The list is different from the last one seen. A week with no new upload, such as a break, changes nothing; streaks just hold.
3. At least 5 days have passed since the last count. A mid-week re-paste or correction isn't counted as a new week.

Other details:

- A student with several F's still gets +1 for that week.
- Students are matched by ID (F List col C = Hub col D). Without an ID, they're matched by name: "Last, First M." on the F List matches "Last, First" on the Hub.
- Each list adds a row to the **F List Count Log** tab. The row shows:
  - the date,
  - how many students were on the list,
  - how many Hub rows went up,
  - any F List names that couldn't be found on the Hub,
  - a status: **Counted**, or **Correction (not counted)** for a changed list that arrived within 5 days of the last count. A correction is never counted later.

AE is a plain number column. Don't put a formula in it, because the script overwrites the values. You can type a starting streak into AE by hand; the script adds to it, as long as the student is on the next list.

## Setup (once)

1. Extensions → Apps Script → run `setupFListCounterTrigger` and authorize it.
2. Optional: run `incrementFListWeekCounts` right away to count the list that's in the tab now.

## Resetting (new year or semester)

Run `resetFListWeekCounts`. It clears Hub column AE and the F List Count Log.
