/**
 * @OnlyCurrentDoc
 */

/**
 * Runs server-side unit tests.
 * This function serves as the entry point for testing within the GAS environment.
 * It mimics the local test_calculateSnapshotDiff.js logic but runs on the actual server.
 */
function runServerSideTests() {
  const output = [];

  try {
    output.push(test_calculateSnapshotDiff());
  } catch (e) {
    output.push({
      name: 'Test Runner',
      status: 'FAILED',
      message: e.toString()
    });
  }

  return output;
}

/**
 * Unit test for calculateSnapshotDiff.
 */
function test_calculateSnapshotDiff() {
  const result = {
    name: 'calculateSnapshotDiff',
    status: 'PASSED',
    message: ''
  };

  try {
    // 1. Setup Test Data
    const config = SNAPSHOT_METRICS_CONFIG;
    if (!config) throw new Error("SNAPSHOT_METRICS_CONFIG is missing");

    const s1 = {
      snapshotDate: new Date('2023-01-01'),
      totalStudents: 100,
      ineligibilityRate: 10.0,
      totalFGrades: 5,
      studentsWithFGrades: 20
    };
    const s2 = {
      snapshotDate: new Date('2023-01-08'),
      totalStudents: 105, // +5
      ineligibilityRate: 12.0, // +2.0
      totalFGrades: 5, // No change
      studentsWithFGrades: 25 // +5
    };

    // 2. Execute Function
    const diff = calculateSnapshotDiff(s1, s2, config);

    // 3. Assertions
    // Check Total Students Delta
    const studentChange = diff.changes.find(c => c.metric === 'Total Students');
    if (!studentChange || studentChange.delta != 5) {
      throw new Error(`Total Students delta incorrect. Expected 5, got ${studentChange ? studentChange.delta : 'undefined'}`);
    }

    // Check No Change Filter (Total F Grades should be filtered out from 'changes' but present in 'allMetrics')
    const fGradeChange = diff.changes.find(c => c.metric === 'Total F Grades');
    if (fGradeChange) {
      throw new Error("Total F Grades should be filtered out from changes (delta 0).");
    }

    // Check Zero to Non-Zero Edge Case
    const sZero = { ...s1, studentsWithFGrades: 0 };
    const sNonZero = { ...s2, studentsWithFGrades: 5 };
    const diffZero = calculateSnapshotDiff(sZero, sNonZero, config);
    const zeroChange = diffZero.changes.find(c => c.metric === 'Students with F Grades');

    if (!zeroChange || zeroChange.percentChange !== 'N/A (from zero)') {
      throw new Error(`Percent change from zero incorrect. Expected 'N/A (from zero)', got '${zeroChange ? zeroChange.percentChange : 'undefined'}'`);
    }

    result.message = "All assertions passed.";

  } catch (e) {
    result.status = 'FAILED';
    result.message = e.message;
    console.error(e);
  }

  return result;
}

/**
 * Gets system health status for the admin dashboard.
 * Now includes unit test results.
 */
function getSystemHealth() {
  const testResults = runServerSideTests();

  // Basic health checks (e.g., check if sheets exist)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ['Admin Settings', '⭐Academics & Attendance Hub', 'Historical Snapshots'];
  const sheetChecks = sheets.map(name => {
    return {
      name: `Sheet: ${name}`,
      status: ss.getSheetByName(name) ? 'PASSED' : 'FAILED',
      message: ss.getSheetByName(name) ? 'Exists' : 'Missing'
    };
  });

  return [...sheetChecks, ...testResults];
}
