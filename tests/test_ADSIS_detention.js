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
  setFontWeight(val) {}
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
    // Handle getRange(row, col, numRows, numCols)
    if (typeof arg1 === 'number' && typeof arg2 === 'number') {
        const startRow = arg1 - 1;
        const startCol = arg2 - 1;
        const numRows = arg3 || 1;
        const numCols = arg4 || 1;
        const result = [];
        for (let i = 0; i < numRows; i++) {
            const row = [];
            for (let j = 0; j < numCols; j++) {
                if (this.data[startRow + i] && this.data[startRow + i][startCol + j] !== undefined) {
                    row.push(this.data[startRow + i][startCol + j]);
                } else {
                    row.push('');
                }
            }
            result.push(row);
        }
        return new Range(result);
    }

    // Handle getRange(a1Notation)
    if (typeof arg1 === 'string') {
      const a1Notation = arg1;
      // Simple A1 notation parser (e.g., "J2:L10", "B2:AD10", "C2:Q10", "A2:K10")
      const match = a1Notation.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      if (match) {
        const startColName = match[1];
        const startRow = parseInt(match[2], 10);
        const endColName = match[3];
        const endRow = parseInt(match[4], 10);

        const colToIndex = (name) => {
            let res = 0;
            for (let i = 0; i < name.length; i++) {
                res = res * 26 + (name.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
            }
            return res - 1;
        };

        const startCol = colToIndex(startColName);
        const endCol = colToIndex(endColName);
        const numRows = endRow - startRow + 1;
        const numCols = endCol - startCol + 1;

        const result = [];
        for (let i = 0; i < numRows; i++) {
            const row = [];
            for (let j = 0; j < numCols; j++) {
                const rIdx = (startRow - 1) + i;
                const cIdx = startCol + j;
                if (this.data[rIdx] && this.data[rIdx][cIdx] !== undefined) {
                    row.push(this.data[rIdx][cIdx]);
                } else {
                    row.push('');
                }
            }
            result.push(row);
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
    formatDate: (date, tz, format) => date.toDateString()
};

const sentEmails = [];
const MailApp = {
    sendEmail: (args) => {
        sentEmails.push(args);
    }
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
    console,
    Map,
    Set,
    Date
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// --- TEST CASES ---

async function runTests() {
    console.log("Running ADSIS Detention Logic Tests...");
    let failed = false;

    // Setup Admin Settings
    // J: Name, K: Intervention, L: Email
    const adminData = [
        ["Admin Name", "Admin Email", "CM First", "CM Last", "CM Email", "C Name", "C Email", "C Alpha Start", "C Alpha End", "Tier 2 Name", "Tier 2 Intervention", "Tier 2 Email"],
        ["", "", "CM1", "Last1", "cm1@example.com", "", "", "", "", "Instructor PF", "Promise Fellow", "pf@example.com"],
        ["", "", "", "", "", "", "", "", "", "Instructor ADSIS", "ADSIS", "adsis@example.com"],
        ["", "", "", "", "", "", "", "", "", "Instructor Standard", "Check-in/Check-out", "standard@example.com"]
    ];
    // We need to map J, K, L which are indices 9, 10, 11
    activeSpreadsheet.addSheet("Admin Settings", adminData);

    // Setup Hub
    // B: Student Name (1), C: Grade (2), G: Unserved Detention (6), L: Failing Classes (11), X: Tier 2 Instructor (23), AD: Consecutive Weeks (29)
    // Range B2:AD... indices 0 to 28
    // B is index 0 of range
    // C is index 1
    // G is index 5
    // L is index 10
    // X is index 22
    // AD is index 28
    const hubData = [
        ["", "Name", "Grade", "ID", "CM", "Act", "Detention", "", "", "", "", "Failing", "", "", "", "", "", "", "", "", "", "", "", "Instructor", "", "", "", "", "", "Weeks"],
        ["", "Student PF", 10, "", "", "", 5, "", "", "", "", "Math\nEnglish", "", "", "", "", "", "", "", "", "", "", "", "PF", "", "", "", "", "", 2],
        ["", "Student ADSIS", 11, "", "", "", 10, "", "", "", "", "History", "", "", "", "", "", "", "", "", "", "", "", "ADSIS", "", "", "", "", "", 3],
        ["", "Student Standard", 12, "", "Last1", "", 15, "", "", "", "", "Science", "", "", "", "", "", "", "", "", "", "", "", "Standard", "", "", "", "", "", 4]
    ];
    activeSpreadsheet.addSheet("⭐Academics & Attendance Hub", hubData);

    // Run the function
    try {
        sandbox.sendTier2InstructorEmails();
    } catch (e) {
        console.log("FAIL: sendTier2InstructorEmails threw error: " + e.stack);
        failed = true;
    }

    console.log(`Sent ${sentEmails.length} emails.`);

    // Verify PF Email
    const pfEmail = sentEmails.find(e => e.to === "pf@example.com");
    if (!pfEmail) {
        console.log("FAIL: PF email not sent.");
        failed = true;
    } else {
        if (pfEmail.htmlBody.includes("Unserved Detention:")) {
            console.log("FAIL: PF email should NOT include Unserved Detention.");
            failed = true;
        } else if (pfEmail.htmlBody.includes("Failing Classes:")) {
            console.log("FAIL: PF email should NOT include Failing Classes.");
            failed = true;
        } else {
            console.log("PASS: PF email correctly excludes academic/detention data.");
        }
    }

    // Verify ADSIS Email
    const adsisEmail = sentEmails.find(e => e.to === "adsis@example.com");
    if (!adsisEmail) {
        console.log("FAIL: ADSIS email not sent.");
        failed = true;
    } else {
        if (!adsisEmail.htmlBody.includes("Unserved Detention:")) {
            console.log("FAIL: ADSIS email SHOULD include Unserved Detention.");
            failed = true;
        } else if (!adsisEmail.htmlBody.includes("10 hours")) {
            console.log("FAIL: ADSIS email should show correct detention hours.");
            failed = true;
        } else {
            console.log("PASS: ADSIS email correctly includes detention data.");
        }
    }

    // Verify Standard Email
    const standardEmail = sentEmails.find(e => e.to === "standard@example.com");
    if (!standardEmail) {
        console.log("FAIL: Standard email not sent.");
        failed = true;
    } else {
        if (standardEmail.htmlBody.includes("Unserved Detention:")) {
            console.log("FAIL: Standard Tier 2 email should NOT include Unserved Detention.");
            failed = true;
        } else if (!standardEmail.htmlBody.includes("Failing Classes:")) {
            console.log("FAIL: Standard Tier 2 email SHOULD still include Failing Classes.");
            failed = true;
        } else {
            console.log("PASS: Standard Tier 2 email correctly excludes detention but includes other Tier 2 data.");
        }
    }

    // Verify Case Manager Email (should still have detention)
    console.log("\nTesting Case Manager Email...");
    sentEmails.length = 0; // Clear for next run
    try {
        sandbox.sendCaseManagerSummaryEmails();
    } catch (e) {
        console.log("FAIL: sendCaseManagerSummaryEmails threw error: " + e.stack);
        failed = true;
    }
    const cmEmail = sentEmails.find(e => e.to === "cm1@example.com");
    if (!cmEmail) {
        console.log("FAIL: CM email not sent.");
        failed = true;
    } else {
        if (!cmEmail.htmlBody.includes("Unserved Detention:")) {
            console.log("FAIL: Case Manager email SHOULD still include Unserved Detention.");
            failed = true;
        } else {
            console.log("PASS: Case Manager email correctly includes detention data.");
        }
    }

    if (failed) {
        console.log("\nTests FAILED.");
        process.exit(1);
    } else {
        console.log("\nAll ADSIS Detention Logic Tests PASSED.");
    }
}

runTests();
