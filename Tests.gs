/**
 * @OnlyCurrentDoc
 */

/**
 * Runs a suite of system health checks and returns the results.
 * @returns {Object} Health status object.
 */
function getSystemHealth() {
  const results = {
    overall: 'PASS',
    checks: []
  };

  const addCheck = (name, status, message = '') => {
    results.checks.push({ name, status, message });
    if (status === 'FAIL') results.overall = 'FAIL';
  };

  // 1. Check User Role (Must be ADMIN to run this, effectively)
  try {
    const userRole = getUserRole(); // Dependent on Code.js
    addCheck('User Role Access', userRole && userRole.role === 'ADMIN' ? 'PASS' : 'FAIL', `Role: ${userRole ? userRole.role : 'None'}`);
  } catch (e) {
    addCheck('User Role Access', 'FAIL', e.message);
  }

  // 2. Check Critical Sheets Existence
  const requiredSheets = [
    'Admin Settings',
    '⭐Academics & Attendance Hub',
    'Historical Snapshots',
    'Staff Roles',
    'D/F No Request',
    'Spartan Hour Intervention',
    'Absences (total)'
  ];

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    requiredSheets.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      addCheck(`Sheet Exists: ${sheetName}`, sheet ? 'PASS' : 'FAIL', sheet ? 'Found' : 'Missing');
    });
  } catch (e) {
    addCheck('Spreadsheet Access', 'FAIL', e.message);
  }

  // 3. Unit Test: generateNameKey
  try {
    test_generateNameKey();
    addCheck('Unit Test: generateNameKey', 'PASS', 'Logic verified');
  } catch (e) {
    addCheck('Unit Test: generateNameKey', 'FAIL', e.message);
  }

  // 4. Configuration Check
  try {
    if (typeof SNAPSHOT_METRICS_CONFIG !== 'undefined' && Array.isArray(SNAPSHOT_METRICS_CONFIG)) {
       addCheck('Config: SNAPSHOT_METRICS_CONFIG', 'PASS', `Found ${SNAPSHOT_METRICS_CONFIG.length} metrics`);
    } else {
       addCheck('Config: SNAPSHOT_METRICS_CONFIG', 'FAIL', 'Missing or invalid');
    }
  } catch (e) {
    addCheck('Config Check', 'FAIL', e.message);
  }

  return results;
}

/**
 * Unit test for generateNameKey (located in Code.js).
 * Throws Error if test fails.
 */
function test_generateNameKey() {
  // Ensure generateNameKey is available
  if (typeof generateNameKey !== 'function') {
    throw new Error('generateNameKey function not found in context.');
  }

  const cases = [
    { input: "Smith, John", expected: "smith|john" },
    { input: "Doe, Jane Marie", expected: "doe|jane" },
    { input: "John Smith", expected: "smith|john" },
    { input: "Jane Marie Doe", expected: "doe|jane" }, // First Middle Last -> Last|First
    { input: "   Bond,   James   ", expected: "bond|james" },
    { input: "Prince", expected: "prince" }, // Mononym
    { input: "", expected: "" },
    { input: null, expected: "" }
  ];

  cases.forEach(c => {
    const result = generateNameKey(c.input);
    if (result !== c.expected) {
      throw new Error(`Expected '${c.expected}' for input '${c.input}', got '${result}'`);
    }
  });
}
