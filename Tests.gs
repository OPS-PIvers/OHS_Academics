/**
 * Tests.gs
 * 🔭 Scout's Diagnostic Tools
 *
 * Contains system health checks and unit tests to ensure codebase reliability.
 * These functions are isolated from the main logic but verify its integrity.
 */

/**
 * Runs a full suite of system health checks.
 * Called by the diagnostic dashboard (tests.html).
 * @returns {Array<Object>} List of check results {name, status, message}.
 */
function runSystemHealthCheck() {
  const results = [];

  // 1. Critical Sheets Check
  checkCriticalSheets(results);

  // 2. Configuration Integrity
  checkSnapshotConfig(results);

  // 3. Logic Unit Test: generateNameKey
  test_generateNameKey(results);

  return results;
}

/**
 * Checks for the existence of required sheets.
 * @param {Array} results - Accumulator array for results.
 */
function checkCriticalSheets(results) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const requiredSheets = [
      "⭐Academics & Attendance Hub",
      "Admin Settings",
      "Historical Snapshots"
    ];

    let allFound = true;
    let missing = [];

    requiredSheets.forEach(name => {
      if (!ss.getSheetByName(name)) {
        allFound = false;
        missing.push(name);
      }
    });

    if (allFound) {
      results.push({
        name: "Critical Sheets Existence",
        status: "PASSED",
        message: "All required sheets found."
      });
    } else {
      results.push({
        name: "Critical Sheets Existence",
        status: "FAILED",
        message: "Missing sheets: " + missing.join(", ")
      });
    }
  } catch (e) {
    results.push({
      name: "Critical Sheets Existence",
      status: "FAILED",
      message: "Error accessing spreadsheet: " + e.toString()
    });
  }
}

/**
 * Validates the Snapshot Metrics Configuration.
 * @param {Array} results - Accumulator array for results.
 */
function checkSnapshotConfig(results) {
  try {
    // In GAS V8, top-level consts from other files are accessible.
    // We check if it's defined and valid.
    if (typeof SNAPSHOT_METRICS_CONFIG === 'undefined') {
      results.push({
        name: "Snapshot Config Integrity",
        status: "FAILED",
        message: "SNAPSHOT_METRICS_CONFIG is undefined. Check Code.js."
      });
      return;
    }

    if (!Array.isArray(SNAPSHOT_METRICS_CONFIG) || SNAPSHOT_METRICS_CONFIG.length === 0) {
      results.push({
        name: "Snapshot Config Integrity",
        status: "FAILED",
        message: "SNAPSHOT_METRICS_CONFIG is not a valid array."
      });
      return;
    }

    // Check first item structure
    const firstItem = SNAPSHOT_METRICS_CONFIG[0];
    if (!firstItem.hasOwnProperty('key') || !firstItem.hasOwnProperty('header')) {
      results.push({
        name: "Snapshot Config Integrity",
        status: "FAILED",
        message: "Config items missing required 'key' or 'header' properties."
      });
      return;
    }

    results.push({
      name: "Snapshot Config Integrity",
      status: "PASSED",
      message: `Config is valid with ${SNAPSHOT_METRICS_CONFIG.length} metrics.`
    });

  } catch (e) {
     results.push({
       name: "Snapshot Config Integrity",
       status: "FAILED",
       message: e.toString()
     });
  }
}

/**
 * Unit test for generateNameKey logic.
 * @param {Array} results - Accumulator array for results.
 */
function test_generateNameKey(results) {
  try {
    if (typeof generateNameKey !== 'function') {
      results.push({
        name: "Logic Test: generateNameKey",
        status: "FAILED",
        message: "Function generateNameKey not found in global scope."
      });
      return;
    }

    const cases = [
      { input: "Doe, John", expected: "doe|john" },
      { input: "John Doe", expected: "doe|john" },
      { input: "Doe, John Middle", expected: "doe|john" }, // Expected behavior: "John Middle" -> "John"
      { input: "  Doe,   John  ", expected: "doe|john" },
      { input: "Prince", expected: "prince" }, // Mononym
      { input: "Van Helsing, Abraham", expected: "van helsing|abraham" },
      { input: null, expected: "" }
    ];

    let pass = true;
    let failedMsg = "";

    cases.forEach(c => {
      const res = generateNameKey(c.input);
      if (res !== c.expected) {
        pass = false;
        failedMsg = `Input: '${c.input}' -> Expected: '${c.expected}', Got: '${res}'`;
      }
    });

    if (pass) {
      results.push({
        name: "Logic Test: generateNameKey",
        status: "PASSED",
        message: "All name parsing cases passed."
      });
    } else {
      results.push({
        name: "Logic Test: generateNameKey",
        status: "FAILED",
        message: failedMsg
      });
    }
  } catch (e) {
    results.push({
      name: "Logic Test: generateNameKey",
      status: "FAILED",
      message: e.toString()
    });
  }
}
