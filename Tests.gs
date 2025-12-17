/**
 * @OnlyCurrentDoc
 */

// ===============================================================
// SCOUT'S RELIABILITY SUITE
// ===============================================================

/**
 * Unit test for generateNameKey function.
 * Verifies that names are correctly normalized for comparison.
 */
function test_generateNameKey() {
  const tests = [
    { input: "Smith, John", expected: "smith|john" },
    { input: "Smith, John David", expected: "smith|john" },
    { input: "Doe, Jane", expected: "doe|jane" },
    { input: "John Smith", expected: "smith|john" },
    { input: "John David Smith", expected: "smith|john" },
    { input: " Cher ", expected: "cher" }, // Mononym/Edge case
    { input: "", expected: "" },
    { input: null, expected: "" },
    { input: 123, expected: "123" }
  ];

  let passed = 0;
  let failed = 0;

  Logger.log("🧪 STARTING TEST: generateNameKey");

  tests.forEach(test => {
    try {
      const result = generateNameKey(test.input);
      if (result === test.expected) {
        passed++;
      } else {
        failed++;
        Logger.log(`❌ FAILED: Input "${test.input}" -> Expected "${test.expected}", got "${result}"`);
      }
    } catch (e) {
      failed++;
      Logger.log(`❌ ERROR: Input "${test.input}" threw error: ${e.message}`);
    }
  });

  if (failed === 0) {
    Logger.log(`✅ ALL TESTS PASSED (${passed}/${tests.length})`);
  } else {
    Logger.log(`⚠️ TESTS FAILED (${failed}/${tests.length})`);
  }
}

/**
 * Diagnostic check for System Health.
 * Verifies critical configuration sheets exist.
 * This is a "Safe" check that doesn't modify data.
 */
function test_systemHealth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    "⭐Academics & Attendance Hub",
    "Admin Settings",
    "Spartan Hour Intervention",
    "Absences (total)"
  ];

  Logger.log("🩺 STARTING DIAGNOSTIC: System Health");

  let issues = [];

  requiredSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      issues.push(`❌ Missing Sheet: ${sheetName}`);
    } else {
      // Basic data check
      if (sheet.getLastRow() < 2) {
         issues.push(`⚠️ Empty Sheet: ${sheetName} (Has headers only or empty)`);
      }
    }
  });

  if (issues.length === 0) {
    Logger.log("✅ SYSTEM HEALTH CHECK PASSED: All required sheets found.");
  } else {
    Logger.log("⚠️ SYSTEM HEALTH ISSUES FOUND:");
    issues.forEach(issue => Logger.log(issue));
  }
}
