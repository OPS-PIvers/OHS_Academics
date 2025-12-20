/**
 * Tests.gs
 * Isolated logic for system health checks and unit tests.
 * Accessed via ?page=tests (Admins Only)
 */

/**
 * Runs a suite of system health checks and unit tests.
 * @returns {Object} Status object with list of checks and overall pass/fail boolean.
 */
function getSystemHealth() {
  const status = {
    checks: [],
    overall: true
  };

  function addResult(name, passed, message) {
    status.checks.push({
      name: name,
      passed: passed,
      message: message
    });
    if (!passed) status.overall = false;
  }

  try {
    // In a real environment, we'd use Dependency Injection, but for this health check
    // we rely on the bound container's SpreadsheetApp.
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Critical Sheets Existence
    const requiredSheets = [
      "Admin Settings",
      "⭐Academics & Attendance Hub",
      "Historical Snapshots",
      "Spartan Hour Intervention",
      "Absences (total)"
    ];

    requiredSheets.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      addResult(
        `Sheet Existence: ${sheetName}`,
        !!sheet,
        sheet ? "Found" : "Missing - Critical for data integrity"
      );
    });

    // 2. Unit Test: generateNameKey (Business Logic)
    try {
      test_generateNameKey(addResult);
    } catch (e) {
      addResult("Unit Test: generateNameKey", false, "Exception: " + e.message);
    }

    // 3. Admin Settings Data Integrity
    const adminSheet = ss.getSheetByName("Admin Settings");
    if (adminSheet) {
      const lastRow = adminSheet.getLastRow();
      addResult("Admin Settings Data", lastRow >= 2, `Found ${lastRow > 1 ? lastRow - 1 : 0} rows of data (Requires >= 1)`);

      if (lastRow >= 2) {
         // Check for duplicate Admin emails (common issue)
         const emails = adminSheet.getRange("B2:B" + lastRow).getValues().flat().filter(String);
         const uniqueEmails = new Set(emails.map(e => e.toLowerCase().trim()));
         addResult("Admin Email Integrity", emails.length === uniqueEmails.size,
           emails.length === uniqueEmails.size ? "No duplicates found" : `Found ${emails.length - uniqueEmails.size} duplicate emails`);
      }
    }

  } catch (e) {
    addResult("Critical System Error", false, e.message);
  }

  return status;
}

/**
 * Unit test for the generateNameKey function.
 * @param {Function} addResult - Callback to record test result.
 */
function test_generateNameKey(addResult) {
  const cases = [
    { input: "Doe, John", expected: "doe|john" },
    { input: "John Doe", expected: "doe|john" },
    { input: "Doe, John Middle", expected: "doe|john" }, // Ignores middle name if comma format
    { input: "John Middle Doe", expected: "doe|john" }, // Ignores middle name if space format
    { input: "  Doe,   John  ", expected: "doe|john" }, // Trimming
    { input: "Cher", expected: "cher" }, // Mononym
    { input: null, expected: "" },
    { input: undefined, expected: "" },
    { input: "", expected: "" }
  ];

  let failedCases = [];

  cases.forEach(c => {
    // Note: generateNameKey is in Code.js and is available in the global scope
    const result = generateNameKey(c.input);
    if (result !== c.expected) {
      failedCases.push(`"${c.input}" -> "${result}" (Expected "${c.expected}")`);
    }
  });

  if (failedCases.length === 0) {
    addResult("Unit Test: generateNameKey", true, "All 9 test cases passed (Normalizers, Mononyms, Nulls)");
  } else {
    addResult("Unit Test: generateNameKey", false, `Failed cases: ${failedCases.join('; ')}`);
  }
}
