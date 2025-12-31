/**
 * @fileoverview System Health Diagnostic Tool
 * This file contains server-side logic for the System Health Check.
 * It validates sheet existence, data integrity, and configuration.
 */

/**
 * Runs a comprehensive system health check.
 * @returns {Object} Report containing the status of various system components.
 */
function getSystemHealth() {
  const report = {
    timestamp: new Date().toISOString(),
    sheets: [],
    dataValidation: [],
    configuration: [],
    overallStatus: 'PASS'
  };

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sheet Existence Check
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
    const exists = !!sheet;
    report.sheets.push({
      name: sheetName,
      status: exists ? 'PASS' : 'FAIL',
      message: exists ? 'Sheet exists' : 'Sheet missing'
    });
    if (!exists) report.overallStatus = 'FAIL';
  });

  // 2. Data Validation Check
  try {
    const hubSheet = ss.getSheetByName('⭐Academics & Attendance Hub');
    if (hubSheet) {
      const lastRow = hubSheet.getLastRow();
      const studentCount = lastRow > 1 ? lastRow - 1 : 0;

      report.dataValidation.push({
        name: 'Student Data',
        status: studentCount > 0 ? 'PASS' : 'WARN',
        message: `${studentCount} students found`
      });

      if (studentCount > 0) {
        // Check for duplicate IDs (Column D, Index 4)
         // Note: Code.js uses index 3 for ID in getValues mapping, but usually it's column D.
         // Let's rely on data fetch.
         const ids = hubSheet.getRange(2, 4, lastRow - 1, 1).getValues().flat();
         const uniqueIds = new Set(ids.filter(String));
         const duplicates = ids.length - uniqueIds.size;

         report.dataValidation.push({
            name: 'Duplicate IDs',
            status: duplicates === 0 ? 'PASS' : 'WARN',
            message: `${duplicates} duplicate IDs found`
         });
      }

    } else {
        report.dataValidation.push({
            name: 'Student Data',
            status: 'FAIL',
            message: 'Hub sheet missing'
        });
        report.overallStatus = 'FAIL';
    }
  } catch (e) {
    report.dataValidation.push({
      name: 'Data Access',
      status: 'FAIL',
      message: `Error accessing data: ${e.message}`
    });
    report.overallStatus = 'FAIL';
  }

  // 3. Configuration Check
  try {
     const adminSheet = ss.getSheetByName('Admin Settings');
     if (adminSheet) {
         const lastRow = adminSheet.getLastRow();
         // Check if admins are configured (Col A)
         const adminCount = lastRow > 1 ? adminSheet.getRange(2, 1, lastRow-1, 1).getValues().filter(String).length : 0;
         report.configuration.push({
             name: 'Admin Configuration',
             status: adminCount > 0 ? 'PASS' : 'FAIL',
             message: `${adminCount} admins configured`
         });
         if (adminCount === 0) report.overallStatus = 'FAIL';
     } else {
         report.configuration.push({
             name: 'Admin Settings',
             status: 'FAIL',
             message: 'Sheet missing'
         });
         report.overallStatus = 'FAIL';
     }
  } catch (e) {
      report.configuration.push({
          name: 'Configuration Access',
          status: 'FAIL',
          message: `Error accessing config: ${e.message}`
      });
      report.overallStatus = 'FAIL';
  }

  return report;
}

/**
 * Simple test case for name normalization.
 * @returns {boolean} True if test passes.
 */
function test_generateNameKey() {
    const cases = [
        { input: "Smith, John", expected: "smith|john" },
        { input: "Doe, Jane Marie", expected: "doe|jane" },
        { input: "John Smith", expected: "smith|john" },
        { input: "Jane Marie Doe", expected: "doe|jane" }, // Assuming last word is last name
        { input: "  Spaces  ,  Lots  ", expected: "spaces|lots" }
    ];

    // We need to access generateNameKey from Code.js.
    // Since this runs in the same project, it should be available.

    const results = cases.map(c => {
        const actual = generateNameKey(c.input);
        return {
            input: c.input,
            expected: c.expected,
            actual: actual,
            passed: actual === c.expected
        };
    });

    const failed = results.filter(r => !r.passed);
    if (failed.length > 0) {
        console.error("test_generateNameKey FAILED", failed);
        return false;
    }
    Logger.log("test_generateNameKey PASSED");
    return true;
}

/**
 * Runs all server-side tests/checks.
 * @returns {Object} Test results.
 */
function runAllTests() {
    const results = [];
    try {
        const nameKeyResult = test_generateNameKey();
        results.push({ name: 'test_generateNameKey', passed: nameKeyResult, message: nameKeyResult ? 'Passed' : 'Failed' });
    } catch (e) {
        results.push({ name: 'test_generateNameKey', passed: false, message: e.message });
    }

    // Add more tests here

    return results;
}
