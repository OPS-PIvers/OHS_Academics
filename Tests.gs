/**
 * SCOUT - Reliability & Testing Module
 *
 * This file contains unit tests and health checks for the codebase.
 * It is designed to be run manually or via the "System Health Diagnostic" tool.
 *
 * Brand Compliance:
 * - Passing Tests: Primary Blue (#2d3f89)
 * - Failing Tests: Primary Red (#ad2122)
 * - Font: Lexend
 */

// ===============================================================
// TEST RUNNER
// ===============================================================

/**
 * Executes all registered unit tests and returns a results object.
 * @returns {Object} Results object { passed, failed, logs, suites }
 */
function runScoutTests() {
  const results = {
    passed: 0,
    failed: 0,
    logs: [],
    suites: []
  };

  log("🔭 SCOUT: Starting Test Run...", results);

  // Register test suites here
  runSuite("Name Normalization", test_generateNameKey, results);
  runSuite("Student Card HTML", test_createStudentCardHtml, results);
  runSuite("System Health Check", test_systemHealth, results);

  // Summary
  log("\n========================================", results);
  if (results.failed === 0) {
    log(`✅ ALL TESTS PASSED (${results.passed}/${results.passed})`, results);
  } else {
    log(`❌ SOME TESTS FAILED (${results.failed}/${results.passed + results.failed})`, results);
  }
  log("========================================", results);

  return results;
}

/**
 * Generates a visual HTML report of the test results.
 * Follows OPS Tech Brand Guidelines (Lexend font, specific hex colors).
 * @returns {string} HTML content.
 */
function getTestReportHtml() {
  const results = runScoutTests();
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy 'at' h:mm a");

  let suitesHtml = results.suites.map(suite => {
    const itemsHtml = suite.items.map(item => `
      <div style="border-bottom: 1px solid #e5e7eb; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #333333;">${item.message}</span>
        <span style="font-weight: bold; color: ${item.passed ? '#2d3f89' : '#ad2122'};">
          ${item.passed ? 'PASSED' : 'FAILED'}
        </span>
      </div>
      ${!item.passed && item.details ? `<div style="background-color: #fce8e6; color: #ad2122; padding: 5px 10px; font-size: 12px; margin-top: 5px; border-radius: 4px;">${item.details}</div>` : ''}
    `).join('');

    const suiteStatusColor = suite.failed === 0 ? '#2d3f89' : '#ad2122';
    const suiteBgColor = suite.failed === 0 ? '#e6eaf5' : '#fce8e6'; // Light blue or light red bg for header

    return `
      <div style="margin-bottom: 20px; border: 1px solid ${suiteStatusColor}; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${suiteBgColor}; padding: 10px 15px; border-bottom: 1px solid ${suiteStatusColor};">
          <h3 style="margin: 0; color: ${suiteStatusColor}; font-size: 16px;">${suite.name}</h3>
        </div>
        <div style="padding: 10px 15px; background-color: #ffffff;">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  const statusColor = results.failed === 0 ? '#2d3f89' : '#ad2122';
  const statusText = results.failed === 0 ? 'SYSTEM HEALTHY' : 'ISSUES DETECTED';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Lexend', sans-serif; background-color: #f3f4f6; padding: 20px; margin: 0; }
        .container { max-width: 800px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
        .title h1 { margin: 0; font-size: 24px; color: #1f2937; }
        .title p { margin: 5px 0 0; color: #6b7280; font-size: 14px; }
        .status-badge { background-color: ${statusColor}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title">
            <h1>🔭 Scout Diagnostic Report</h1>
            <p>Run Date: ${timestamp}</p>
          </div>
          <div class="status-badge">${statusText}</div>
        </div>

        <div class="summary" style="margin-bottom: 30px; display: flex; gap: 20px;">
           <div style="flex: 1; padding: 15px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
             <div style="font-size: 24px; font-weight: bold; color: #2d3f89;">${results.passed}</div>
             <div style="color: #6b7280; font-size: 12px; font-weight: 500;">PASSED</div>
           </div>
           <div style="flex: 1; padding: 15px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
             <div style="font-size: 24px; font-weight: bold; color: ${results.failed > 0 ? '#ad2122' : '#6b7280'};">${results.failed}</div>
             <div style="color: #6b7280; font-size: 12px; font-weight: 500;">FAILED</div>
           </div>
        </div>

        ${suitesHtml}

        <div style="text-align: center; margin-top: 40px; color: #9ca3af; font-size: 12px;">
          Generated by Scout Reliability Module
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Helper to log message to both Logger and results object.
 */
function log(msg, results) {
  Logger.log(msg);
  results.logs.push(msg);
}

/**
 * Helper to run a test suite (function) and track results.
 */
function runSuite(suiteName, testFn, results) {
  log(`\n[ ${suiteName} ]`, results);
  const suiteResult = {
    name: suiteName,
    passed: 0,
    failed: 0,
    items: []
  };

  try {
    testFn(results, suiteResult);
  } catch (e) {
    log(`🔥 CRITICAL ERROR in suite ${suiteName}: ${e.message}`, results);
    results.failed++;
    suiteResult.failed++;
    suiteResult.items.push({
      message: "Suite Execution Error",
      passed: false,
      details: e.message
    });
  }

  results.suites.push(suiteResult);
}

/**
 * Assertion helper.
 */
function assert(condition, message, results, suiteResult) {
  if (condition) {
    log(`  ✅ PASS: ${message}`, results);
    results.passed++;
    suiteResult.passed++;
    suiteResult.items.push({ message, passed: true });
  } else {
    log(`  ❌ FAIL: ${message}`, results);
    results.failed++;
    suiteResult.failed++;
    suiteResult.items.push({ message, passed: false });
  }
}

/**
 * Assertion helper for equality.
 */
function assertEqual(actual, expected, message, results, suiteResult) {
  if (actual === expected) {
    log(`  ✅ PASS: ${message}`, results);
    results.passed++;
    suiteResult.passed++;
    suiteResult.items.push({ message, passed: true });
  } else {
    const errorMsg = `${message} (Expected: "${expected}", Actual: "${actual}")`;
    log(`  ❌ FAIL: ${errorMsg}`, results);
    results.failed++;
    suiteResult.failed++;
    suiteResult.items.push({ message, passed: false, details: `Expected: "${expected}", Actual: "${actual}"` });
  }
}

// ===============================================================
// DIAGNOSTIC TOOLS (HEALTH CHECKS)
// ===============================================================

/**
 * Checks system health (sheet existence).
 * Designed to be run as part of the test suite.
 */
function test_systemHealth(results, suiteResult) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    "Admin Settings",
    "⭐Academics & Attendance Hub",
    "Spartan Hour Intervention",
    "Absences (total)",
    "Staff Roles"
  ];

  requiredSheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    assert(!!sheet, `Sheet exists: ${name}`, results, suiteResult);
  });
}

/**
 * Public function to get system health data (for use by other modules if needed).
 */
function getSystemHealth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    "Admin Settings",
    "⭐Academics & Attendance Hub",
    "Spartan Hour Intervention",
    "Absences (total)",
    "Staff Roles"
  ];

  const health = {
    sheets: {},
    allSheetsExist: true
  };

  requiredSheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    const exists = !!sheet;
    health.sheets[name] = exists;
    if (!exists) health.allSheetsExist = false;
  });

  return health;
}

// ===============================================================
// UNIT TESTS
// ===============================================================

/**
 * Tests for generateNameKey(name)
 */
function test_generateNameKey(results, suiteResult) {
  // 1. "Last, First" format
  assertEqual(generateNameKey("Doe, John"), "doe|john", "Handles 'Last, First'", results, suiteResult);

  // 2. "Last, First Middle" format (should ignore middle)
  assertEqual(generateNameKey("Doe, John A."), "doe|john", "Handles 'Last, First Middle'", results, suiteResult);

  // 3. "First Last" format
  assertEqual(generateNameKey("John Doe"), "doe|john", "Handles 'First Last'", results, suiteResult);

  // 4. "First Middle Last" format
  assertEqual(generateNameKey("John A. Doe"), "doe|john", "Handles 'First Middle Last'", results, suiteResult);

  // 5. Mononym
  assertEqual(generateNameKey("Cher"), "cher", "Handles Mononym", results, suiteResult);

  // 6. Extra whitespace
  assertEqual(generateNameKey("  John   Doe  "), "doe|john", "Handles extra whitespace", results, suiteResult);

  // 7. Case insensitivity
  assertEqual(generateNameKey("JOHN DOE"), "doe|john", "Handles all caps", results, suiteResult);

  // 8. Null/Undefined
  assertEqual(generateNameKey(null), "", "Handles null", results, suiteResult);
  assertEqual(generateNameKey(undefined), "", "Handles undefined", results, suiteResult);
}

/**
 * Tests for createStudentCardHtml(student, spartanData, studentAbsenceData, isPromiseFellow)
 */
function test_createStudentCardHtml(results, suiteResult) {
  // Mock Data
  const mockStudent = {
    name: "Test Student",
    grade: 10,
    failing: "Math\nScience",
    consecutiveWeeks: 2,
    detention: 1
  };

  const mockSpartanData = {
    requests: "2",
    skipped: "1",
    signups: "3"
  };

  const mockAbsenceData = {
    p0: 0, p1: 1, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, sphr: 0
  };

  // Test 1: Standard View (Tier 2 Instructor)
  const htmlStandard = createStudentCardHtml(mockStudent, mockSpartanData, mockAbsenceData, false);

  assert(htmlStandard.includes("Test Student"), "Standard: Contains student name", results, suiteResult);
  assert(htmlStandard.includes("Math, Science"), "Standard: Contains failing classes (formatted)", results, suiteResult);
  assert(htmlStandard.includes("Spartan Hour Summary"), "Standard: Contains Spartan Hour section", results, suiteResult);
  assert(htmlStandard.includes("Absences by Period"), "Standard: Contains Absences section", results, suiteResult);

  // Test 2: Promise Fellow View (Restricted Data)
  const htmlPromise = createStudentCardHtml(mockStudent, mockSpartanData, mockAbsenceData, true);

  assert(htmlPromise.includes("Test Student"), "Promise Fellow: Contains student name", results, suiteResult);
  assert(!htmlPromise.includes("Failing Classes:"), "Promise Fellow: Hides failing classes", results, suiteResult);
  assert(!htmlPromise.includes("Spartan Hour Summary"), "Promise Fellow: Hides Spartan Hour summary", results, suiteResult);
  assert(htmlPromise.includes("Absences by Period"), "Promise Fellow: Contains Absences section", results, suiteResult);

  // Test 3: Failing Logic Visuals
  // If failing, border should be red (#d9534f)
  assert(htmlStandard.includes("#d9534f"), "Visual: Applies red border for failing student", results, suiteResult);

  // Test 4: Absence Color Logic
  const highAbsenceData = { ...mockAbsenceData, p1: 6 }; // 6 absences -> Red
  const htmlAbsence = createStudentCardHtml(mockStudent, mockSpartanData, highAbsenceData, false);
  assert(htmlAbsence.includes("#f8d7da"), "Visual: Applies red background for high absences", results, suiteResult);
}
