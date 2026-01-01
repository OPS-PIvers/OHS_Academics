/**
 * @OnlyCurrentDoc
 */

/**
 * Runs a suite of server-side system health checks.
 * @returns {Object} An object containing the results of each check.
 */
function getSystemHealth() {
  const results = {
    sheets: {},
    data: {},
    unitTests: {},
    overallStatus: 'PASS'
  };

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sheet Existence Checks
  const requiredSheets = [
    'Admin Settings',
    '⭐Academics & Attendance Hub',
    'Historical Snapshots',
    'Staff Roles',
    'D/F No Request',
    'Spartan Hour Intervention',
    'Absences (total)'
  ];

  requiredSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    const exists = !!sheet;
    results.sheets[sheetName] = exists;
    if (!exists) results.overallStatus = 'FAIL';
  });

  // 2. Data Integrity Checks
  if (results.sheets['Admin Settings']) {
    const sheet = ss.getSheetByName('Admin Settings');
    const lastRow = sheet.getLastRow();
    results.data['Admin Settings Has Data'] = lastRow > 1;
    if (lastRow <= 1) results.overallStatus = 'FAIL';
  } else {
    results.data['Admin Settings Has Data'] = false;
  }

  // 3. Unit Tests (Pure Logic)

  // Test generateNameKey
  try {
    const testCases = [
      { input: "Doe, John", expected: "doe|john" },
      { input: "John Doe", expected: "doe|john" },
      { input: "Doe, John Middle", expected: "doe|john" },
      { input: "John Middle Doe", expected: "doe|john" },
      { input: "Cher", expected: "cher" }
    ];

    let allPassed = true;
    testCases.forEach(tc => {
      const result = generateNameKey(tc.input);
      if (result !== tc.expected) {
        console.error(`generateNameKey failed for "${tc.input}". Expected: "${tc.expected}", Got: "${result}"`);
        allPassed = false;
      }
    });
    results.unitTests['generateNameKey'] = allPassed;
    if (!allPassed) results.overallStatus = 'FAIL';
  } catch (e) {
    console.error("generateNameKey test threw error: " + e.message);
    results.unitTests['generateNameKey'] = false;
    results.overallStatus = 'FAIL';
  }

  // Test calculateSnapshotDiff (Pure Logic via compareSnapshots internal logic)
  // We can't easily test calculateSnapshotDiff because it's inside compareSnapshots or not extracted yet.
  // I'll skip this for now as I didn't extract it yet.

  return results;
}
