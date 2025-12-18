const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- MOCKS ---

const Logger = {
  log: (msg) => console.log("[Logger] " + msg)
};

const HtmlService = {
    createHtmlOutput: (html) => ({
        setTitle: (t) => ({
            setXFrameOptionsMode: (m) => ({ html: html, title: t, xframe: m })
        })
    }),
    createTemplateFromFile: () => ({
        evaluate: () => ({ setTitle: () => ({ setXFrameOptionsMode: () => {} }) })
    }),
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
};

const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: () => null // Mocking return null for simplicity as we test logic not data fetching here
    })
};
const Session = {
    getActiveUser: () => ({ getEmail: () => "test@example.com" })
};

// --- LOAD FILES ---
const codePath = path.join(__dirname, '..', 'Code.js');
const testsPath = path.join(__dirname, '..', 'Tests.gs');

const codeContent = fs.readFileSync(codePath, 'utf8');
const testsContent = fs.readFileSync(testsPath, 'utf8');

const sandbox = {
    SpreadsheetApp,
    Logger,
    HtmlService,
    Session,
    console
};

vm.createContext(sandbox);

// Load Code.js first
try {
    vm.runInContext(codeContent, sandbox);
} catch (e) {
    console.error("Error loading Code.js:", e);
    process.exit(1);
}

// Load Tests.gs
try {
    vm.runInContext(testsContent, sandbox);
} catch (e) {
    console.error("Error loading Tests.gs:", e);
    process.exit(1);
}

// --- RUN TESTS ---

console.log("Running local verification...");

try {
    // 1. Run Unit Tests
    const results = sandbox.runAllTests();
    console.log("Results:", results);

    const allPassed = results.every(r => r.passed);
    if (!allPassed) {
        console.log("Some unit tests FAILED.");
        process.exit(1);
    }

    // 2. Test doGet Integration
    console.log("Testing doGet integration...");

    // Mock getUserRole to return ADMIN
    // Since getUserRole is defined in Code.js, we can override it in the sandbox
    sandbox.getUserRole = () => ({ role: 'ADMIN', name: 'Admin', email: 'admin@test.com' });

    const e = { parameter: { page: 'tests' } };
    const output = sandbox.doGet(e);

    // Verify output
    // The output is an object returned by our mock HtmlService.createHtmlOutput
    // It has structure: { html: ..., title: '...', xframe: ... }

    if (output && output.title === "Scout's Test Report") {
        console.log("PASS: doGet with ?page=tests returned Test Report.");
    } else {
        console.log("FAIL: doGet with ?page=tests did NOT return Test Report.");
        console.log("Output Title:", output ? output.title : "undefined");
        process.exit(1);
    }

    console.log("All verification checks PASSED.");

} catch (e) {
    console.error("Error running tests:", e);
    process.exit(1);
}
