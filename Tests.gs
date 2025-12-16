/**
 * @OnlyCurrentDoc
 */

// ===============================================================
// SCOUT'S TEST SUITE
// ===============================================================

/**
 * Runs all unit tests and returns the results.
 * @returns {Object[]} Test results with pass/fail status and messages.
 */
function runAllTests() {
  const results = [];

  // Test: generateNameKey
  try {
    test_generateNameKey();
    results.push({ name: "generateNameKey Logic", status: "PASSED", message: "All assertions passed." });
  } catch (e) {
    results.push({ name: "generateNameKey Logic", status: "FAILED", message: e.message });
  }

  return results;
}

/**
 * Unit Test for generateNameKey function.
 * Validates name normalization logic.
 */
function test_generateNameKey() {
  const assertions = [
    { input: "Doe, John", expected: "doe|john" },
    { input: "Doe, John Middle", expected: "doe|john" },
    { input: "John Doe", expected: "doe|john" },
    { input: "John Middle Doe", expected: "doe|john" },
    { input: "Madonna", expected: "madonna" }, // Mononym
    { input: "   Smith,  Jane   ", expected: "smith|jane" }, // Extra spaces
    { input: null, expected: "" },
    { input: undefined, expected: "" }
  ];

  assertions.forEach(a => {
    const result = generateNameKey(a.input);
    if (result !== a.expected) {
      throw new Error(`Expected generateNameKey('${a.input}') to be '${a.expected}', but got '${result}'`);
    }
  });
}

/**
 * System Health Check.
 * Verifies critical sheets and configuration.
 * @returns {Object[]} Array of health check results.
 */
function getSystemHealth() {
  const checks = [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Check Critical Sheets
  const requiredSheets = [
    "⭐Academics & Attendance Hub",
    "Admin Settings",
    "Staff Roles",
    "Spartan Hour Intervention",
    "Absences (total)",
    "D/F No Request"
  ];

  requiredSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      checks.push({ name: `Sheet Exists: ${sheetName}`, status: "PASSED", message: "Found" });
    } else {
      checks.push({ name: `Sheet Exists: ${sheetName}`, status: "FAILED", message: "Missing" });
    }
  });

  // 2. Check Admin Settings Data
  const adminSheet = ss.getSheetByName("Admin Settings");
  if (adminSheet && adminSheet.getLastRow() > 1) {
     checks.push({ name: "Admin Settings Data", status: "PASSED", message: `Found ${adminSheet.getLastRow() - 1} rows` });
  } else {
     checks.push({ name: "Admin Settings Data", status: "FAILED", message: "Sheet is empty or missing" });
  }

  // 3. Check Hub Data
  const hubSheet = ss.getSheetByName("⭐Academics & Attendance Hub");
  if (hubSheet && hubSheet.getLastRow() > 1) {
    checks.push({ name: "Student Data Hub", status: "PASSED", message: `Found ${hubSheet.getLastRow() - 1} rows` });
  } else {
    checks.push({ name: "Student Data Hub", status: "FAILED", message: "Sheet is empty or missing" });
  }

  return checks;
}

/**
 * Serves the Test Dashboard.
 */
function doTest() {
   const user = getUserRole();

   if (!user) {
     Logger.log("doTest access denied: No user info found.");
     return HtmlService.createHtmlOutput("Access Denied: Unable to verify user identity.");
   }

   if (user.role !== 'ADMIN') {
     Logger.log(`doTest access denied: User ${user.email} has role '${user.role}', expected 'ADMIN'.`);
     return HtmlService.createHtmlOutput("Access Denied: Admin role required.");
   }

   return HtmlService.createTemplateFromFile('tests').evaluate()
      .setTitle("System Health & Tests")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
