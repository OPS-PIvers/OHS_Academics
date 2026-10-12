# F List running total (Hub column AE)

Column AE on **⭐Academics & Attendance Hub** ("Weeks on F List (Total)") is the number of weekly F Lists each student has appeared on. `FListCounter.js` keeps it up to date from the **F List** tab, so no other data sheet is needed.

## How it counts

A daily trigger (6am) runs `incrementFListWeekCounts`. It adds **+1** to AE for every Hub student on the current F List, but only when all of these are true:

1. The F List tab is not empty.
2. The list is different from the last one counted. A week with no new upload isn't counted twice.
3. At least 5 days have passed since the last count. A mid-week re-paste or correction isn't counted as a new week.

Other rules:

- A student with several F's still gets +1 for that week.
- Students are matched by ID (F List col C = Hub col D). If there's no ID, they're matched by name: "Last, First M." on the F List matches "Last, First" on the Hub.
- Each list adds a row to the **F List Count Log** tab: the date, how many students were on the list, how many Hub rows went up, any F List names that couldn't be found on the Hub, and a status. The status is **Counted**, or **Correction (not counted)** for a changed list that arrived within 5 days of the last count. A correction is never counted later.

AE is a plain number column. Don't put a formula in it, because the script overwrites the values. You can type a starting total into AE by hand; the script adds to whatever is there.

## Setup (once)

1. Extensions → Apps Script → run `setupFListCounterTrigger` and authorize it.
2. Optionally, run `incrementFListWeekCounts` right away to count the list that's in the tab now.

## Resetting (new year or semester)

Run `resetFListWeekCounts`. It clears Hub column AE and the F List Count Log.
