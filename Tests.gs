/**
 * @OnlyCurrentDoc
 */

/**
 * Diagnostic function to verify system health.
 * Checks for required sheets and user role resolution.
 * @returns {Object[]} Array of check results.
 */
function getSystemHealth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const checks = [];

  // Check 1: Sheets Existence
  const requiredSheets = [
    "⭐Academics & Attendance Hub",
    "Admin Settings",
    "Historical Snapshots",
    "Spartan Hour Intervention",
    "Absences (total)",
    "Staff Roles"
  ];

  requiredSheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    checks.push({
      test: `Sheet Exists: ${name}`,
      passed: !!sheet,
      message: sheet ? "Found" : "Missing"
    });
  });

  // Check 2: Current User Role
  try {
    const userRole = getUserRole(); // Dependent on Code.js
    checks.push({
      test: "User Role Resolution",
      passed: !!userRole,
      message: userRole ? `Resolved as ${userRole.role} (${userRole.email})` : "Failed to resolve role"
    });

    // Check 3: Admin Access (Diagnostic tool is admin only)
    if (userRole) {
      checks.push({
        test: "Admin Access Check",
        passed: userRole.role === 'ADMIN',
        message: userRole.role === 'ADMIN' ? "User has ADMIN privileges" : `User is ${userRole.role}, need ADMIN`
      });
    }
  } catch (e) {
    checks.push({
      test: "User Role Resolution",
      passed: false,
      message: `Error: ${e.message}`
    });
  }

  // Check 4: Data Integrity (Basic)
  // Check if generateNameKey works as expected (Unit Test within Health Check)
  try {
    const key = generateNameKey("Doe, John");
    const expected = "doe|john";
    if (key === expected) {
      checks.push({
        test: "Unit Test: generateNameKey",
        passed: true,
        message: `Correctly normalized to '${key}'`
      });
    } else {
      checks.push({
        test: "Unit Test: generateNameKey",
        passed: false,
        message: `Expected '${expected}', got '${key}'`
      });
    }
  } catch (e) {
    checks.push({
      test: "Unit Test: generateNameKey",
      passed: false,
      message: `Error: ${e.message}`
    });
  }

  return checks;
}

/**
 * Unit test for generateNameKey to be run manually or via CI.
 * Satisfies "Add ONE test case".
 */
function test_generateNameKey() {
  const testCases = [
    { input: "Doe, John", expected: "doe|john" },
    { input: "Doe, John Middle", expected: "doe|john" },
    { input: "John Doe", expected: "doe|john" },
    { input: "John Middle Doe", expected: "doe|john" },
    { input: "Cher", expected: "cher" }, // Mononym
    { input: "", expected: "" },
    { input: null, expected: "" }
  ];

  let passed = 0;
  testCases.forEach(tc => {
    const result = generateNameKey(tc.input);
    if (result === tc.expected) {
      passed++;
    } else {
      console.error(`FAIL: Input "${tc.input}" -> Expected "${tc.expected}", Got "${result}"`);
    }
  });

  if (passed === testCases.length) {
    Logger.log(`All ${passed} tests passed for generateNameKey.`);
  } else {
    throw new Error(`${testCases.length - passed} tests failed for generateNameKey.`);
  }
}
