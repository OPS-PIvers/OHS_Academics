# Attendance Threshold Alerts

Weekly emails telling staff which students have reached each level of the attendance response chart,
plus an **Attendance Tiers** dashboard tab (Admins: all students; Counselors: their alpha list by name,
school-wide counts anonymously; Teachers: hidden). Code lives in `AttendanceThresholds.js`.

## How students are counted
The hub counts attendance in **class periods** (7 periods = 1 school day). Each level has a category:

| Category | Hub columns summed |
|---|---|
| `TARDY` | O – Unexcused Tardies |
| `TRUANT` (truant / unresolved) | N – Unexcused + S – Truancy |
| `ILLNESS` (illness / medical) | P – Medical + Q – Illness |

PFE absences (R) are not counted. To change the mapping, edit `ATTENDANCE_CATEGORIES`.

## What each email contains
One email per recipient per week:
1. **Newly reached since the last report.** If a student skipped levels, they appear once at the highest level, with an "Also crossed" note.
   Repeating levels (tardies every 4) show how many times they have been reached.
2. **All students currently at each level.** Each student is listed only under their highest level per category.

Recipients for a level are its **Recipient Emails** plus, when **Include Student's Counselor** is checked,
that student's counselor (from the Admin Settings alpha ranges). Counselors only receive their own students.
Routing uses the student's highest level, so list someone on every level they should hear about.

## Go-live checklist
1. Open the dashboard → **Admin Config → Attendance Thresholds** (the sheet is created on first load).
   Fill in **Recipient Emails** for each level. The "Contacts (Reference)" column lists the names from the chart.
2. Click **Send preview to me**. Every email that would go out is sent to you instead, labeled with its real recipient.
   Nothing is logged. The message also lists any levels that have no recipients.
3. In the Apps Script editor, run `seedAttendanceThresholdLog` once. This marks every student's *current* level
   as already reported so the first real email doesn't flag the whole school as "new". Skip this step if you
   *want* the first email to treat everyone as new.
4. Run `setupAttendanceThresholdTrigger` once. It schedules `sendAttendanceThresholdEmails` weekly on
   **Tuesday at 7am** (after the Monday-night hub refresh). Change `ATTENDANCE_EMAIL_TRIGGER_DAY` / `_HOUR` to move it.

The weekly job respects the global **Automated Emails** toggle and sends the usual admin recap.

## Maintenance notes
- **Staff changes:** edit Recipient Emails in Admin Config. No code change is needed.
- **New or changed rule:** add or edit a row (threshold in periods). Uncheck **Active** to pause a level.
- **Renaming a level** resets its history, so everyone currently at it shows as "new" next week.
- **New school year:** the log lowers itself automatically when hub counts reset. You can also clear the
  `Attendance Threshold Log` sheet (keep the header row) to start fresh.
