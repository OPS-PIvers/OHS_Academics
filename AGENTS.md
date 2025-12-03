# AGENTS.md

## Project Overview
**OHS_Academics** is a Google Apps Script application designed to manage, analyze, and visualize student academic and attendance data for a school. It consists of a Google Sheets backend for data storage and processing, and a web-based dashboard for visualization.

## Tech Stack
*   **Backend**: Google Apps Script (JavaScript).
*   **Frontend**: HTML5, Tailwind CSS (via CDN), Chart.js (via CDN), Lodash (via CDN). **Security Note:** All CDN links must use HTTPS and include Subresource Integrity (SRI) hashes and `crossorigin="anonymous"`.
*   **Data Storage**: Google Sheets.
*   **Deployment**: `clasp` (Command Line Apps Script Projects).

## File Structure
*   `Code.js`: Contains all server-side logic, including data retrieval, email automation, and serving the web app.
*   `index.html`: The client-side code for the dashboard, including HTML, CSS (Tailwind), and JavaScript (Chart.js logic).
*   `spreadsheet_column_map.md`: **CRITICAL**. Maps spreadsheet columns to data fields. Always refer to this when modifying data retrieval logic.
*   `SNAPSHOT_SETUP.md`: Documentation for the historical snapshot system.
*   `README.md` & `GEMINI.md`: General project documentation.

## Data Flow & Architecture
1.  **Data Source**: Data resides in the Google Sheet, primarily in the `⭐Academics & Attendance Hub` tab.
2.  **Backend Processing**: `Code.js` reads data from the sheet, processes it (filtering, aggregation), and exposes it via `google.script.run`.
3.  **Frontend Visualization**: `index.html` fetches data from the backend and renders it using Chart.js and dynamic HTML generation.

## Development Guidelines

### Backend (`Code.js`)
*   **Container-Bound**: The script is container-bound to a specific Google Sheet. Use `SpreadsheetApp.getActiveSpreadsheet()` to access data.
*   **Role-Based Access**: The system supports multiple roles (`ADMIN`, `COUNSELOR`, `TEACHER`). Ensure any new data endpoints respect these roles.
*   **Snapshot System**: The `SNAPSHOT_METRICS_CONFIG` constant in `Code.js` defines metrics for historical snapshots. Update this config if adding new global metrics.
*   **Email Notifications**: Functions like `sendTier2InstructorEmails`, `sendCounselorSummaryEmails`, and `sendIneligibilityNotifications` handle automated emails. These are typically triggered by time-based triggers.

### Frontend (`index.html`)
*   **Single File Component**: All client-side logic (HTML, CSS, JS) is currently in `index.html`. Keep this structure unless splitting is explicitly requested.
*   **Security**: Any new external libraries must be loaded via HTTPS from a reputable CDN and **MUST** include SRI hashes (`integrity` attribute) and `crossorigin="anonymous"`. Pin exact versions; do not use `latest` tags.
*   **Tailwind CSS**: Used for styling. Do not add custom CSS unless necessary.
*   **Chart.js**: Used for all charts. Ensure charts are responsive and handle empty data gracefully.
*   **Lodash**: Available for data manipulation on the client side.

### Spreadsheet Integration
*   **Column Mapping**: **NEVER** hardcode column indices without checking `spreadsheet_column_map.md`. The spreadsheet structure is fragile.
*   **Sheet Names**: The code relies on specific sheet names (e.g., "⭐Academics & Attendance Hub", "Admin Settings"). Do not change these in the code unless the sheet itself has changed.

## Testing & Verification
Since there is no automated test suite:
1.  **Manual Verification**: After changing `Code.js`, use `console.log` or `Logger.log` to verify data retrieval.
2.  **Frontend Checks**: Open the web app (or deployment URL) to verify UI changes. Check browser console for errors.
3.  **Spreadsheet Integrity**: Ensure no data in the spreadsheet is corrupted by script executions.

## Deployment
*   Use `clasp push` to upload changes to the Google Apps Script project.
*   **Manifest**: `appsscript.json` manages project configuration.

## Specific Instructions for Agents
*   **Adding Metrics**: If asked to add a new metric:
    1.  Check `spreadsheet_column_map.md` to find the source column.
    2.  Update `SNAPSHOT_METRICS_CONFIG` in `Code.js` if it's a global metric.
    3.  Update `getAggregatedStats` and `getStudentDataForWebApp` in `Code.js`.
    4.  Update the frontend in `index.html` to display the new metric.
*   **Modifying Emails**: When changing email templates, ensure the HTML is valid and inline styles are used for maximum client compatibility.
*   **Privacy**: **NEVER** expose student names to the `TEACHER` role or in global aggregate views. Use anonymization where appropriate (e.g., `getAnonymizedStudentData`).

## Common Tasks
*   **Update Column Map**: If the spreadsheet columns change, update `spreadsheet_column_map.md` first, then update column indices in `Code.js`.
*   **New Chart**: Add a canvas element in `index.html` and initialize a new Chart instance in the `renderCharts` function.
