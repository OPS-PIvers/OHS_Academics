const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- MOCKS ---

class Range {
  constructor(values) {
    this.values = values;
  }
  getValues() {
    return this.values;
  }
  setValue(val) {}
}

class Sheet {
  constructor(name, data) {
    this.name = name;
    this.data = data || []; // Array of arrays
  }
  getLastRow() {
    return this.data.length;
  }
  getLastColumn() {
    return this.data[0] ? this.data[0].length : 0;
  }
  getRange(arg1, arg2, arg3, arg4) {
    // Handle getRange(a1Notation)
    if (typeof arg1 === 'string') {
      const a1Notation = arg1;
      const match = a1Notation.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (match) {
        const startRow = parseInt(match[2], 10);
        const endRow = parseInt(match[4], 10);

        if (endRow < startRow) {
           throw new Error(`Exception: The coordinates of the range are outside the dimensions of the sheet.`);
        }

        const numRows = endRow - startRow + 1;
        const result = [];
        for (let i = 0; i < numRows; i++) {
            const rowIndex = (startRow - 1) + i;
            if (rowIndex < this.data.length) {
                result.push([this.data[rowIndex][0]]);
            } else {
                result.push(['']);
            }
        }
        return new Range(result);
      }
    }
    return new Range([]);
  }
  getDataRange() {
      return new Range(this.data);
  }
}

class Spreadsheet {
  constructor() {
    this.sheets = new Map();
  }
  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }
  addSheet(name, data) {
    this.sheets.set(name, new Sheet(name, data));
  }
}

const activeSpreadsheet = new Spreadsheet();

const SpreadsheetApp = {
  getActiveSpreadsheet: () => activeSpreadsheet,
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
    formatDate: (date) => date.toString()
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
// Assuming this test file is in tests/ and Code.js is in root
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

// --- TEST CASES ---

async function runTests() {
    console.log("Running getAdminNames Tests...");
    let failed = false;

    // Test Case 1: Header-only Admin Settings (Bug Fix Verification)
    // This previously caused a crash. Now it should return empty array.
    console.log("\n--- Test Case 1: Header-only Admin Settings ---");
    activeSpreadsheet.addSheet("Admin Settings", [["Name", "Email"]]); // 1 Row (Header only)

    try {
        const adminNames = sandbox.getAdminNames();
        if (Array.isArray(adminNames) && adminNames.length === 0) {
            console.log("PASS: getAdminNames returned empty array as expected.");
        } else {
            console.log("FAIL: getAdminNames returned unexpected result:", adminNames);
            failed = true;
        }
    } catch (e) {
        console.log("FAIL: Threw error instead of returning empty array:");
        console.log(e.message);
        failed = true;
    }

    // Test Case 2: Normal Case - With Admins (Regression Test)
    console.log("\n--- Test Case 2: Valid Admin Settings ---");
    activeSpreadsheet.addSheet("Admin Settings", [
        ["Name", "Email"],
        ["Admin One", "admin1@school.org"],
        ["Admin Two", "admin2@school.org"]
    ]);

    try {
        const adminNames = sandbox.getAdminNames();
        console.log("getAdminNames returned:", adminNames);
        if (adminNames.length === 2 && adminNames[0] === "Admin One" && adminNames[1] === "Admin Two") {
             console.log("PASS: Retrieved admin names correctly.");
        } else {
             console.log("FAIL: Incorrect admin names retrieved.");
             failed = true;
        }
    } catch (e) {
        console.log("FAIL: Threw error on valid data: " + e.message);
        failed = true;
    }

    if (failed) {
        console.log("\nTests FAILED.");
        process.exit(1);
    } else {
        console.log("\nAll Tests PASSED.");
    }
}

runTests();
