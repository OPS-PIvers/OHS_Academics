const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- MOCKS ---
const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: () => ({ getLastRow: () => 10 })
    })
};

const Logger = {
    log: (msg) => console.log("[GAS Log] " + msg)
};

// --- LOAD CODE ---
// Load Code.js and Tests.gs
const codePath = path.join(__dirname, '..', 'Code.js');
const testsPath = path.join(__dirname, '..', 'Tests.gs');

const codeContent = fs.readFileSync(codePath, 'utf8');
const testsContent = fs.readFileSync(testsPath, 'utf8');

// Combine them into one context
const combinedCode = codeContent + "\n" + testsContent;

const sandbox = {
    SpreadsheetApp,
    Logger,
    console,
    SNAPSHOT_METRICS_CONFIG: [] // Mock constant if needed
};

vm.createContext(sandbox);
vm.runInContext(combinedCode, sandbox);

// --- RUN TEST ---
console.log("Running test_generateNameKey locally...");
const results = sandbox.test_generateNameKey();

console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

if (results.failures.length > 0) {
    console.log("Failures:");
    results.failures.forEach(f => console.log(` - ${f}`));
    process.exit(1);
} else {
    console.log("All tests passed!");
}
