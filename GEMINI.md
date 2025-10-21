# OHS_Academics Project Overview

This project is a comprehensive Google Apps Script solution designed to manage, analyze, and visualize student academic and attendance data for OHS (likely a school). It integrates deeply with Google Sheets to store and process data, providing automated email notification features and an interactive web-based dashboard.

## Project Structure and Technologies

*   **Core Logic:** Implemented in Google Apps Script (JavaScript) within `Code.js`.
*   **Data Storage:** Primarily Google Sheets, with specific sheets expected for "Admin Settings", "⭐Academics & Attendance Hub", and "✎Activity Advisors & Coaches". The `spreadsheet_column_map.md` file details the expected column structure.
*   **Web Application:** A client-side dashboard built with HTML (`index.html`), styled using Tailwind CSS, and featuring interactive charts powered by Chart.js and data manipulation with Lodash.
*   **Development Tooling:** Uses `clasp` for command-line interaction with Google Apps Script projects.

## Key Features

1.  **Automated Email Notifications:**
    *   **Counselor Summary Emails:** Sends summary emails to counselors with lists of students failing classes, based on their assigned last-name alpha ranges.
    *   **Activity Advisor Ineligibility Notifications:** Notifies activity advisors about students who are ineligible for activities.
    *   **Administrator Eligibility Summary:** Provides administrators with a summary of all ineligible and at-risk students.
    *   **Case Manager Failure Reports:** Sends tailored reports to case managers regarding students on their caseload who are failing classes.
2.  **Interactive Web Dashboard:**
    *   Provides a visual overview of student performance and attendance.
    *   Displays Key Performance Indicators (KPIs) such as total students, ineligible students, ineligibility rate, average absences, and total F grades.
    *   Includes charts for attendance breakdown, ineligibility reasons, correlation between failing grades and absences, and performance comparison between activity and non-activity students.
    *   Features a student lookup table with filtering (by grade, activity, eligibility status, and search by name) and sorting capabilities.

## Building and Running

This project is a Google Apps Script, typically deployed and managed through the Google Apps Script editor or the `clasp` command-line tool.

*   **Deployment:** Changes made to `Code.js` and `index.html` are deployed to the Google Apps Script environment. If using `clasp`, `clasp push` is the command to deploy local changes.
*   **Web App Access:** The `doGet()` function in `Code.js` serves `index.html`. Once deployed as a web app, it can be accessed via a URL provided by Google Apps Script.
*   **Automated Functions (Triggers):** Many of the email notification functions are designed to be executed automatically via time-driven triggers configured within the Google Apps Script project settings. These triggers would typically be set to run daily or weekly.
*   **Spreadsheet Integration:** The script is designed to be container-bound to a specific Google Sheet, from which it reads and processes student and administrative data.

## Development Conventions

*   **Container-Bound Script:** The `@OnlyCurrentDoc` annotation in `Code.js` indicates that the script is intended to be bound to a specific Google Sheet, limiting its access scope to that document.
*   **Specific Sheet Names:** The script relies on the presence of sheets named "Admin Settings", "⭐Academics & Attendance Hub", and "✎Activity Advisors & Coaches" within the bound spreadsheet.
*   **Client-Server Communication:** The web app (`index.html`) communicates with the Apps Script backend (`Code.js`) using `google.script.run` for asynchronous function calls.
*   **Logging:** `Logger.log()` is used for debugging and tracking script execution within the Google Apps Script environment.
*   **Data Structure:** The `spreadsheet_column_map.md` file serves as critical documentation for the expected data schema within the Google Sheets, outlining column names, indices, and data types.
