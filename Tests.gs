/**
 * Tests.gs
 * Aggregates system health checks and unit tests.
 * Scout's Reliability Suite.
 */

/**
 * Runs all defined tests and returns a combined result array.
 * @returns {Object[]} Array of test result objects { name, passed, message }
 */
function runAllTests() {
  const results = [];

  // 1. System Health Checks
  try {
    results.push(...test_systemHealth());
  } catch (e) {
    results.push({
      name: "System Health Critical Failure",
      passed: false,
      message: e.toString()
    });
  }

  // 2. Unit Tests
  try {
    results.push(test_generateNameKey());
  } catch (e) {
    results.push({
      name: "Unit Test Critical Failure",
      passed: false,
      message: e.toString()
    });
  }

  return results;
}

/**
 * Verifies that all critical sheets exist in the spreadsheet.
 * @returns {Object[]} Array of results for each sheet.
 */
function test_systemHealth() {
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

  return requiredSheets.map(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    return {
      name: `Sheet Check: ${sheetName}`,
      passed: !!sheet,
      message: sheet ? "Sheet exists" : "CRITICAL: Sheet is missing from the spreadsheet"
    };
  });
}

/**
 * Unit test for the generateNameKey function in Code.js.
 * Verifies name normalization logic.
 * @returns {Object} Test result object.
 */
function test_generateNameKey() {
  const cases = [
    { input: "Doe, John", expected: "doe|john" },
    { input: "Doe, John Middle", expected: "doe|john" },
    { input: "John Doe", expected: "doe|john" },
    { input: "John Middle Doe", expected: "doe|john" },
    { input: "Cher", expected: "cher" }, // Edge case: Mononym
    { input: "  Doe,   John  ", expected: "doe|john" }, // Edge case: Whitespace
    { input: null, expected: "" },
    { input: undefined, expected: "" }
  ];

  const failures = [];

  for (const c of cases) {
    try {
      const result = generateNameKey(c.input);
      if (result !== c.expected) {
        failures.push(`Input: "${c.input}" -> Expected: "${c.expected}", Got: "${result}"`);
      }
    } catch (e) {
      failures.push(`Input: "${c.input}" -> Threw Error: ${e.message}`);
    }
  }

  if (failures.length > 0) {
    return {
      name: "Unit Test: generateNameKey",
      passed: false,
      message: "Failures:\n" + failures.join("\n")
    };
  }

  return {
    name: "Unit Test: generateNameKey",
    passed: true,
    message: `Passed all ${cases.length} test cases.`
  };
}
