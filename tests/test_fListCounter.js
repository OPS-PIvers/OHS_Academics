const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Minimal sheet mocks: 2-D grid with numeric getRange, appendRow and clearContent.
class Range {
  constructor(sheet, row, col, numRows, numCols) { Object.assign(this, { sheet, row, col, numRows, numCols }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.numRows; i++) {
      const r = [];
      for (let j = 0; j < this.numCols; j++) r.push(this.sheet.getCell(this.row + i, this.col + j));
      out.push(r);
    }
    return out;
  }
  setValues(vals) { vals.forEach((r, i) => r.forEach((v, j) => this.sheet.setCell(this.row + i, this.col + j, v))); return this; }
  clearContent() { return this.setValues(this.getValues().map(r => r.map(() => ''))); }
  setFontWeight() { return this; }
}
class Sheet {
  constructor(name, data) { this.name = name; this.grid = []; (data || []).forEach((r, i) => r.forEach((v, j) => this.setCell(i + 1, j + 1, v))); }
  getCell(r, c) { const v = (this.grid[r - 1] || [])[c - 1]; return v === undefined ? '' : v; }
  setCell(r, c, v) { while (this.grid.length < r) this.grid.push([]); this.grid[r - 1][c - 1] = v; }
  getLastRow() { for (let r = this.grid.length; r > 0; r--) if ((this.grid[r - 1] || []).some(v => v !== '' && v !== undefined)) return r; return 0; }
  getRange(r, c, n = 1, m = 1) { return new Range(this, r, c, n, m); }
  appendRow(vals) { const r = this.getLastRow() + 1; vals.forEach((v, j) => this.setCell(r, j + 1, v)); }
  setFrozenRows() {}
}

const HUB = '⭐Academics & Attendance Hub';
function hubRow(name, grade, id, ae) { const r = new Array(31).fill(''); r[1] = name; r[2] = grade; r[3] = id; r[30] = ae; return r; }
const fHeader = ['Grade', 'Student Name', 'Perm ID', 'Per', 'Course Title', 'Staff Name', 'Mark', 'Calc. %'];

let sheets;
let fakeNow;
function setup(hub, fList) {
  sheets = { [HUB]: new Sheet(HUB, hub), 'F List': new Sheet('F List', [fHeader, ...fList]) };
}
const RealDate = Date;
class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fakeNow); } }

const context = {
  Logger: { log: () => {} },
  Date: FakeDate,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = new Sheet(n)),
  }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  ScriptApp: {},
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'FListCounter.js'), 'utf8'), context);

let failures = 0;
function check(label, cond) { console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`); if (!cond) failures++; }
const ae = r => sheets[HUB].getCell(r, 31);
const DAY = 86400000;

const hub = [
  hubRow('Name', 'Grade', 'ID', 'Weeks'),
  hubRow('Abram, John', 9, 702073, ''),
  hubRow('Haglin, Kira', 9, 702134, 3),
  hubRow('Noid, Pat', 10, '', ''),
  hubRow('Clean, Casey', 11, 700001, ''),
];
const week1 = [
  ['09', 'Abram, John D.', '702073', '2', 'PRE-CALC', 'Allex, J.', 'F', '52.4'],
  ['09', 'Haglin, Kira S.', '702134', '1', 'GEOMETRY A', 'Porter, N.', 'F', '59'],
  ['09', 'Haglin, Kira S.', '702134', '3', 'AP HUG', 'Bohl, C.', 'F', '53'],
  ['10', 'Noid, Pat Q.', '', '4', 'ART', 'X, Y.', 'F', '40'],
  ['12', 'Ghost, Gary', '799999', '1', 'GYM', 'Z, Z.', 'F', '10'],
];
setup(hub, week1);
fakeNow = new RealDate('2026-10-13T11:00:00Z').getTime();
context.incrementFListWeekCounts();
check('ID match starts a streak at 1', ae(2) === 1);
check('multiple Fs count once; extends an existing streak', ae(3) === 4);
check('name fallback match when ID missing', ae(4) === 1);
check('student not on list stays blank', ae(5) === '');
const log = sheets['F List Count Log'];
check('log row written', log.getLastRow() === 2 && log.getCell(2, 2) === 4 && log.getCell(2, 3) === 3);
check('unmatched name logged', log.getCell(2, 4) === 'Ghost, Gary');

fakeNow += 7 * DAY;
check('same list a week later is not recounted', context.incrementFListWeekCounts() === 'unchanged' && ae(2) === 1);

sheets['F List'] = new Sheet('F List', [fHeader, ['09', 'Abram, John D.', '702073', '2', 'PRE-CALC', 'Allex, J.', 'F', '50']]);
fakeNow = new RealDate('2026-10-15T11:00:00Z').getTime();
check('changed list within 5 days is treated as a correction', context.incrementFListWeekCounts() === 'too soon' && ae(2) === 1);

check('correction is logged', log.getLastRow() === 3 && log.getCell(3, 6) === 'Correction (not counted)');
fakeNow = new RealDate('2026-10-19T11:00:00Z').getTime();
check('correction is not counted once 5 days pass', context.incrementFListWeekCounts() === 'unchanged' && ae(2) === 1);

sheets['F List'] = new Sheet('F List', [fHeader, ['09', 'Abram, John D.', '702073', '2', 'PRE-CALC', 'Allex, J.', 'F', '48']]);
fakeNow = new RealDate('2026-10-20T11:00:00Z').getTime();
context.incrementFListWeekCounts();
check('on the new list again: streak continues', ae(2) === 2);
check('missing from the new list: streak resets to blank', ae(3) === '' && ae(4) === '');
check('counted log row', log.getLastRow() === 4 && log.getCell(4, 6) === 'Counted');

sheets['F List'] = new Sheet('F List', [fHeader]);
fakeNow += 7 * DAY;
check('empty F List changes nothing', context.incrementFListWeekCounts() === 'empty' && ae(2) === 2);

context.resetFListWeekCounts();
check('reset clears AE and log', ae(2) === '' && ae(3) === '' && log.getLastRow() === 1 && sheets[HUB].getCell(1, 31) === 'Weeks');

console.log(failures ? `\n${failures} failure(s)` : '\nAll F List counter tests passed.');
process.exit(failures ? 1 : 0);
