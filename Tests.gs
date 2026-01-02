/**
 * Tests.gs
 * Server-side test functions and system health checks.
 */

/**
 * Runs a full system health check.
 * @returns {Object} Health status object.
 */
function getSystemHealth() {
  const health = {
    status: 'HEALTHY',
    checks: []
  };

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Check 1: Critical Sheets Existence
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
    if (!exists) health.status = 'FAILING';
    health.checks.push({
      name: `Sheet: ${sheetName}`,
      passed: exists,
      message: exists ? 'Exists' : 'Missing critical sheet'
    });
  });

  // Check 2: Admin Settings Data
  const adminSheet = ss.getSheetByName('Admin Settings');
  if (adminSheet) {
    const lastRow = adminSheet.getLastRow();
    const hasData = lastRow > 1; // Assuming header is row 1
    if (!hasData) health.status = 'FAILING';
    health.checks.push({
      name: 'Admin Settings Data',
      passed: hasData,
      message: hasData ? `Found ${lastRow-1} rows` : 'Sheet is empty'
    });
  }

  // Check 3: Current User is Admin (Self-check for context)
  // This helps debug permission issues if the tool is run by non-admin
  const userEmail = Session.getActiveUser().getEmail();
  health.checks.push({
    name: `User Context (${userEmail})`,
    passed: true, // Info only
    message: 'Active'
  });

  return health;
}

/**
 * Unit test runner for server-side logic.
 * Can be triggered manually from the editor.
 */
function runAllTests() {
  const results = [];

  // Test 1: generateNameKey (Logic from Code.js)
  try {
    const key1 = generateNameKey("Doe, John");
    const pass1 = key1 === "doe|john";
    results.push({ name: "generateNameKey('Doe, John')", passed: pass1, expected: "doe|john", actual: key1 });

    const key2 = generateNameKey("John Doe");
    const pass2 = key2 === "doe|john";
    results.push({ name: "generateNameKey('John Doe')", passed: pass2, expected: "doe|john", actual: key2 });

  } catch (e) {
    results.push({ name: "generateNameKey Exception", passed: false, error: e.message });
  }

  // Log results
  results.forEach(r => {
    if (r.passed) {
      Logger.log(`✅ PASS: ${r.name}`);
    } else {
      console.error(`❌ FAIL: ${r.name}`, r);
    }
  });

  return results;
}
