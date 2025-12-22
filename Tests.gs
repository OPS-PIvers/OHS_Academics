/**
 * Tests.gs
 * Isolated server-side unit tests and system health checks.
 * Scouts reliability.
 */

/**
 * Checks if critical sheets exist in the spreadsheet.
 * @returns {Object[]} Array of result objects {name, passed, message}.
 */
function getSystemHealth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    'Admin Settings',
    '⭐Academics & Attendance Hub',
    'Historical Snapshots',
    'Staff Roles',
    'D/F No Request'
  ];

  const results = requiredSheets.map(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    return {
      name: `Sheet Check: ${sheetName}`,
      passed: !!sheet,
      message: sheet ? 'Exists' : 'Missing'
    };
  });

  return results;
}

/**
 * Unit test for generateNameKey function in Code.js.
 * @returns {Object} Result object {name, passed, message}.
 */
function test_generateNameKey() {
  const tests = [
    { input: "Smith, John", expected: "smith|john" },
    { input: "Doe, Jane Marie", expected: "doe|jane" },
    { input: "John Smith", expected: "smith|john" },
    { input: "Prince", expected: "prince" },
    { input: null, expected: "" }
  ];

  let passed = true;
  let message = "All cases passed";

  try {
    tests.forEach(t => {
      // Assumes generateNameKey is available in the global scope (Code.js)
      if (typeof generateNameKey !== 'function') {
        throw new Error("generateNameKey function not found");
      }
      const result = generateNameKey(t.input);
      if (result !== t.expected) {
        throw new Error(`Expected ${t.expected} but got ${result} for input "${t.input}"`);
      }
    });
  } catch (e) {
    passed = false;
    message = e.message;
  }

  return {
    name: "Unit Test: generateNameKey",
    passed: passed,
    message: message
  };
}

/**
 * Runs all server-side tests and returns the results.
 * Exposed to client-side.
 * @returns {Object[]} Array of result objects.
 */
function runAllServerTests() {
  // Ensure user is admin before running tests
  const user = getUserRole();
  if (!user || user.role !== 'ADMIN') {
    throw new Error("Access Denied: Only admins can run system tests.");
  }

  const healthResults = getSystemHealth();
  const unitTestResult = test_generateNameKey();

  return [...healthResults, unitTestResult];
}
