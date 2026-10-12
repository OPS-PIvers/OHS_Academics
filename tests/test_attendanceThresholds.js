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
  setFrozenRows() { return this; }
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
  getActiveUser: () => ({ getEmail: () => currentUser.email }),
  getEffectiveUser: () => ({ getEmail: () => 'runner@school.org' })
};

const sentEmails = [];
const MailApp = { sendEmail: (args) => { sentEmails.push(args); } };

const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
const Logger = { log: () => {} };
const Utilities = { formatDate: (d) => (d && d.toDateString ? d.toDateString() : String(d)) };
const createdTriggers = [];
const ScriptApp = {
  WeekDay: { TUESDAY: 'TUESDAY' },
  getProjectTriggers: () => [],
  deleteTrigger: () => {},
  newTrigger: (fn) => ({ timeBased: () => ({ onWeekDay: (day) => ({ atHour: (hour) => ({ create: () => { createdTriggers.push({ fn, day, hour }); } }) }) }) })
};
const HtmlService = {
  createTemplateFromFile: () => ({}),
  createHtmlOutput: () => ({ setTitle: () => ({ setXFrameOptionsMode: () => {} }) }),
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
};


// --- LOAD Code.js + AdminConfig.js + AttendanceThresholds.js into one context (GAS merges global scope) ---
const load = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const sandbox = {
  SpreadsheetApp, Session, MailApp, LockService, Logger, Utilities, ScriptApp, HtmlService,
  console, Map, Set, Date
};
vm.createContext(sandbox);
vm.runInContext([load('Code.js'), load('AdminConfig.js'), load('AttendanceThresholds.js')].join('\n'), sandbox);

// ---------------------------------------------------------------
// TEST HARNESS
// ---------------------------------------------------------------
let failed = false;
function check(cond, msg) {
  console.log((cond ? 'PASS: ' : 'FAIL: ') + msg);
  if (!cond) failed = true;
}
function expectThrow(fn, fragment, msg) {
  try {
    fn();
    console.log('FAIL: ' + msg + ' (expected throw, got none)');
    failed = true;
  } catch (e) {
    const ok = !fragment || (e.message && e.message.indexOf(fragment) !== -1);
    console.log((ok ? 'PASS: ' : 'FAIL: ') + msg + (ok ? '' : ' (threw "' + e.message + '")'));
    if (!ok) failed = true;
  }
}

// Hub row (A..AG). Period counts by schema column: N unexcused, O tardies, P medical, Q illness, S truancy, V letters.
function hubRow(s) {
  const row = new Array(33).fill('');
  row[1] = s.name; row[2] = s.grade || 10; row[3] = s.id || '';
  row[13] = s.unexcused || 0; row[14] = s.tardies || 0; row[15] = s.medical || 0;
  row[16] = s.illness || 0; row[18] = s.truancy || 0; row[21] = s.letters || '';
  return row;
}
function seedHub(students) {
  activeSpreadsheet.addSheet('⭐Academics & Attendance Hub', [new Array(33).fill('H')].concat(students.map(hubRow)));
}
function seedBase() {
  activeSpreadsheet.addSheet('App Settings', [['Automated Emails Enabled', true]]);
  activeSpreadsheet.addSheet('Staff Roles', [
    ['Name', 'Email', 'Role'],
    ['Admin User', 'admin@school.org', 'ADMIN'],
    ['Teacher User', 'teacher@school.org', 'TEACHER']
  ]);
  activeSpreadsheet.addSheet('Admin Settings', [
    ['Admin Name', 'Admin Email', 'CM First', 'CM Last', 'CM Email', 'C Name', 'C Email', 'C AStart', 'C AEnd'],
    ['Admin One', 'a1@s.org', '', '', '', 'Coun AL', 'c-al@s.org', 'A', 'M'],
    ['', '', '', '', '', 'Coun MZ', 'c-mz@s.org', 'M', 'ZZZ']
  ]);
  activeSpreadsheet.deleteSheetByName('Attendance Thresholds');
  activeSpreadsheet.deleteSheetByName('Attendance Threshold Log');
}
const levelsByName = levels => Object.fromEntries(levels.map(l => [l.name, l]));

function runTests() {
  console.log('Running Attendance Threshold Tests...\n');
  seedBase();
  const levels = sandbox.readActiveAttendanceLevels_(false);
  const L = levelsByName(levels);

  console.log('--- attendanceStepsReached_ ---');
  const tardy = L['Tardy – every 4 periods'];
  check(sandbox.attendanceStepsReached_(3, tardy) === 0, 'tardy: 3 periods -> 0');
  check(sandbox.attendanceStepsReached_(4, tardy) === 1, 'tardy: 4 periods -> 1');
  check(sandbox.attendanceStepsReached_(7, tardy) === 1, 'tardy: 7 periods -> 1');
  check(sandbox.attendanceStepsReached_(12, tardy) === 3, 'tardy: 12 periods -> 3 (repeats every 4)');
  check(sandbox.attendanceStepsReached_(50, L['SAT L1 – 3 days']) === 1, 'one-time level never exceeds 1');

  console.log('\n--- evaluateAttendanceThresholds_ ---');
  const jumper = { studentName: 'Adams, Amy', id: 1, unexcusedAbsences: 5, truancyAbsences: 3 }; // 8 truant periods
  const ill = { studentName: 'Nash, Ned', id: 2, medicalAbsences: 20, illnessAbsences: 9 };     // 29 illness periods
  let res = sandbox.evaluateAttendanceThresholds_([jumper, ill], levels, new Map());
  const jTruant = res.entries.find(e => e.student === jumper && e.category === 'TRUANT');
  check(jTruant && jTruant.level.name === 'Truant – 1 day', 'truant = unexcused + truancy (8 periods -> 1 day level)');
  check(jTruant.isNew && jTruant.newLevel.name === 'Truant – 1 day', 'jump reports highest new level');
  check(jTruant.alsoCrossed.join('|') === 'Truant – 1 period|Truant – ½ day', 'skipped levels listed in alsoCrossed');
  const nIll = res.entries.find(e => e.student === ill && e.category === 'ILLNESS');
  check(nIll && nIll.level.name === 'SAT L4 – 4 days illness/medical', 'illness = medical + illness (29 periods -> SAT L4)');
  check(!res.entries.some(e => e.student === ill && e.category === 'TRUANT'), 'no entry for a category with zero periods');

  // Already reported -> not new; nextLog round-trips
  const log = new Map();
  res.nextLog.forEach((v, k) => log.set(k, v.steps));
  res = sandbox.evaluateAttendanceThresholds_([jumper, ill], levels, log);
  check(res.entries.every(e => !e.isNew), 'nothing is new once logged');

  // Repeating level re-fires
  const tardyStudent = { studentName: 'Tate, Tom', id: 3, unexcusedTardies: 4 };
  res = sandbox.evaluateAttendanceThresholds_([tardyStudent], levels, new Map());
  const tLog = new Map(); res.nextLog.forEach((v, k) => tLog.set(k, v.steps));
  tardyStudent.unexcusedTardies = 9;
  res = sandbox.evaluateAttendanceThresholds_([tardyStudent], levels, tLog);
  check(res.entries[0].isNew && res.entries[0].steps === 2 && res.entries[0].newSteps === 1, 'tardy re-fires at 8 (2x, 1 new)');

  // Auto-reset: log says SAT L1 but student is now below it
  const resetLog = new Map([['id:1||SAT L1 – 3 days', 1], ['id:1||Truant – 1 period', 1]]);
  res = sandbox.evaluateAttendanceThresholds_([jumper], levels, resetLog);
  check(!res.nextLog.has('id:1||SAT L1 – 3 days'), 'auto-reset drops a level the student no longer meets');
  check(res.nextLog.get('id:1||Truant – 1 period').steps === 1, 'still-met levels stay logged');

  console.log('\n--- sendAttendanceThresholdEmails (end to end) ---');
  seedBase();
  seedHub([
    { name: 'Adams, Amy', id: 1, unexcused: 10, truancy: 5, letters: 'L1 (09/15)' }, // 15 truant -> 2 days (counselor A-L)
    { name: 'Nash, Ned', id: 2, unexcused: 2 },                                     // 2 truant -> 1 period
    { name: 'Zed, <b>Zoe</b>', id: 3, truancy: 22 }                                  // 22 truant -> SAT L1 (counselor M-Z)
  ]);
  currentUser.email = 'admin@school.org';
  // Set recipients through the admin endpoint (also exercises auto-create of the config sheet).
  const cfg = sandbox.getAdminConfigData().attendanceThresholds;
  check(cfg.length === 11, 'config sheet auto-created with 11 default levels');
  cfg.forEach(l => { l.recipientEmails = l.name.indexOf('Truant –') === 0 || l.name.indexOf('Tardy') === 0 ? 'pam@s.org' : 'pam@s.org, kate@s.org'; });
  sandbox.saveAttendanceThresholds(cfg);

  sentEmails.length = 0;
  sandbox.sendAttendanceThresholdEmails();
  const to = addr => sentEmails.filter(e => e.to === addr);
  check(to('pam@s.org').length === 1, 'one email per recipient (pam)');
  check(/\(3 new\)/.test(to('pam@s.org')[0].subject), 'pam sees 3 new crossings');
  check(to('kate@s.org').length === 1 && /\(1 new\)/.test(to('kate@s.org')[0].subject), 'kate only gets levels she is listed on (SAT L1)');
  const al = to('c-al@s.org'), mz = to('c-mz@s.org');
  check(al.length === 1 && al[0].htmlBody.indexOf('Adams, Amy') !== -1 && al[0].htmlBody.indexOf('Zoe') === -1, 'A-L counselor gets only own student');
  check(mz.length === 1 && mz[0].htmlBody.indexOf('Zed') !== -1 && mz[0].htmlBody.indexOf('Adams') === -1, 'M-Z counselor gets only own student');
  check(al[0].htmlBody.indexOf('Nash') === -1, 'counselor not emailed for levels without counselor flag');
  check(to('pam@s.org')[0].htmlBody.indexOf('&lt;b&gt;Zoe&lt;/b&gt;') !== -1, 'student names are HTML-escaped');
  check(to('pam@s.org')[0].htmlBody.indexOf('L1 (09/15)') !== -1, 'letters already sent are shown');
  check(to('erin.head@orono.k12.mn.us').some(e => /System Recap/.test(e.subject)), 'admin recap sent');
  const logSheet = activeSpreadsheet.getSheetByName('Attendance Threshold Log');
  check(logSheet && logSheet.getLastRow() > 1, 'log sheet written');

  sentEmails.length = 0;
  sandbox.sendAttendanceThresholdEmails();
  check(/\(0 new\)/.test(to('pam@s.org')[0].subject), 'second run: nothing new, students still listed as current');
  check(to('pam@s.org')[0].htmlBody.indexOf('Adams, Amy') !== -1, 'second run still lists current students');

  console.log('\n--- toggle OFF ---');
  activeSpreadsheet.addSheet('App Settings', [['Automated Emails Enabled', false]]);
  sentEmails.length = 0;
  sandbox.sendAttendanceThresholdEmails();
  check(sentEmails.length === 0, 'no emails when automated emails are OFF');

  console.log('\n--- preview ---');
  seedBase();
  seedHub([{ name: 'Adams, Amy', id: 1, unexcused: 30 }]);
  sentEmails.length = 0;
  sandbox.previewAttendanceThresholdEmails();
  check(sentEmails.length > 0 && sentEmails.every(e => e.to === 'runner@school.org'), 'preview sends only to the runner');
  check(sentEmails.every(e => /^\[PREVIEW for /.test(e.subject)), 'preview subjects are marked');
  check(activeSpreadsheet.getSheetByName('Attendance Threshold Log') === null, 'preview does not write the log');

  console.log('\n--- seedAttendanceThresholdLog ---');
  sentEmails.length = 0;
  sandbox.seedAttendanceThresholdLog();
  check(sentEmails.length === 0, 'seeding sends no email');
  check(activeSpreadsheet.getSheetByName('Attendance Threshold Log').getLastRow() > 1, 'seeding records current levels');

  console.log('\n--- saveAttendanceThresholds validation ---');
  currentUser.email = 'admin@school.org';
  const base = { name: 'X', category: 'TRUANT', threshold: 3, repeatEvery: '', recipientEmails: '', includeCounselor: false, active: true };
  expectThrow(() => sandbox.saveAttendanceThresholds([Object.assign({}, base, { category: 'NOPE' })]), 'Invalid category', 'rejects unknown category');
  expectThrow(() => sandbox.saveAttendanceThresholds([Object.assign({}, base, { threshold: '1.5' })]), 'Threshold', 'rejects non-integer threshold');
  expectThrow(() => sandbox.saveAttendanceThresholds([Object.assign({}, base, { repeatEvery: '-2' })]), 'Repeat Every', 'rejects bad repeat');
  expectThrow(() => sandbox.saveAttendanceThresholds([Object.assign({}, base, { recipientEmails: 'a@s.org, nope' })]), 'Invalid recipient email', 'rejects bad email');
  expectThrow(() => sandbox.saveAttendanceThresholds([base, Object.assign({}, base, { name: 'x' })]), 'Duplicate', 'rejects duplicate level names');
  currentUser.email = 'teacher@school.org';
  expectThrow(() => sandbox.saveAttendanceThresholds([base]), 'Unauthorized', 'non-admins cannot save');
  expectThrow(() => sandbox.sendAttendanceThresholdPreviewToMe(), 'Unauthorized', 'non-admins cannot send previews');

  console.log('\n--- dashboard payload ---');
  seedBase();
  const payload = sandbox.buildAttendanceTiersPayload_(
    [{ studentName: 'Adams, Amy', id: 1, unexcusedAbsences: 22 }],
    [{ studentName: 'Adams, Amy', id: 1, unexcusedAbsences: 22 }, { studentName: 'Zed, Zoe', id: 3, truancyAbsences: 25 }]
  );
  check(payload.rows.length === 1 && payload.rows[0].levelName === 'SAT L1 – 3 days', 'rows limited to named students');
  check(payload.schoolCounts['SAT L1 – 3 days'] === 2, 'school-wide counts include everyone');
  check(JSON.stringify(payload).indexOf('@') === -1, 'payload never includes recipient emails');

  console.log('\n--- setupAttendanceThresholdTrigger ---');
  sandbox.setupAttendanceThresholdTrigger();
  const t = createdTriggers[createdTriggers.length - 1];
  check(t && t.fn === 'sendAttendanceThresholdEmails' && t.day === 'TUESDAY' && t.hour === 7, 'weekly trigger: Tuesday 7am');

  console.log('\n' + (failed ? 'Tests FAILED.' : 'All Attendance Threshold Tests PASSED.'));
  if (failed) process.exit(1);
}

runTests();
