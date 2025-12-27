/**
 * @OnlyCurrentDoc
 */

// ===============================================================
// SCOUT'S RELIABILITY SUITE
// ===============================================================

/**
 * Runs all unit tests and logs the results.
 * Can be run manually from the Apps Script Editor.
 */
function runAllTests() {
  const results = [];

  // Add test functions here
  results.push(test_generateNameKey());

  // Report results
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  Logger.log("========================================");
  Logger.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  Logger.log("========================================");

  results.forEach(r => {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    if (r.passed) {
      Logger.log(`${status}: ${r.name}`);
    } else {
      console.error(`${status}: ${r.name}`);
      console.error(`   Error: ${r.message}`);
    }
  });

  if (failed > 0) {
    throw new Error(`${failed} tests failed. Check logs.`);
  }
}

/**
 * Unit test for generateNameKey() logic.
 * Verifies that name normalization works for various formats.
 */
function test_generateNameKey() {
  const testName = "generateNameKey";
  try {
    const testCases = [
      { input: "Doe, John", expected: "doe|john" },
      { input: "Doe, John Middle", expected: "doe|john" },
      { input: "John Doe", expected: "doe|john" },
      { input: "John Middle Doe", expected: "doe|john" },
      { input: "Cher", expected: "cher" },
      { input: "   John   Doe   ", expected: "doe|john" },
      { input: "", expected: "" },
      { input: null, expected: "" },
      { input: undefined, expected: "" },
      { input: 12345, expected: "12345" },
      { input: "O'Connor, Sinead", expected: "o'connor|sinead" },
      { input: "Van Der Beek, James", expected: "van der beek|james" },
      // Note: "James Van Der Beek" -> "beek|james" is expected behavior for space-delimited inputs
      // where we assume the last word is the last name if no comma is present.
      { input: "James Van Der Beek", expected: "beek|james" }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const result = generateNameKey(tc.input);
      if (result !== tc.expected) {
        throw new Error(`Case ${i} failed. Input: '${tc.input}', Expected: '${tc.expected}', Actual: '${result}'`);
      }
    }

    return { name: testName, passed: true };
  } catch (e) {
    return { name: testName, passed: false, message: e.message };
  }
}
