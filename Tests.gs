/**
 * @OnlyCurrentDoc
 * Tests.gs - Server-side testing and health checks.
 */

/**
 * Unit test for generateNameKey.
 * This logic is pure (no GAS dependencies) so it's a great candidate for testing.
 * @return {Object} Test results with pass/fail counts and messages.
 */
function test_generateNameKey() {
  const testCases = [
    { input: "Smith, John", expected: "smith|john" },
    { input: "Doe, Jane", expected: "doe|jane" },
    { input: "  White ,  Walter  ", expected: "white|walter" }, // Trimming
    { input: "Potter, Harry James", expected: "potter|harry" }, // Middle name ignored in Last, First format
    { input: "Hermione Granger", expected: "granger|hermione" }, // First Last format
    { input: "Ron Bilius Weasley", expected: "weasley|ron" }, // First Middle Last format
    { input: "Cher", expected: "cher" }, // Mononym
    { input: "", expected: "" },
    { input: null, expected: "" }
  ];

  const results = {
    passed: 0,
    failed: 0,
    failures: []
  };

  testCases.forEach(tc => {
    try {
      // Assuming generateNameKey is available in the global scope (Code.js)
      const actual = generateNameKey(tc.input);
      if (actual === tc.expected) {
        results.passed++;
      } else {
        results.failed++;
        results.failures.push(`Input: "${tc.input}" | Expected: "${tc.expected}" | Actual: "${actual}"`);
      }
    } catch (e) {
      results.failed++;
      results.failures.push(`Input: "${tc.input}" | Exception: ${e.message}`);
    }
  });

  return results;
}

/**
 * Aggregated System Health Check.
 * Called by the frontend (tests.html) to verify system status.
 * @return {Object} System health report.
 */
function getSystemHealth() {
  const validationTest = test_generateNameKey();

  // Verify Critical Sheets Exist
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    "Admin Settings",
    "⭐Academics & Attendance Hub",
    "Spartan Hour Intervention",
    "D/F No Request"
  ];

  const sheetStatus = requiredSheets.map(name => {
    const sheet = ss.getSheetByName(name);
    return {
      name: name,
      exists: !!sheet,
      rows: sheet ? sheet.getLastRow() : 0
    };
  });

  // Verify Critical Config
  const configStatus = {
    snapshotMetrics: typeof SNAPSHOT_METRICS_CONFIG !== 'undefined' && Array.isArray(SNAPSHOT_METRICS_CONFIG)
  };

  return {
    timestamp: new Date().getTime(), // Return timestamp for client formatting
    tests: {
      generateNameKey: validationTest
    },
    infrastructure: {
      sheets: sheetStatus,
      config: configStatus
    }
  };
}
