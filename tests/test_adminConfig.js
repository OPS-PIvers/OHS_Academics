const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ---------------------------------------------------------------
// MOCKS (extended to support multi-column reads/writes, sheet creation,
// checkboxes and a script lock — none of which the older test mocks had)
// ---------------------------------------------------------------

function colToIndex(name) {
  let res = 0;
  for (let i = 0; i < name.length; i++) {
    res = res * 26 + (name.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return res - 1; // 0-based
}

class Range {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValues() {
    const out = [];
    for (let i = 0; i < this.numRows; i++) {
      const row = [];
      for (let j = 0; j < this.numCols; j++) {
        row.push(this.sheet.getCell(this.row + i, this.col + j));
      }
      out.push(row);
    }
    return out;
  }
  getValue() {
    return this.getValues()[0][0];
  }
  setValues(vals) {
    for (let i = 0; i < vals.length; i++) {
      for (let j = 0; j < vals[i].length; j++) {
        this.sheet.setCell(this.row + i, this.col + j, vals[i][j]);
      }
    }
    return this;
  }
  setValue(v) {
    this.sheet.setCell(this.row, this.col, v);
    return this;
  }
  setFontWeight() { return this; }
  setFrozenRows() { return this; }
  insertCheckboxes() { return this; }
}

class Sheet {
  constructor(name, data) {
    this.name = name;
    this.grid = [];
    if (Array.isArray(data)) {
      data.forEach((row, r) => (row || []).forEach((v, c) => this.setCell(r + 1, c + 1, v)));
    }
  }
  getCell(r, c) {
    const row = this.grid[r - 1];
    if (!row) return '';
    const v = row[c - 1];
    return v === undefined || v === null ? '' : v;
  }
  setCell(r, c, v) {
    while (this.grid.length < r) this.grid.push([]);
    const row = this.grid[r - 1];
    while (row.length < c) row.push('');
    row[c - 1] = v;
  }
  getLastRow() {
    let last = 0;
    for (let r = 0; r < this.grid.length; r++) {
      const row = this.grid[r] || [];
      if (row.some(v => v !== '' && v !== null && v !== undefined)) last = r + 1;
    }
    return last;
  }
  getLastColumn() {
    let last = 0;
    this.grid.forEach(row => { if (row) last = Math.max(last, row.length); });
    return last;
  }
  getRange(arg1, arg2, arg3, arg4) {
    if (typeof arg1 === 'number') {
      return new Range(this, arg1, arg2, arg3 || 1, arg4 || 1);
    }
    if (typeof arg1 === 'string') {
      const m = arg1.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
      if (m) {
        const c1 = colToIndex(m[1]) + 1;
        const r1 = parseInt(m[2], 10);
        const c2 = m[3] ? colToIndex(m[3]) + 1 : c1;
        const r2 = m[4] ? parseInt(m[4], 10) : r1;
        return new Range(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1);
      }
    }
    throw new Error('Unsupported getRange: ' + arg1);
  }
  getDataRange() {
    return new Range(this, 1, 1, this.getLastRow(), this.getLastColumn());
  }
}

class Spreadsheet {
  constructor() { this.sheets = new Map(); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) { const s = new Sheet(name); this.sheets.set(name, s); return s; }
  deleteSheetByName(name) { this.sheets.delete(name); }
  addSheet(name, data) { this.sheets.set(name, new Sheet(name, data)); }
}

const activeSpreadsheet = new Spreadsheet();
const SpreadsheetApp = { getActiveSpreadsheet: () => activeSpreadsheet, WeekDay: { MONDAY: 1 } };

const currentUser = { email: 'admin@school.org' };
const Session = {
  getScriptTimeZone: () => 'GMT',
  getActiveUser: () => ({ getEmail: () => currentUser.email })
};

const sentEmails = [];
const MailApp = { sendEmail: (args) => { sentEmails.push(args); } };

const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
const Logger = { log: () => {} };
const Utilities = { formatDate: (d) => (d && d.toDateString ? d.toDateString() : String(d)) };
const ScriptApp = { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ onWeekDay: () => ({ atHour: () => ({ create: () => {} }) }) }) }) };
const HtmlService = {
  createTemplateFromFile: () => ({}),
  createHtmlOutput: () => ({ setTitle: () => ({ setXFrameOptionsMode: () => {} }) }),
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
};

// --- LOAD Code.js + AdminConfig.js into one context (GAS merges global scope) ---
const code = fs.readFileSync(path.join(__dirname, '..', 'Code.js'), 'utf8');
const adminConfig = fs.readFileSync(path.join(__dirname, '..', 'AdminConfig.js'), 'utf8');

const sandbox = {
  SpreadsheetApp, Session, MailApp, LockService, Logger, Utilities, ScriptApp, HtmlService,
  console, Map, Set, Date
};
vm.createContext(sandbox);
vm.runInContext(code + '\n' + adminConfig, sandbox);

// ---------------------------------------------------------------
// TEST HARNESS
// ---------------------------------------------------------------
let failed = false;
function check(cond, msg) {
  if (cond) {
    console.log('PASS: ' + msg);
  } else {
    console.log('FAIL: ' + msg);
    failed = true;
  }
}
function expectThrow(fn, fragment, msg) {
  try {
    fn();
    console.log('FAIL: ' + msg + ' (expected throw, got none)');
    failed = true;
  } catch (e) {
    if (!fragment || (e.message && e.message.indexOf(fragment) !== -1)) {
      console.log('PASS: ' + msg);
    } else {
      console.log('FAIL: ' + msg + ' (threw "' + e.message + '", expected to contain "' + fragment + '")');
      failed = true;
    }
  }
}

function seedStaffRoles() {
  activeSpreadsheet.addSheet('Staff Roles', [
    ['Name', 'Email', 'Role'],
    ['Admin User', 'admin@school.org', 'ADMIN'],
    ['Teacher User', 'teacher@school.org', 'TEACHER']
  ]);
}

function seedAdminSettings() {
  // Blocks have intentionally different lengths:
  // Admins: 3 (rows 2-4), Case Managers: 1 (row 2), Counselors: 2 (rows 2-3), Tier 2: 1 (row 2)
  activeSpreadsheet.addSheet('Admin Settings', [
    ['Admin Name', 'Admin Email', 'CM First', 'CM Last', 'CM Email', 'C Name', 'C Email', 'C AStart', 'C AEnd', 'T2 Name', 'T2 Int', 'T2 Email'],
    ['Admin One', 'a1@s.org', 'First1', 'Last1', 'cm1@s.org', 'Coun One', 'c1@s.org', 'A', 'M', 'T2 One', 'ADSIS', 't1@s.org'],
    ['Admin Two', 'a2@s.org', '', '', '', 'Coun Two', 'c2@s.org', 'M', 'ZZZ', '', '', ''],
    ['Admin Three', 'a3@s.org', '', '', '', '', '', '', '', '', '', '']
  ]);
}

function runTests() {
  console.log('Running Admin Config Tests...\n');

  // --- areAutomatedEmailsEnabled ---
  console.log('--- areAutomatedEmailsEnabled ---');
  activeSpreadsheet.deleteSheetByName('App Settings');
  check(sandbox.areAutomatedEmailsEnabled() === true, 'returns true when App Settings missing (auto-created, defaults ON)');
  check(activeSpreadsheet.getSheetByName('App Settings') !== null, 'App Settings sheet was auto-created');

  activeSpreadsheet.addSheet('App Settings', [['Automated Emails Enabled', false]]);
  check(sandbox.areAutomatedEmailsEnabled() === false, 'returns false when B1 is false');
  activeSpreadsheet.addSheet('App Settings', [['Automated Emails Enabled', true]]);
  check(sandbox.areAutomatedEmailsEnabled() === true, 'returns true when B1 is true');
  activeSpreadsheet.addSheet('App Settings', [['Automated Emails Enabled', 'FALSE']]);
  check(sandbox.areAutomatedEmailsEnabled() === false, 'returns false when B1 is the string "FALSE"');

  // --- requireAdmin_ ---
  console.log('\n--- requireAdmin_ ---');
  seedStaffRoles();
  seedAdminSettings();
  currentUser.email = 'admin@school.org';
  const adminUser = sandbox.requireAdmin_();
  check(adminUser && adminUser.role === 'ADMIN', 'returns user for an ADMIN');
  currentUser.email = 'teacher@school.org';
  expectThrow(() => sandbox.requireAdmin_(), 'Unauthorized', 'throws for a non-admin (TEACHER)');
  currentUser.email = 'nobody@school.org';
  expectThrow(() => sandbox.requireAdmin_(), 'Unauthorized', 'throws for an unknown user');

  // --- getAdminConfigData independence ---
  console.log('\n--- getAdminConfigData (independent block lengths) ---');
  currentUser.email = 'admin@school.org';
  seedAdminSettings();
  const data = sandbox.getAdminConfigData();
  check(data.adminSettings.admins.length === 3, 'reads 3 admins');
  check(data.adminSettings.caseManagers.length === 1, 'reads 1 case manager (independent length)');
  check(data.adminSettings.counselors.length === 2, 'reads 2 counselors (independent length)');
  check(data.adminSettings.tier2.length === 1, 'reads 1 Tier 2 instructor (independent length)');
  check(data.staffRoles.length === 2, 'reads 2 staff roles');
  check(JSON.stringify(data.roleOptions) === JSON.stringify(['ADMIN', 'TEACHER', 'COUNSELOR']), 'returns role options');

  // --- block save: padding + independence ---
  console.log('\n--- saveAdmins (pad removed rows, leave other blocks intact) ---');
  seedAdminSettings();
  currentUser.email = 'admin@school.org';
  sandbox.saveAdmins([{ name: 'Solo Admin', email: 'solo@s.org' }]);
  const sheet = activeSpreadsheet.getSheetByName('Admin Settings');
  check(sheet.getCell(2, 1) === 'Solo Admin' && sheet.getCell(2, 2) === 'solo@s.org', 'row 2 has the new admin');
  check(sheet.getCell(3, 1) === '' && sheet.getCell(4, 1) === '', 'removed admin rows 3-4 (cols A,B) are blanked');
  check(sheet.getCell(2, 7) === 'c1@s.org', 'counselor block (col G row 2) untouched');
  check(sheet.getCell(3, 7) === 'c2@s.org', 'counselor block (col G row 3) untouched');
  check(sheet.getCell(2, 5) === 'cm1@s.org', 'case manager block (col E row 2) untouched');
  check(sheet.getCell(2, 12) === 't1@s.org', 'Tier 2 block (col L row 2) untouched');

  // --- validation ---
  console.log('\n--- validation ---');
  expectThrow(() => sandbox.saveAdmins([{ name: 'X', email: 'not-an-email' }]), 'Invalid admin email', 'rejects invalid email');
  expectThrow(() => sandbox.saveAdmins([{ name: '', email: 'a@b.com' }]), 'required', 'rejects missing required field');
  expectThrow(() => sandbox.saveStaffRoles([{ name: 'N', email: 'n@s.org', role: 'WIZARD' }]), 'Invalid role', 'rejects invalid staff role');

  // --- staff roles self-lockout guards ---
  console.log('\n--- saveStaffRoles self-lockout guards ---');
  seedStaffRoles();
  currentUser.email = 'admin@school.org';
  expectThrow(() => sandbox.saveStaffRoles([{ name: 'Teacher User', email: 'teacher@school.org', role: 'TEACHER' }]), 'at least one ADMIN', 'rejects removing the last ADMIN');
  expectThrow(() => sandbox.saveStaffRoles([{ name: 'Other Admin', email: 'other@school.org', role: 'ADMIN' }]), 'your own ADMIN access', 'rejects removing the current admin\'s own access');
  const okRoles = sandbox.saveStaffRoles([
    { name: 'Admin User', email: 'admin@school.org', role: 'ADMIN' },
    { name: 'New Counselor', email: 'coun@school.org', role: 'COUNSELOR' }
  ]);
  check(okRoles.length === 2 && okRoles[1].role === 'COUNSELOR', 'saves a valid staff roles list (incl. COUNSELOR)');

  // --- email guard OFF: no send, no side effects ---
  console.log('\n--- email guard (OFF) ---');
  activeSpreadsheet.addSheet('App Settings', [['Automated Emails Enabled', false]]);
  activeSpreadsheet.addSheet('✎Activity Advisors & Coaches', [
    ['Activity', 'Students', 'P Name', 'P Email', 'S Name', 'S Email', 'O Names', 'O Emails', 'Send', 'Timestamp'],
    ['Soccer', 'Student A\nStudent B', 'Coach P', 'p@s.org', '', '', '', '', true, '']
  ]);
  sentEmails.length = 0;
  sandbox.sendIneligibilityNotifications();
  const adv = activeSpreadsheet.getSheetByName('✎Activity Advisors & Coaches');
  check(sentEmails.length === 0, 'no emails sent when toggle OFF');
  check(adv.getCell(2, 9) === true, 'Send checkbox (col I) left unchanged when OFF');
  check(adv.getCell(2, 10) === '', 'timestamp (col J) left unchanged when OFF');

  // --- email guard ON: sends and applies side effects ---
  console.log('\n--- email guard (ON) ---');
  activeSpreadsheet.addSheet('App Settings', [['Automated Emails Enabled', true]]);
  seedAdminSettings();
  sentEmails.length = 0;
  sandbox.sendIneligibilityNotifications();
  check(sentEmails.some(e => String(e.to).indexOf('p@s.org') !== -1), 'advisor email sent when toggle ON');
  check(adv.getCell(2, 9) === false, 'Send checkbox (col I) unchecked after sending');

  // --- activity advisors: edit existing row only ---
  console.log('\n--- saveActivityAdvisors (edit existing row) ---');
  activeSpreadsheet.addSheet('✎Activity Advisors & Coaches', [
    ['Activity', 'Students', 'P Name', 'P Email', 'S Name', 'S Email', 'O Names', 'O Emails', 'Send', 'Timestamp'],
    ['Soccer', 'Student A', '', '', '', '', '', '', false, '']
  ]);
  currentUser.email = 'admin@school.org';
  sandbox.saveActivityAdvisors([{ row: 2, primaryName: 'New Coach', primaryEmail: 'new@s.org', secondaryName: '', secondaryEmail: '', otherNames: '', otherEmails: '', sendNotification: true }]);
  const adv2 = activeSpreadsheet.getSheetByName('✎Activity Advisors & Coaches');
  check(adv2.getCell(2, 3) === 'New Coach' && adv2.getCell(2, 4) === 'new@s.org', 'contact fields (C,D) updated');
  check(adv2.getCell(2, 9) === true, 'Send checkbox written as a real boolean');
  check(adv2.getCell(2, 1) === 'Soccer' && adv2.getCell(2, 2) === 'Student A', 'Activity (A) and Students (B) left untouched');
  expectThrow(() => sandbox.saveActivityAdvisors([{ row: 99, primaryName: 'x' }]), 'Invalid activity advisor row', 'rejects out-of-range row');

  console.log('\n' + (failed ? 'Tests FAILED.' : 'All Admin Config Tests PASSED.'));
  if (failed) process.exit(1);
}

runTests();
