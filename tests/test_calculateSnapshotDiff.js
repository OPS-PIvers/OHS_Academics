const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- MOCKS ---

const SpreadsheetApp = {
  getActiveSpreadsheet: () => ({}),
  WeekDay: { MONDAY: 1 }
};

const ScriptApp = {
    getProjectTriggers: () => [],
    newTrigger: () => ({ timeBased: () => ({ onWeekDay: () => ({ atHour: () => ({ create: () => {} }) }) }) })
};

const Logger = {
  log: (msg) => console.log("[Logger] " + msg)
};

const Session = {
    getScriptTimeZone: () => "GMT",
    getActiveUser: () => ({ getEmail: () => "test@example.com" })
};

const Utilities = {
    formatDate: (date) => new Date(date).toISOString().split('T')[0]
};

const MailApp = {
    sendEmail: () => {}
};

const HtmlService = {
    createTemplateFromFile: () => ({}),
    createHtmlOutput: () => ({ setTitle: () => ({ setXFrameOptionsMode: () => {} }) }),
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
};

// --- LOAD CODE.JS ---
const codePath = path.join(__dirname, '..', 'Code.js');
const code = fs.readFileSync(codePath, 'utf8');

const sandbox = {
    SpreadsheetApp,
    ScriptApp,
    Logger,
    Session,
    Utilities,
    MailApp,
    HtmlService,
    console
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// --- EXPOSE SANDBOX VARIABLES ---
// Since vm.runInContext doesn't automatically expose 'const' variables to the sandbox object property
// we need to access them differently or modify the source for testing.
// HOWEVER, for top-level functions like calculateSnapshotDiff, they SHOULD be attached if declared as function statements.
// 'const' variables are block-scoped to the script.
// To fix this for the test, we will assume SNAPSHOT_METRICS_CONFIG is available if we execute code inside the context.

// --- TEST CASES ---

function runTests() {
    console.log("Running calculateSnapshotDiff Tests...");
    let failed = false;

    // We run the test logic INSIDE the sandbox to access the const variables
    const testScript = `
        (function() {
            let failed = false;
            try {
                if (typeof SNAPSHOT_METRICS_CONFIG === 'undefined') {
                    console.log("SNAPSHOT_METRICS_CONFIG is undefined inside sandbox.");
                    return { failed: true };
                }

                const config = SNAPSHOT_METRICS_CONFIG;

                // Test Data
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

                // Test 1: Basic Comparison
                console.log("\\n--- Test Case 1: Basic Comparison ---");
                const result1 = calculateSnapshotDiff(s1, s2, config);

                const studentsChange = result1.changes.find(c => c.metric === 'Total Students');
                if (studentsChange && studentsChange.delta == 5) {
                    console.log("PASS: Total Students delta is correct.");
                } else {
                    console.log("FAIL: Total Students delta incorrect. Got:", studentsChange);
                    failed = true;
                }

                const fGradesChange = result1.changes.find(c => c.metric === 'Total F Grades');
                if (!fGradesChange) {
                    console.log("PASS: Unchanged metric filtered out.");
                } else {
                    console.log("FAIL: Unchanged metric included:", fGradesChange);
                    failed = true;
                }

                // Test 2: Edge Case - Zero to Non-Zero
                console.log("\\n--- Test Case 2: Zero to Non-Zero ---");
                const sZero = { ...s1, studentsWithFGrades: 0 };
                const sNonZero = { ...s2, studentsWithFGrades: 5 };

                const result2 = calculateSnapshotDiff(sZero, sNonZero, config);
                const fGradesChange2 = result2.changes.find(c => c.metric === 'Students with F Grades');

                if (fGradesChange2 && fGradesChange2.percentChange === 'N/A (from zero)') {
                    console.log("PASS: Percent change from zero handled correctly.");
                } else {
                    console.log("FAIL: Percent change from zero incorrect:", fGradesChange2);
                    failed = true;
                }
            } catch (e) {
                console.log("ERROR in test execution: " + e.message);
                failed = true;
            }
            return { failed: failed };
        })()
    `;

    const result = vm.runInContext(testScript, sandbox);

    if (result && result.failed) {
        console.log("\nTests FAILED.");
        process.exit(1);
    } else {
        console.log("\nAll Tests PASSED.");
    }
}

runTests();
