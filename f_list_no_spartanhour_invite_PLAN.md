Initial request: 
Based on the data I have available in the spreadsheet_column_map, is it possible to get a global data point to see which students are failing a class who were *not* requested (or signed up for) the most recent Spartan Hour session?

Response:
Available Data
For identifying failing students: ✅ YES
⭐Academics & Attendance Hub has column K: Failing >= 1 class (Current)
For Spartan Hour requests/signups: ⚠️ PARTIALLY The data has limitations:
Totals only: Column Y (Spartan Hour Total Requests) shows cumulative totals, not per-session
Date info exists but needs parsing: The Spartan Hour Intervention tab has:
Column H: Teachers Requesting - format: "Teacher Name (M/DD)"
Column Q: Student Signup / Drop-in - format: "Teacher Name (M/DD)"
The Gap
There's no dedicated column for "most recent session" requests. To identify students NOT requested for the most recent session, you'd need to:
Parse the date strings in the Spartan Hour Intervention tab
Determine what constitutes "most recent" (latest date in the data, or a specific date?)
Cross-reference with failing students from the Academics & Attendance Hub
Is This Possible?
Yes, but requires logic to:
Parse date strings from the text fields
Define/identify "most recent session"
Cross-reference failing students with those who have no request/signup for that date

Would you like me to plan an implementation for this feature? I'd need to clarify:
How do you define "most recent session" - is it a specific date, or the latest date found in the data?
Where should this metric be displayed (dashboard, new column, email report)?