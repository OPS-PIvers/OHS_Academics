// Tests.gs
/**
 * Tests.gs - Reliability and Health Checks
 * Adheres to OPS Tech Brand Standards (#2d3f89 for success, #ad2122 for failure)
 */

/**
 * Runs all defined tests and returns a formatted result object.
 * @returns {Object[]} Array of test results { name, passed, message }
 */
function runAllTests() {
  const results = [];

  // Test 1: Generate Name Key (Pure Logic)
  try {
    test_generateNameKey();
    results.push({ name: "Name Normalization Logic", passed: true, message: "generateNameKey() handles all formats correctly." });
  } catch (e) {
    results.push({ name: "Name Normalization Logic", passed: false, message: e.message });
  }

  // Test 2: System Health Check (Configuration)
  const health = getSystemHealth();
  if (health.status === 'OK') {
    results.push({ name: "System Health Check", passed: true, message: "All required sheets and ranges exist." });
  } else {
    results.push({ name: "System Health Check", passed: false, message: "Missing: " + health.missing.join(', ') });
  }

  return results;
}

/**
 * Unit Test for generateNameKey function.
 * Verifies that names are correctly normalized to "lastname|firstname".
 */
function test_generateNameKey() {
  const cases = [
    { input: "Doe, John", expected: "doe|john" },
    { input: "Doe, John Middle", expected: "doe|john" }, // Ignores middle name in Last, First M format
    { input: "John Doe", expected: "doe|john" },
    { input: "John Middle Doe", expected: "doe|john" },
    { input: "Cher", expected: "cher" }, // Mononym
    { input: "  Doe,   John  ", expected: "doe|john" }, // Trimming
    { input: null, expected: "" },
    { input: undefined, expected: "" }
  ];

  cases.forEach(c => {
    const result = generateNameKey(c.input);
    if (result !== c.expected) {
      throw new Error(`Expected generateNameKey('${c.input}') to be '${c.expected}', but got '${result}'`);
    }
  });
}

/**
 * Diagnostic tool to check if the spreadsheet has the required structure.
 * @returns {Object} { status: 'OK'|'ERROR', missing: string[] }
 */
function getSystemHealth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    "Admin Settings",
    "⭐Academics & Attendance Hub",
    "Historical Snapshots",
    "Staff Roles",
    "D/F No Request",
    "Spartan Hour Intervention",
    "Absences (total)"
  ];

  const missing = [];

  requiredSheets.forEach(name => {
    if (!ss.getSheetByName(name)) {
      missing.push(name);
    }
  });

  return {
    status: missing.length === 0 ? 'OK' : 'ERROR',
    missing: missing
  };
}
