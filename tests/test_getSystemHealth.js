const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- MOCKS ---

class Sheet {
  constructor(name) {
    this.name = name;
  }
  getLastRow() { return 2; }
  getRange() { return { getValues: () => [] }; } // Mock empty range for now
}

class Spreadsheet {
  constructor() {
    this.sheets = new Map();
  }
  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }
  addSheet(name) {
    this.sheets.set(name, new Sheet(name));
  }
}

const activeSpreadsheet = new Spreadsheet();

// Mock Sheets
activeSpreadsheet.addSheet("⭐Academics & Attendance Hub");
activeSpreadsheet.addSheet("Admin Settings");
activeSpreadsheet.addSheet("Historical Snapshots");
activeSpreadsheet.addSheet("Spartan Hour Intervention");
activeSpreadsheet.addSheet("Absences (total)");
activeSpreadsheet.addSheet("Staff Roles"); // Needed for getUserRole

const SpreadsheetApp = {
  getActiveSpreadsheet: () => activeSpreadsheet
};

const Session = {
    getActiveUser: () => ({ getEmail: () => "admin@example.com" }),
    getScriptTimeZone: () => "GMT"
};

const Logger = {
  log: (msg) => console.log("[Logger] " + msg)
};

const ScriptApp = {
    getService: () => ({ getUrl: () => "http://mock-url" })
};

const HtmlService = {
    createTemplateFromFile: () => ({ evaluate: () => ({ setTitle: () => ({ setXFrameOptionsMode: () => {} }) }) }),
    createHtmlOutput: () => ({}),
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
};

// --- LOAD FILES ---
const codePath = path.join(__dirname, '..', 'Code.js');
const testsPath = path.join(__dirname, '..', 'Tests.gs');

const codeContent = fs.readFileSync(codePath, 'utf8');
const testsContent = fs.readFileSync(testsPath, 'utf8');

const sandbox = {
    SpreadsheetApp,
    Session,
    Logger,
    ScriptApp,
    HtmlService,
    console
};

vm.createContext(sandbox);
vm.runInContext(codeContent, sandbox);
vm.runInContext(testsContent, sandbox);

// --- TEST EXECUTION ---

console.log("Running System Health Diagnostic Test...");

// Mock getUserRole return by intercepting/mocking the sheets data it relies on.
// Instead of complex sheet mocking for getUserRole, let's just override the global getUserRole function in sandbox if possible?
// No, getUserRole is defined in Code.js.
// We can overwrite it in the sandbox AFTER Code.js is loaded.
sandbox.getUserRole = () => ({ role: 'ADMIN', email: 'admin@example.com' });

try {
    const results = sandbox.getSystemHealth();
    console.log("Health Check Results:", JSON.stringify(results, null, 2));

    // Validate Results
    const allPassed = results.every(r => r.passed);
    if (allPassed) {
        console.log("PASS: All checks passed as expected.");
    } else {
        console.log("FAIL: Some checks failed.");
        process.exit(1);
    }

    // Verify specific checks present
    const hasNameKeyTest = results.some(r => r.test === "Unit Test: generateNameKey");
    if (!hasNameKeyTest) {
         console.log("FAIL: Missing Unit Test: generateNameKey check.");
         process.exit(1);
    }

} catch (e) {
    console.error("FAIL: Error running getSystemHealth:", e);
    process.exit(1);
}
