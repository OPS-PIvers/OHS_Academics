/**
 * @OnlyCurrentDoc
 */

/**
 * Runs a suite of system health checks and returns the results.
 * This is used by the frontend diagnostic tool.
 * @returns {Object} Health check results.
 */
function getSystemHealth() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = {
    sheets: [],
    config: [],
    logic: []
  };

  // 1. Check Critical Sheets
  const requiredSheets = [
    'Admin Settings',
    '⭐Academics & Attendance Hub',
    'Historical Snapshots',
    'Staff Roles',
    'D/F No Request',
    'Spartan Hour Intervention',
    'Absences (total)'
  ];

  requiredSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    results.sheets.push({
      name: sheetName,
      status: sheet ? 'PASS' : 'FAIL',
      message: sheet ? 'Exists' : 'Missing'
    });
  });

  // 2. Check Configuration (SNAPSHOT_METRICS_CONFIG)
  try {
    if (typeof SNAPSHOT_METRICS_CONFIG === 'undefined') {
       results.config.push({ name: 'SNAPSHOT_METRICS_CONFIG', status: 'FAIL', message: 'Undefined' });
    } else if (!Array.isArray(SNAPSHOT_METRICS_CONFIG)) {
       results.config.push({ name: 'SNAPSHOT_METRICS_CONFIG', status: 'FAIL', message: 'Not an array' });
    } else {
       results.config.push({ name: 'SNAPSHOT_METRICS_CONFIG', status: 'PASS', message: `Found ${SNAPSHOT_METRICS_CONFIG.length} metrics` });

       // Check first item structure
       const firstItem = SNAPSHOT_METRICS_CONFIG[0];
       if (firstItem && firstItem.key && firstItem.header) {
         results.config.push({ name: 'Metric Structure', status: 'PASS', message: 'Valid keys found' });
       } else {
         results.config.push({ name: 'Metric Structure', status: 'FAIL', message: 'Invalid keys in first item' });
       }
    }
  } catch (e) {
    results.config.push({ name: 'Config Check', status: 'FAIL', message: e.message });
  }

  // 3. Check Logic (generateNameKey)
  try {
    const testName = "Doe, John";
    const expectedKey = "doe|john";
    const generatedKey = generateNameKey(testName);

    if (generatedKey === expectedKey) {
      results.logic.push({ name: 'generateNameKey Logic', status: 'PASS', message: `Correctly parsed "${testName}"` });
    } else {
      results.logic.push({ name: 'generateNameKey Logic', status: 'FAIL', message: `Expected "${expectedKey}", got "${generatedKey}"` });
    }
  } catch (e) {
    results.logic.push({ name: 'Logic Check', status: 'FAIL', message: e.message });
  }

  return results;
}

/**
 * Server-side unit tests runner.
 * Can be triggered manually from the editor.
 */
function runAllTests() {
  const health = getSystemHealth();
  Logger.log("=== SYSTEM HEALTH REPORT ===");

  [...health.sheets, ...health.config, ...health.logic].forEach(item => {
    if (item.status === 'PASS') {
      Logger.log(`[PASS] ${item.name}: ${item.message}`);
    } else {
      console.error(`[FAIL] ${item.name}: ${item.message}`);
    }
  });

  Logger.log("=== END REPORT ===");
}
