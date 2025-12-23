/**
 * @OnlyCurrentDoc
 */

/**
 * Runs all server-side tests and health checks.
 * @returns {Object[]} Array of test result objects { name, status: 'PASS'|'FAIL', message }.
 */
function runAllTests() {
  const results = [];

  // 1. System Health (Environment Check)
  results.push(getSystemHealth());

  // 2. Unit Tests
  try {
    test_generateNameKey();
    results.push({ name: 'Unit Test: generateNameKey', status: 'PASS', message: 'All assertions passed' });
  } catch (e) {
    results.push({ name: 'Unit Test: generateNameKey', status: 'FAIL', message: e.message });
  }

  try {
    test_SNAPSHOT_METRICS_CONFIG();
    results.push({ name: 'Configuration: SNAPSHOT_METRICS_CONFIG', status: 'PASS', message: 'Configuration valid' });
  } catch (e) {
    results.push({ name: 'Configuration: SNAPSHOT_METRICS_CONFIG', status: 'FAIL', message: e.message });
  }

  return results;
}

/**
 * Checks the health of the system by verifying required sheets and basic data access.
 * @returns {Object} Test result object.
 */
function getSystemHealth() {
  const requiredSheets = [
    'Admin Settings',
    '⭐Academics & Attendance Hub',
    'Historical Snapshots',
    'Staff Roles',
    'D/F No Request',
    'Spartan Hour Intervention',
    'Absences (total)'
  ];

  const missingSheets = [];
  let ss;

  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
     return { name: 'System Health Check', status: 'FAIL', message: 'Could not access Active Spreadsheet. ' + e.message };
  }

  requiredSheets.forEach(sheetName => {
    if (!ss.getSheetByName(sheetName)) {
      missingSheets.push(sheetName);
    }
  });

  if (missingSheets.length > 0) {
    return {
      name: 'System Health Check',
      status: 'FAIL',
      message: `Missing required sheets: ${missingSheets.join(', ')}`
    };
  }

  // Check if Admin Settings has data
  const adminSheet = ss.getSheetByName('Admin Settings');
  if (adminSheet.getLastRow() < 2) {
     return { name: 'System Health Check', status: 'FAIL', message: 'Admin Settings sheet appears empty.' };
  }

  return { name: 'System Health Check', status: 'PASS', message: 'All required sheets present and accessible.' };
}

/**
 * Unit test for generateNameKey function in Code.js.
 * Throws error if assertion fails.
 */
function test_generateNameKey() {
  const assertions = [
    { input: 'Doe, John', expected: 'doe|john' },
    { input: 'Doe, John Middle', expected: 'doe|john' }, // Ignores middle name in First part
    { input: 'John Doe', expected: 'doe|john' },
    { input: 'John Middle Doe', expected: 'doe|john' },
    { input: 'Cher', expected: 'cher' }, // Mononym
    { input: '  Doe,   John  ', expected: 'doe|john' }, // Trimming
    { input: null, expected: '' },
    { input: undefined, expected: '' }
  ];

  assertions.forEach(a => {
    const result = generateNameKey(a.input);
    if (result !== a.expected) {
      throw new Error(`generateNameKey('${a.input}') failed. Expected '${a.expected}', got '${result}'`);
    }
  });
}

/**
 * Validates the SNAPSHOT_METRICS_CONFIG constant.
 */
function test_SNAPSHOT_METRICS_CONFIG() {
  if (typeof SNAPSHOT_METRICS_CONFIG === 'undefined' || !Array.isArray(SNAPSHOT_METRICS_CONFIG)) {
    throw new Error('SNAPSHOT_METRICS_CONFIG is not defined or not an array');
  }

  SNAPSHOT_METRICS_CONFIG.forEach((config, index) => {
    if (!config.key) throw new Error(`Metric at index ${index} missing 'key'`);
    if (!config.header) throw new Error(`Metric at index ${index} missing 'header'`);
    if (typeof config.index !== 'number') throw new Error(`Metric at index ${index} missing 'index'`);
  });
}
