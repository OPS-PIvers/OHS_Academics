/**
 * Scout's Test Suite
 * Run these tests to verify system health and logic integrity.
 */

function runAllTests() {
  const results = [];

  // Unit Tests
  results.push(test_generateNameKey());

  // System Health Checks
  results.push(getSystemHealth());

  return results;
}

function test_generateNameKey() {
  const testCases = [
    { input: "Doe, John", expected: "doe|john" },
    { input: "John Doe", expected: "doe|john" },
    { input: "Doe, John Middle", expected: "doe|john" },
    { input: "John Middle Doe", expected: "doe|john" },
    { input: "   John    Doe   ", expected: "doe|john" }, // Trimming
    { input: "Prince", expected: "prince" }, // Mononym
    { input: null, expected: "" }
  ];

  let passed = true;
  let message = "All name generation cases passed.";

  for (const tc of testCases) {
    const actual = generateNameKey(tc.input);
    if (actual !== tc.expected) {
      passed = false;
      message = `Failed on input '${tc.input}': expected '${tc.expected}', got '${actual}'`;
      console.error(message);
      break;
    }
  }

  if (passed) {
    Logger.log("✅ Unit Test: generateNameKey PASSED");
  }

  return { name: "Unit Test: generateNameKey", passed: passed, message: message };
}

function getSystemHealth() {
  let passed = true;
  let messages = [];

  try {
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

    for (const sheetName of requiredSheets) {
      if (!ss.getSheetByName(sheetName)) {
        passed = false;
        messages.push(`Missing sheet: ${sheetName}`);
      }
    }
  } catch (e) {
    passed = false;
    messages.push(`Error accessing spreadsheet: ${e.message}`);
  }

  if (passed) {
    Logger.log("✅ System Health: All required sheets exist.");
  } else {
    console.error("❌ System Health Failed: " + messages.join("; "));
  }

  return {
    name: "System Health: Sheet Existence",
    passed: passed,
    message: passed ? "All required sheets exist." : messages.join("; ")
  };
}
