/**
 * TESTS.gs
 * Server-side unit tests and system health checks.
 * Separated from Code.js to maintain clean production logic.
 */

/**
 * Runs all server-side tests and returns the results.
 * Called by the tests.html frontend.
 */
function runAllTests() {
  const results = [];

  // 1. Unit Test: generateNameKey
  try {
    const key1 = generateNameKey("Doe, John");
    const key2 = generateNameKey("John Doe");
    const key3 = generateNameKey("John Middle Doe");

    if (key1 === "doe|john" && key2 === "doe|john" && key3 === "doe|john") {
      results.push({ name: "Unit Test: generateNameKey Normalization", passed: true, message: "Correctly normalized various name formats." });
    } else {
      results.push({ name: "Unit Test: generateNameKey Normalization", passed: false, message: `Failed. Got: ${key1}, ${key2}, ${key3}` });
    }
  } catch (e) {
    results.push({ name: "Unit Test: generateNameKey", passed: false, message: e.message });
  }

  // 2. Unit Test: calculateSnapshotDiff
  try {
    const s1 = { snapshotDate: new Date(), totalStudents: 100, ineligibleStudents: 10 };
    const s2 = { snapshotDate: new Date(), totalStudents: 110, ineligibleStudents: 5 };
    s1.formattedDate = "Date 1";
    s2.formattedDate = "Date 2";

    const diff = calculateSnapshotDiff(s1, s2);

    // Check totalStudents change (+10)
    const totalChange = diff.changes.find(c => c.metric === 'Total Students');
    // Check ineligibleStudents change (-5)
    const ineligibleChange = diff.changes.find(c => c.metric === 'Ineligible Students');

    if (totalChange && totalChange.delta == 10 && ineligibleChange && ineligibleChange.delta == -5) {
        results.push({ name: "Unit Test: calculateSnapshotDiff Logic", passed: true, message: "Correctly calculated deltas." });
    } else {
        results.push({ name: "Unit Test: calculateSnapshotDiff Logic", passed: false, message: "Incorrect deltas calculated." });
    }
  } catch (e) {
    results.push({ name: "Unit Test: calculateSnapshotDiff", passed: false, message: e.message });
  }

  // 3. System Health: Sheet Existence
  try {
    const missingSheets = getSystemHealth();
    if (missingSheets.length === 0) {
      results.push({ name: "System Health: Required Sheets", passed: true, message: "All required sheets are present." });
    } else {
      results.push({ name: "System Health: Required Sheets", passed: false, message: `Missing sheets: ${missingSheets.join(', ')}` });
    }
  } catch (e) {
    results.push({ name: "System Health: Check Failed", passed: false, message: e.message });
  }

  return results;
}

/**
 * Checks for the existence of critical sheets.
 * @returns {string[]} Array of missing sheet names.
 */
function getSystemHealth() {
  const requiredSheets = [
    "Admin Settings",
    "⭐Academics & Attendance Hub",
    "Historical Snapshots",
    "Staff Roles",
    "D/F No Request",
    "Spartan Hour Intervention",
    "Absences (total)"
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const missing = [];

  requiredSheets.forEach(name => {
    if (!ss.getSheetByName(name)) {
      missing.push(name);
    }
  });

  return missing;
}
