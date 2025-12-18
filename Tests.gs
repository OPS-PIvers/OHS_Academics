/**
 * Scout's Test Suite
 * ensure reliability, testability, and bug-free code.
 */

function runAllTests() {
  const results = [];

  // Test 1: Name Key Generation
  try {
    results.push(test_generateNameKey());
  } catch (e) {
    results.push({ name: 'test_generateNameKey', passed: false, error: e.message });
  }

  // Add more tests here

  return results;
}

/**
 * Unit Test for generateNameKey function.
 * Verifies that names are normalized correctly regardless of format.
 */
function test_generateNameKey() {
  const testCases = [
    { input: 'Doe, John', expected: 'doe|john' },
    { input: 'Doe, John A.', expected: 'doe|john' },
    { input: 'John Doe', expected: 'doe|john' },
    { input: 'John A. Doe', expected: 'doe|john' },
    { input: 'Cher', expected: 'cher' }, // Mononym
    { input: '  Doe,   John  ', expected: 'doe|john' }, // Trimming
    { input: 'Smith-Jones, Mary', expected: 'smith-jones|mary' }, // Hyphenated last name
    { input: 'Mary Smith-Jones', expected: 'smith-jones|mary' },
    { input: null, expected: '' },
    { input: undefined, expected: '' }
  ];

  let passed = true;
  let errorMsg = '';

  testCases.forEach(tc => {
    try {
      const result = generateNameKey(tc.input);
      if (result !== tc.expected) {
        passed = false;
        errorMsg += `Expected '${tc.expected}' for input '${tc.input}', but got '${result}'.\n`;
      }
    } catch (e) {
      passed = false;
      errorMsg += `Error processing input '${tc.input}': ${e.message}\n`;
    }
  });

  if (!passed) {
    throw new Error(errorMsg);
  }

  return { name: 'test_generateNameKey', passed: true };
}

/**
 * Entry point for running tests and viewing the report.
 * Can be run from the Script Editor or via web app URL ?page=tests
 */
function doTest() {
  const results = runAllTests();
  return generateTestReport(results);
}

/**
 * Generates an OPS Tech branded HTML report.
 */
function generateTestReport(results) {
  const style = `
    <style>
      body { font-family: 'Lexend', sans-serif; padding: 20px; color: #333; }
      .test-card { border: 1px solid #e5e7eb; padding: 15px; margin-bottom: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
      .passed { border-left: 5px solid #2d3f89; background-color: #f0f4ff; }
      .failed { border-left: 5px solid #ad2122; background-color: #fce8e8; }
      .status { font-weight: bold; }
      .status-pass { color: #2d3f89; }
      .status-fail { color: #ad2122; }
      h1 { color: #2d3f89; margin-bottom: 20px; }
      .error-msg { width: 100%; margin-top: 10px; color: #ad2122; white-space: pre-wrap; font-size: 0.9em; }
      .card-content { display: flex; flex-direction: column; width: 100%; }
      .card-header { display: flex; justify-content: space-between; width: 100%; }
    </style>
  `;

  let html = `<!DOCTYPE html><html><head><link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;700&display=swap" rel="stylesheet">${style}</head><body>`;
  html += `<h1>🔭 Scout's Reliability Report</h1>`;

  results.forEach(r => {
    const statusClass = r.passed ? 'passed' : 'failed';
    const statusText = r.passed ? 'PASSED' : 'FAILED';
    const statusColor = r.passed ? 'status-pass' : 'status-fail';

    html += `
      <div class="test-card ${statusClass}">
        <div class="card-content">
          <div class="card-header">
            <span style="font-weight: bold;">${r.name}</span>
            <span class="status ${statusColor}">${statusText}</span>
          </div>
          ${r.error ? `<div class="error-msg">${r.error}</div>` : ''}
        </div>
      </div>
    `;
  });

  html += `</body></html>`;

  // Log to console as well
  Logger.log('Test Results:');
  results.forEach(r => Logger.log(`${r.name}: ${r.passed ? 'PASS' : 'FAIL'} ${r.error || ''}`));

  return HtmlService.createHtmlOutput(html)
    .setTitle("Scout's Test Report")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
