/**
 * F List running total (Hub column AE).
 *
 * Each time a NEW weekly F List is loaded into the "F List" tab, every Hub
 * student on it gets +1 in column AE ("Weeks on F List"). A daily trigger
 * checks the tab; a list is counted only when:
 *   - it is not empty,
 *   - its contents differ from the last list that was counted (so a week with
 *     no new upload is not counted twice), and
 *   - at least F_LIST_MIN_DAYS_BETWEEN_COUNTS days have passed since the last
 *     count (so a mid-week re-paste/correction is not counted as a new week).
 *
 * Every list the script sees is recorded in the "F List Count Log" tab (as
 * Counted or Correction), which is also how it remembers what it has seen. See docs/F_LIST_COUNTER.md.
 */

const F_LIST_SHEET = "F List";
const F_LIST_COUNT_LOG_SHEET = "F List Count Log";
const F_LIST_HUB_SHEET = "⭐Academics & Attendance Hub";
const F_LIST_HUB_TOTAL_COL = 31;   // AE (1-based) — Weeks on F List (running total)
const F_LIST_MIN_DAYS_BETWEEN_COUNTS = 5;
const F_LIST_TRIGGER_HOUR = 6;     // daily, before the 7am Tuesday emails
const F_LIST_LOG_HEADERS = ['Date', 'Students on F List', 'Hub Rows Incremented', 'Not Found in Hub', 'List Fingerprint', 'Status'];
const F_LIST_STATUS_COUNTED = 'Counted';
const F_LIST_STATUS_CORRECTION = 'Correction (not counted)';

/** Lower-cases and collapses whitespace so "Abram,  John" matches "abram, john". */
function normalizeFListName_(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Small deterministic string hash (djb2) — enough to tell one week's list from another. */
function hashFListString_(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/**
 * Collapses the raw F List rows (header removed) into one entry per student.
 * F List columns: A Grade, B Student name (Last, First M.), C Perm ID, D Per, E Course, F Staff, G Mark, H %.
 * @returns {{students: {id: string, name: string}[], fingerprint: string}}
 */
function summarizeFList_(fListRows) {
  const byKey = new Map();
  const lines = [];
  fListRows.forEach(row => {
    const name = String(row[1] || '').trim();
    const id = String(row[2] || '').trim();
    if (!name && !id) return;
    lines.push([id, normalizeFListName_(name), row[3], row[4], row[6], row[7]].join('|'));
    const key = id ? 'id:' + id : 'name:' + normalizeFListName_(name);
    if (!byKey.has(key)) byKey.set(key, { id, name });
  });
  lines.sort();
  return {
    students: Array.from(byKey.values()),
    fingerprint: lines.length ? hashFListString_(lines.join('\n')) : ''
  };
}

/**
 * Pure: works out the new column AE values for one counted week.
 * A Hub row matches an F List student by ID (Hub D = F List C), or — when the
 * ID is missing — by name (F List "Last, First M." starts with Hub "Last, First").
 * Each Hub row is incremented at most once, however many F's the student has.
 *
 * @param {Array[]} hubRows rows of Hub columns B..D ([name, grade, id]) from row 2 down.
 * @param {Array[]} currentTotals column AE values, same length as hubRows.
 * @param {{id: string, name: string}[]} fStudents from summarizeFList_.
 * @returns {{totals: Array[], incremented: number, unmatched: string[]}}
 */
function applyFListWeek_(hubRows, currentTotals, fStudents) {
  const idToRow = new Map();
  hubRows.forEach((row, i) => {
    const id = String(row[2] || '').trim();
    if (id) idToRow.set(id, i);
  });
  const hubNames = hubRows.map(row => normalizeFListName_(row[0]));

  const hits = new Set();
  const unmatched = [];
  fStudents.forEach(s => {
    let idx = s.id && idToRow.has(s.id) ? idToRow.get(s.id) : -1;
    if (idx === -1) {
      const fName = normalizeFListName_(s.name);
      idx = fName ? hubNames.findIndex(h => h && (fName === h || fName.startsWith(h + ' '))) : -1;
    }
    if (idx === -1) unmatched.push(s.name || s.id);
    else hits.add(idx);
  });

  const totals = currentTotals.map((cell, i) => {
    const current = Number(cell[0]) || 0;
    return [hits.has(i) ? current + 1 : (cell[0] === '' ? '' : current)];
  });
  return { totals, incremented: hits.size, unmatched };
}

function getOrCreateFListCountLog_(ss) {
  let sheet = ss.getSheetByName(F_LIST_COUNT_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(F_LIST_COUNT_LOG_SHEET);
    sheet.getRange(1, 1, 1, F_LIST_LOG_HEADERS.length).setValues([F_LIST_LOG_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * @returns {{lastFingerprint: string, lastCountedDate: Date|null}} the fingerprint of the
 *   most recent list seen (counted or correction) and the date of the most recent counted week.
 */
function readFListCountState_(logSheet) {
  const lastRow = logSheet.getLastRow();
  const state = { lastFingerprint: '', lastCountedDate: null };
  if (lastRow < 2) return state;
  const rows = logSheet.getRange(2, 1, lastRow - 1, F_LIST_LOG_HEADERS.length).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!rows[i][0]) continue;
    if (!state.lastFingerprint) state.lastFingerprint = String(rows[i][4] || '');
    if (rows[i][5] !== F_LIST_STATUS_CORRECTION) { state.lastCountedDate = new Date(rows[i][0]); break; }
  }
  return state;
}

/**
 * Trigger handler (daily). Adds this week's F List to the Hub column AE running
 * total if a new list has been loaded. Safe to run by hand — it never counts
 * the same list twice. Returns a short status string (also logged).
 */
function incrementFListWeekCounts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('incrementFListWeekCounts: another run is in progress; skipping.'); return 'locked'; }
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fSheet = ss.getSheetByName(F_LIST_SHEET);
    const hubSheet = ss.getSheetByName(F_LIST_HUB_SHEET);
    if (!fSheet || !hubSheet) { Logger.log('incrementFListWeekCounts: F List or Hub sheet missing.'); return 'missing sheet'; }

    const fLastRow = fSheet.getLastRow();
    const fRows = fLastRow >= 2 ? fSheet.getRange(2, 1, fLastRow - 1, 8).getValues() : [];
    const { students, fingerprint } = summarizeFList_(fRows);
    if (!students.length) { Logger.log('incrementFListWeekCounts: F List is empty; nothing counted.'); return 'empty'; }

    const logSheet = getOrCreateFListCountLog_(ss);
    const state = readFListCountState_(logSheet);
    const now = new Date();
    if (state.lastFingerprint === fingerprint) {
      Logger.log('incrementFListWeekCounts: F List unchanged since it was last seen; skipping.');
      return 'unchanged';
    }
    const since = state.lastCountedDate ? now - state.lastCountedDate : Infinity;
    if (since < F_LIST_MIN_DAYS_BETWEEN_COUNTS * 86400000) {
      // Record it so this corrected list isn't counted as a new week once the 5 days pass.
      logSheet.appendRow([now, students.length, 0, '', fingerprint, F_LIST_STATUS_CORRECTION]);
      Logger.log(`incrementFListWeekCounts: last count was under ${F_LIST_MIN_DAYS_BETWEEN_COUNTS} days ago; logged as a correction, not a new week.`);
      return 'too soon';
    }

    const hubLastRow = hubSheet.getLastRow();
    if (hubLastRow < 2) return 'empty hub';
    const n = hubLastRow - 1;
    const hubRows = hubSheet.getRange(2, 2, n, 3).getValues(); // B Name, C Grade, D ID
    const totalsRange = hubSheet.getRange(2, F_LIST_HUB_TOTAL_COL, n, 1);
    const { totals, incremented, unmatched } = applyFListWeek_(hubRows, totalsRange.getValues(), students);
    totalsRange.setValues(totals);

    logSheet.appendRow([now, students.length, incremented, unmatched.join('; '), fingerprint, F_LIST_STATUS_COUNTED]);
    const msg = `F List counted: ${incremented} Hub students incremented (${students.length} on list, ${unmatched.length} not found in Hub).`;
    Logger.log(msg);
    return msg;
  } finally {
    lock.releaseLock();
  }
}

/** Run once from the Apps Script editor to start the daily F List check. */
function setupFListCounterTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'incrementFListWeekCounts') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('incrementFListWeekCounts')
    .timeBased()
    .everyDays(1)
    .atHour(F_LIST_TRIGGER_HOUR)
    .create();
  Logger.log(`F List counter trigger set for daily at ${F_LIST_TRIGGER_HOUR}:00.`);
}

/**
 * Start-of-year/semester reset: clears Hub column AE and the F List Count Log.
 * Run by hand from the Apps Script editor only.
 */
function resetFListWeekCounts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hubSheet = ss.getSheetByName(F_LIST_HUB_SHEET);
  const hubLastRow = hubSheet.getLastRow();
  if (hubLastRow >= 2) hubSheet.getRange(2, F_LIST_HUB_TOTAL_COL, hubLastRow - 1, 1).clearContent();
  const logSheet = ss.getSheetByName(F_LIST_COUNT_LOG_SHEET);
  if (logSheet && logSheet.getLastRow() >= 2) {
    logSheet.getRange(2, 1, logSheet.getLastRow() - 1, F_LIST_LOG_HEADERS.length).clearContent();
  }
  Logger.log('F List running totals and count log cleared.');
}
