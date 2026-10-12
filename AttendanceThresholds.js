/**
 * AttendanceThresholds.js
 * Weekly attendance-threshold alert emails + the data behind the dashboard "Attendance Tiers" tab.
 *
 * HOW IT WORKS
 *  - Each row of the "Attendance Thresholds" sheet is one LEVEL from the school's attendance
 *    response chart (e.g. "Continuing Truant – SAT L1" = 21 truant/unresolved periods).
 *    Thresholds are stored in CLASS PERIODS (7 periods = 1 school day) because the hub counts periods.
 *  - A level's CATEGORY decides which hub columns are summed (see ATTENDANCE_CATEGORIES).
 *  - A level with "Repeat Every" set re-fires each time the count grows by that many periods
 *    (e.g. tardies: 4, 8, 12, …). Otherwise it fires once.
 *  - The "Attendance Threshold Log" sheet remembers how many times each student has already been
 *    reported for each level, so the weekly email can highlight NEW crossings. If a student's count
 *    drops (new school year, corrected codes) the log is lowered automatically.
 *  - Each recipient gets ONE email per run: "Newly reached" tables on top, then "Currently at each
 *    level" tables. A student only appears under their HIGHEST level per category.
 *  - Recipients per level = the level's listed emails + (optionally) the student's counselor,
 *    resolved from the Admin Settings alpha ranges.
 *
 * ENTRY POINTS (run from the Apps Script editor)
 *  - sendAttendanceThresholdEmails()       weekly job (respects the global Automated Emails toggle)
 *  - previewAttendanceThresholdEmails()    sends every would-be email to YOU only; changes nothing
 *  - seedAttendanceThresholdLog()          marks everyone's current level as already reported
 *                                          (run once before go-live to avoid a first-week flood)
 *  - setupAttendanceThresholdTrigger()     creates the weekly trigger (replaces any existing one)
 *
 * Column references follow spreadsheet_schema.md. Uses _getAllStudentData() (Code.js) for hub reads
 * and readCounselors_/isValidEmail_/withLock_/overwriteColumns_ (AdminConfig.js).
 */

const ATTENDANCE_THRESHOLDS_SHEET = "Attendance Thresholds";
const ATTENDANCE_THRESHOLD_LOG_SHEET = "Attendance Threshold Log";
const PERIODS_PER_DAY = 7;

// Weekly schedule. Hub attendance refreshes Monday night into Tuesday.
const ATTENDANCE_EMAIL_TRIGGER_DAY = 'TUESDAY'; // a ScriptApp.WeekDay name
const ATTENDANCE_EMAIL_TRIGGER_HOUR = 7;        // 0-23, script time zone (America/Chicago)

// Category -> hub fields (keys produced by _getAllStudentData) that are summed.
const ATTENDANCE_CATEGORIES = {
  TARDY:   { label: 'Tardy',                       fields: ['unexcusedTardies'] },                     // O
  TRUANT:  { label: 'Truant / Unresolved Absence', fields: ['unexcusedAbsences', 'truancyAbsences'] }, // N + S
  ILLNESS: { label: 'Illness / Medical',           fields: ['medicalAbsences', 'illnessAbsences'] }    // P + Q
};

// Row colors mirror the response chart (blank / yellow / orange / pink).
const ATTENDANCE_LEGAL_STATUS_COLORS = {
  'Continuing Truant': '#fff2cc',
  'Habitual Truant': '#f9cb9c',
  'Withdrawn': '#f4cccc'
};
const ATTENDANCE_DEFAULT_LEVEL_COLOR = '#f2f2f2';

// "Attendance Thresholds" sheet columns (A..J), header row 1.
const ATTENDANCE_THRESHOLD_HEADERS = [
  'Level Name', 'Legal Status', 'Category', 'Threshold (Periods)', 'Repeat Every (Periods)',
  'Response', 'Recipient Emails', "Include Student's Counselor", 'Contacts (Reference)', 'Active'
];

// Seeded on first use. Emails are left blank except where already known; fill them in via
// Admin Config. "Contacts (Reference)" keeps the names from the chart as a reminder.
const DEFAULT_ATTENDANCE_LEVELS = [
  { name: 'Tardy – every 4 periods', legalStatus: '', category: 'TARDY', threshold: 4, repeatEvery: 4,
    response: '1 detention', includeCounselor: false, contacts: 'Pam Byrnes, Jess Lewin' },
  { name: 'Truant – 1 period', legalStatus: '', category: 'TRUANT', threshold: 1,
    response: '1 detention', includeCounselor: false, contacts: 'Pam Byrnes, Jess Lewin' },
  { name: 'Truant – ½ day', legalStatus: '', category: 'TRUANT', threshold: 4,
    response: '1 detention', includeCounselor: false, contacts: 'Pam Byrnes, Jess Lewin' },
  { name: 'Truant – 1 day', legalStatus: '', category: 'TRUANT', threshold: 7,
    response: '2 detentions', includeCounselor: false, contacts: 'Pam Byrnes, Jess Lewin' },
  { name: 'Truant – 2 days', legalStatus: '', category: 'TRUANT', threshold: 14,
    response: '2 detentions; begin intervention', recipients: 'erin.head@orono.k12.mn.us', includeCounselor: true,
    contacts: 'Pam Byrnes, Jess Lewin, student counselor, Erin Head' },
  { name: 'SAT L1 – 3 days', legalStatus: 'Continuing Truant', category: 'TRUANT', threshold: 21,
    response: 'SAT list: L1', recipients: 'erin.head@orono.k12.mn.us', includeCounselor: true,
    contacts: 'Pam Byrnes, Jess Lewin, student counselor, Erin Head' },
  { name: 'SAT L4 – 4 days illness/medical', legalStatus: 'Continuing Truant', category: 'ILLNESS', threshold: 28,
    response: 'SAT list: L4', recipients: 'erin.head@orono.k12.mn.us', includeCounselor: true,
    contacts: 'Pam Byrnes, Janet Franzin, student counselor, Erin Head' },
  { name: 'SAT L2 – 5 days', legalStatus: 'Continuing Truant', category: 'TRUANT', threshold: 35,
    response: 'SAT list: L2', recipients: 'erin.head@orono.k12.mn.us', includeCounselor: true,
    contacts: 'Pam Byrnes, Jess Lewin, student counselor, Erin Head' },
  { name: 'Be at School Report 1 – 7 days', legalStatus: 'Habitual Truant', category: 'TRUANT', threshold: 49,
    response: 'Be at School Report 1', recipients: 'erin.head@orono.k12.mn.us', includeCounselor: true,
    contacts: 'Pam Byrnes, Jess Lewin, Kaila Frank, student counselor, Erin Head' },
  { name: 'Be at School Report 2 – 12 days', legalStatus: 'Habitual Truant', category: 'TRUANT', threshold: 84,
    response: 'Be at School Report 2', recipients: 'erin.head@orono.k12.mn.us', includeCounselor: true,
    contacts: 'Kate Lee-Radke, Pam Byrnes, Sara Larson, student counselor, Erin Head, Amy Stiener, Kaila Frank, Jess Lewin' },
  { name: 'Withdrawn – 15 days', legalStatus: 'Withdrawn', category: 'TRUANT', threshold: 105,
    response: 'Unenroll; Be at School Report 3', recipients: 'erin.head@orono.k12.mn.us', includeCounselor: true,
    contacts: 'Kate Lee-Radke, Pam Byrnes, Sara Larson, student counselor, Erin Head, Amy Stiener, Kaila Frank, Jess Lewin' }
];

// ===============================================================
// Config sheet
// ===============================================================

function attendanceLevelToRow_(level) {
  return [
    level.name, level.legalStatus || '', level.category, level.threshold,
    level.repeatEvery ? level.repeatEvery : '', level.response || '',
    Array.isArray(level.recipients) ? level.recipients.join(', ') : (level.recipients || ''),
    level.includeCounselor === true, level.contacts || '', level.active !== false
  ];
}

function parseEmailList_(value) {
  return cellToString_(value).split(/[,;\n]/).map(e => e.trim()).filter(String);
}

function toPositiveInt_(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * Normalizes one config row into a level object, or returns null if the row is unusable.
 * `order` preserves sheet order for display.
 */
function rowToAttendanceLevel_(r, order) {
  const name = cellToString_(r[0]);
  const category = cellToString_(r[2]).toUpperCase();
  const threshold = toPositiveInt_(r[3]);
  if (!name || !ATTENDANCE_CATEGORIES[category] || !threshold) {
    if (name) Logger.log('Attendance Thresholds: skipping invalid row "' + name + '" (check Category / Threshold).');
    return null;
  }
  return {
    name: name,
    legalStatus: cellToString_(r[1]),
    category: category,
    categoryLabel: ATTENDANCE_CATEGORIES[category].label,
    threshold: threshold,
    repeatEvery: toPositiveInt_(r[4]),
    response: cellToString_(r[5]),
    recipients: parseEmailList_(r[6]).filter(isValidEmail_),
    includeCounselor: r[7] === true || String(r[7]).toUpperCase() === 'TRUE',
    contacts: cellToString_(r[8]),
    active: !(r[9] === false || String(r[9]).toUpperCase() === 'FALSE'),
    order: order
  };
}

/** Creates the config sheet seeded with DEFAULT_ATTENDANCE_LEVELS. */
function createAttendanceThresholdsSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(ATTENDANCE_THRESHOLDS_SHEET);
  const rows = [ATTENDANCE_THRESHOLD_HEADERS].concat(DEFAULT_ATTENDANCE_LEVELS.map(attendanceLevelToRow_));
  sheet.getRange(1, 1, rows.length, ATTENDANCE_THRESHOLD_HEADERS.length).setValues(rows);
  sheet.getRange(1, 1, 1, ATTENDANCE_THRESHOLD_HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (rows.length > 1) {
    sheet.getRange(2, 8, rows.length - 1, 1).insertCheckboxes();
    sheet.getRange(2, 10, rows.length - 1, 1).insertCheckboxes();
  }
  return sheet;
}

/**
 * Reads all levels (active and inactive) in sheet order.
 * @param {boolean} createIfMissing Create + seed the sheet if missing; otherwise fall back to defaults.
 */
function readAllAttendanceLevels_(createIfMissing) {
  let sheet = getSheetOrNull_(ATTENDANCE_THRESHOLDS_SHEET);
  if (!sheet) {
    if (!createIfMissing) {
      return DEFAULT_ATTENDANCE_LEVELS.map((l, i) => rowToAttendanceLevel_(attendanceLevelToRow_(l), i));
    }
    sheet = createAttendanceThresholdsSheet_();
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, ATTENDANCE_THRESHOLD_HEADERS.length).getValues();
  return values.map((r, i) => rowToAttendanceLevel_(r, i)).filter(Boolean);
}

function readActiveAttendanceLevels_(createIfMissing) {
  return readAllAttendanceLevels_(createIfMissing).filter(l => l.active);
}

// ===============================================================
// Evaluation (pure — no sheet access; unit tested)
// ===============================================================

/** Sum of the hub period counts for a category. */
function attendancePeriodsFor_(student, category) {
  return ATTENDANCE_CATEGORIES[category].fields.reduce((sum, f) => sum + (Number(student[f]) || 0), 0);
}

/** How many times a level has been reached: 0, 1, or (for repeating levels) 1 per extra repeatEvery periods. */
function attendanceStepsReached_(periods, level) {
  if (periods < level.threshold) return 0;
  if (!level.repeatEvery) return 1;
  return Math.floor((periods - level.threshold) / level.repeatEvery) + 1;
}

/** Stable per-student key: hub ID when present, otherwise the name. */
function attendanceStudentKey_(student) {
  const id = cellToString_(student.id);
  return id && id !== '0' ? 'id:' + id : 'name:' + cellToString_(student.studentName).toLowerCase();
}

function attendanceLogKey_(studentKey, levelName) {
  return studentKey + '||' + levelName;
}

/**
 * Evaluates every student against every active level.
 * @param {Object[]} students  Hub rows from _getAllStudentData().
 * @param {Object[]} levels    Active levels.
 * @param {Map<string, number>} log  logKey -> steps already reported.
 * @returns {{entries: Object[], nextLog: Map<string, {steps:number, studentName:string, levelName:string}>}}
 *   entries: one per (student, category) where the student has reached at least one level:
 *     { student, category, periods, level (highest reached), steps,
 *       isNew, newLevel (highest newly reached), newSteps, alsoCrossed: string[] }
 */
function evaluateAttendanceThresholds_(students, levels, log) {
  const byCategory = {};
  levels.forEach(l => { (byCategory[l.category] = byCategory[l.category] || []).push(l); });
  Object.keys(byCategory).forEach(c => byCategory[c].sort((a, b) => a.threshold - b.threshold));

  const entries = [];
  const nextLog = new Map();

  students.forEach(student => {
    const studentKey = attendanceStudentKey_(student);
    Object.keys(byCategory).forEach(category => {
      const periods = attendancePeriodsFor_(student, category);
      let current = null, currentSteps = 0;
      const newlyReached = [];

      byCategory[category].forEach(level => {
        const key = attendanceLogKey_(studentKey, level.name);
        const steps = attendanceStepsReached_(periods, level);
        const reported = log.get(key) || 0;
        if (steps > 0) {
          current = level;
          currentSteps = steps;
          // Auto-reset: never remember more than the student currently has.
          nextLog.set(key, { steps: steps, studentName: student.studentName, levelName: level.name });
        }
        if (steps > reported) newlyReached.push({ level: level, steps: steps, reported: reported });
      });

      if (!current) return;
      const top = newlyReached.length ? newlyReached[newlyReached.length - 1] : null;
      entries.push({
        student: student,
        category: category,
        periods: periods,
        level: current,
        steps: currentSteps,
        isNew: !!top,
        newLevel: top ? top.level : null,
        newSteps: top ? top.steps - top.reported : 0,
        alsoCrossed: newlyReached.slice(0, -1).map(n => n.level.name)
      });
    });
  });

  return { entries: entries, nextLog: nextLog };
}

// ===============================================================
// Log sheet
// ===============================================================

function getOrCreateAttendanceLogSheet_() {
  let sheet = getSheetOrNull_(ATTENDANCE_THRESHOLD_LOG_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(ATTENDANCE_THRESHOLD_LOG_SHEET);
    sheet.getRange(1, 1, 1, 5).setValues([['Student Key', 'Student Name', 'Level Name', 'Times Reported', 'Last Updated']]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** @returns {Map<string, number>} logKey -> steps already reported. Missing sheet = empty log. */
function readAttendanceLog_() {
  const log = new Map();
  const sheet = getSheetOrNull_(ATTENDANCE_THRESHOLD_LOG_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return log;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues().forEach(r => {
    const studentKey = cellToString_(r[0]);
    const levelName = cellToString_(r[2]);
    if (studentKey && levelName) log.set(attendanceLogKey_(studentKey, levelName), Number(r[3]) || 0);
  });
  return log;
}

/** Replaces the log with `nextLog` (as returned by evaluateAttendanceThresholds_). */
function writeAttendanceLog_(nextLog) {
  const sheet = getOrCreateAttendanceLogSheet_();
  const now = new Date();
  const rows = [];
  nextLog.forEach((v, key) => {
    rows.push([key.split('||')[0], v.studentName, v.levelName, v.steps, now]);
  });
  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])) || String(a[2]).localeCompare(String(b[2])));
  overwriteColumns_(sheet, 1, 5, rows);
}

// ===============================================================
// Recipients
// ===============================================================

/** Counselors with an alpha start, sorted; each owns last names from its start up to the next start. */
function getSortedCounselors_() {
  return readCounselors_()
    .filter(c => c.name && isValidEmail_(c.email) && c.alphaStart)
    .sort((a, b) => a.alphaStart.localeCompare(b.alphaStart));
}

function findCounselorForStudent_(studentName, sortedCounselors) {
  const lastName = cellToString_(studentName).split(',')[0].trim();
  if (!lastName) return null;
  let match = null;
  sortedCounselors.forEach(c => {
    if (lastName.localeCompare(c.alphaStart, 'en', { sensitivity: 'base' }) >= 0) match = c;
  });
  return match;
}

/** Lower-cased, de-duplicated recipient emails for one entry's level. */
function attendanceRecipientsFor_(level, student, sortedCounselors) {
  const emails = level.recipients.slice();
  if (level.includeCounselor) {
    const counselor = findCounselorForStudent_(student.studentName, sortedCounselors);
    if (counselor) emails.push(counselor.email);
  }
  return Array.from(new Set(emails.map(e => e.trim().toLowerCase())));
}

/**
 * Groups entries into one bucket per recipient email.
 * @returns {Map<string, {newEntries: Object[], currentEntries: Object[]}>}
 */
function buildAttendanceRecipientBuckets_(entries, sortedCounselors) {
  const buckets = new Map();
  const bucketFor = email => {
    if (!buckets.has(email)) buckets.set(email, { newEntries: [], currentEntries: [] });
    return buckets.get(email);
  };
  entries.forEach(entry => {
    if (entry.isNew) {
      attendanceRecipientsFor_(entry.newLevel, entry.student, sortedCounselors)
        .forEach(email => bucketFor(email).newEntries.push(entry));
    }
    attendanceRecipientsFor_(entry.level, entry.student, sortedCounselors)
      .forEach(email => bucketFor(email).currentEntries.push(entry));
  });
  return buckets;
}

// ===============================================================
// Email HTML
// ===============================================================

function escapeAttendanceHtml_(value) {
  return cellToString_(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatAttendanceDays_(periods) {
  return (Math.round((periods / PERIODS_PER_DAY) * 10) / 10).toString();
}

/**
 * Renders tables grouped by level (in sheet order).
 * @param {Object[]} entries
 * @param {boolean} useNewLevel Group by entry.newLevel (new section) instead of entry.level.
 */
function buildAttendanceLevelTablesHtml_(entries, useNewLevel, levels) {
  const cell = 'padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 12px; font-family: Arial, sans-serif;';
  const th = 'padding: 8px; font-size: 10px; text-transform: uppercase; color: #555;';
  let html = '';

  levels.forEach(level => {
    const group = entries
      .filter(e => (useNewLevel ? e.newLevel : e.level) === level)
      .sort((a, b) => cellToString_(a.student.studentName).localeCompare(cellToString_(b.student.studentName)));
    if (group.length === 0) return;

    const color = ATTENDANCE_LEGAL_STATUS_COLORS[level.legalStatus] || ATTENDANCE_DEFAULT_LEVEL_COLOR;
    const status = level.legalStatus ? escapeAttendanceHtml_(level.legalStatus) + ' &middot; ' : '';
    const rows = group.map(e => {
      const s = e.student;
      const notes = [];
      if (level.repeatEvery) {
        notes.push('Reached ' + e.steps + '&times;' + (useNewLevel && e.newSteps ? ' (' + e.newSteps + ' new)' : ''));
      }
      if (useNewLevel && e.alsoCrossed.length) notes.push('Also crossed: ' + e.alsoCrossed.map(escapeAttendanceHtml_).join(', '));
      return `
        <tr>
          <td style="${cell} white-space: nowrap;">${escapeAttendanceHtml_(s.studentName)}</td>
          <td style="${cell} text-align: center;">${escapeAttendanceHtml_(s.grade)}</td>
          <td style="${cell} text-align: center;">${escapeAttendanceHtml_(s.id)}</td>
          <td style="${cell} text-align: center;">${Number(s.unexcusedAbsences) || 0}</td>
          <td style="${cell} text-align: center;">${Number(s.truancyAbsences) || 0}</td>
          <td style="${cell} text-align: center;">${Number(s.unexcusedTardies) || 0}</td>
          <td style="${cell} text-align: center;">${Number(s.medicalAbsences) || 0}</td>
          <td style="${cell} text-align: center;">${Number(s.illnessAbsences) || 0}</td>
          <td style="${cell} text-align: center; font-weight: bold;">${e.periods} (${formatAttendanceDays_(e.periods)} d)</td>
          <td style="${cell}">${escapeAttendanceHtml_(s.attendanceLetters)}</td>
          <td style="${cell}">${notes.join('<br>')}</td>
        </tr>`;
    }).join('');

    html += `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #ddd; margin-bottom: 18px;">
        <tr><td colspan="11" style="padding: 10px 12px; background-color: ${color}; font-family: Arial, sans-serif; font-size: 13px; color: #222;">
          <strong>${status}${escapeAttendanceHtml_(level.name)}</strong>
          &nbsp;&mdash;&nbsp;${escapeAttendanceHtml_(level.categoryLabel)}, ${level.threshold} period${level.threshold === 1 ? '' : 's'}${level.repeatEvery ? ' (repeats every ' + level.repeatEvery + ')' : ''}
          <br><span style="font-size: 12px;">Response: <strong>${escapeAttendanceHtml_(level.response)}</strong> &middot; ${group.length} student${group.length === 1 ? '' : 's'}</span>
        </td></tr>
        <tr style="background-color: #fafafa;">
          <th style="${th} text-align: left;">Student</th>
          <th style="${th}">Grade</th>
          <th style="${th}">ID</th>
          <th style="${th}">Unexcused</th>
          <th style="${th}">Truancy</th>
          <th style="${th}">Tardies</th>
          <th style="${th}">Medical</th>
          <th style="${th}">Illness</th>
          <th style="${th}">Counted Periods</th>
          <th style="${th} text-align: left;">Letters Sent</th>
          <th style="${th} text-align: left;">Notes</th>
        </tr>
        ${rows}
      </table>`;
  });
  return html;
}

function buildAttendanceEmailHtml_(bucket, levels, previewNote) {
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy 'at' h:mm a");
  const sectionTitle = 'margin: 24px 0 10px 0; font-size: 16px; color: #4356a0; font-family: Arial, sans-serif;';
  const newHtml = bucket.newEntries.length
    ? buildAttendanceLevelTablesHtml_(bucket.newEntries, true, levels)
    : '<p style="font-size: 13px; color: #666;">No students reached a new level since the last report.</p>';
  const currentHtml = buildAttendanceLevelTablesHtml_(bucket.currentEntries, false, levels);
  const preview = previewNote
    ? `<tr><td style="padding: 12px 30px; background-color: #fff3cd; font-size: 13px; font-family: Arial, sans-serif;">${previewNote}</td></tr>`
    : '';

  return `
    <!DOCTYPE html><html><body style="margin: 0; padding: 0; background-color: #f0f0f0; font-family: Arial, sans-serif;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="1000" style="border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <tr><td align="center" style="padding: 40px 0 30px 0; background-color: #4356a0; color: #ffffff;"><h1 style="font-size: 24px; margin: 0;">Weekly Attendance Threshold Report</h1></td></tr>
        ${preview}
        <tr><td style="padding: 20px 30px 40px 30px; color: #153643; font-size: 14px;">
          <p style="margin: 0;">Hello,</p>
          <p style="margin: 15px 0 0 0;">As of <strong>${timestamp}</strong>, these students have reached attendance thresholds that call for a response from you. Counts are in class periods (${PERIODS_PER_DAY} periods = 1 day). Each student is listed under their highest level per category.</p>
          <h2 style="${sectionTitle}">Newly reached since the last report (${bucket.newEntries.length})</h2>
          ${newHtml}
          <h2 style="${sectionTitle}">All students currently at each level (${bucket.currentEntries.length})</h2>
          ${currentHtml}
          <p style="margin-top: 20px; font-size: 12px; color: #888;">This is an automated notification. Please do not reply directly to this email.</p>
        </td></tr>
        <tr><td style="padding: 20px 30px; background-color: #ecf0f1; text-align: center; font-size: 12px; color: #7f8c8d;">This is an automated notification from the OHS Academics &amp; Attendance Hub. Thresholds and recipients are managed in Admin Config &rarr; Attendance Thresholds.</td></tr>
      </table>
    </body></html>`;
}

// ===============================================================
// Runner + entry points
// ===============================================================

/**
 * Shared runner.
 * @param {{previewTo?: string}} opts  When previewTo is set, every email goes to that address only and
 *   the log is not updated (dry run).
 * @returns {{recipients: number, newEntries: number, levelsWithoutRecipients: string[]}}
 */
function runAttendanceThresholdEmails_(opts) {
  const previewTo = opts && opts.previewTo;
  const levels = readActiveAttendanceLevels_(true);
  const students = _getAllStudentData();
  const counselors = getSortedCounselors_();
  const { entries, nextLog } = evaluateAttendanceThresholds_(students, levels, readAttendanceLog_());
  const buckets = buildAttendanceRecipientBuckets_(entries, counselors);

  const levelsWithoutRecipients = levels
    .filter(l => l.recipients.length === 0 && !l.includeCounselor)
    .map(l => l.name);
  levelsWithoutRecipients.forEach(n => Logger.log('Attendance Thresholds: level "' + n + '" has no recipients.'));

  const dateForSubject = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy");
  const sentRecipients = [];
  buckets.forEach((bucket, email) => {
    const subject = `Attendance Threshold Report (${bucket.newEntries.length} new) - ${dateForSubject}`;
    const previewNote = previewTo
      ? `<strong>PREVIEW</strong> &mdash; this would have been sent to <strong>${escapeAttendanceHtml_(email)}</strong>. Nothing was logged.` +
        (levelsWithoutRecipients.length ? `<br>Levels with no recipients: ${levelsWithoutRecipients.map(escapeAttendanceHtml_).join(', ')}` : '')
      : '';
    try {
      MailApp.sendEmail({
        to: previewTo || email,
        subject: previewTo ? `[PREVIEW for ${email}] ${subject}` : subject,
        htmlBody: buildAttendanceEmailHtml_(bucket, levels, previewNote)
      });
      sentRecipients.push({ name: `${bucket.newEntries.length} new / ${bucket.currentEntries.length} current`, email: email });
    } catch (e) {
      Logger.log(`Attendance Thresholds: failed to send to ${email}: ${e.toString()}`);
    }
  });

  if (!previewTo) {
    writeAttendanceLog_(nextLog);
    sendAdminRecapEmail("Attendance Threshold Emails", sentRecipients);
  }
  return {
    recipients: sentRecipients.length,
    newEntries: entries.filter(e => e.isNew).length,
    levelsWithoutRecipients: levelsWithoutRecipients
  };
}

/** Weekly job. Emails recipients and updates the log. */
function sendAttendanceThresholdEmails() {
  if (!areAutomatedEmailsEnabled()) { Logger.log('sendAttendanceThresholdEmails: automated emails disabled; skipping.'); return; }
  const result = runAttendanceThresholdEmails_({});
  Logger.log('sendAttendanceThresholdEmails: ' + JSON.stringify(result));
}

/** Dry run from the editor: every would-be email goes to the person running it. Nothing is logged. */
function previewAttendanceThresholdEmails() {
  const me = Session.getEffectiveUser().getEmail();
  const result = runAttendanceThresholdEmails_({ previewTo: me });
  Logger.log('previewAttendanceThresholdEmails (sent to ' + me + '): ' + JSON.stringify(result));
}

/** Dry run from Admin Config: sends previews to the signed-in admin. */
function sendAttendanceThresholdPreviewToMe() {
  const admin = requireAdmin_();
  return runAttendanceThresholdEmails_({ previewTo: admin.email });
}

/**
 * Records every student's current level as already reported, without sending email.
 * Run once before go-live so the first real email doesn't flag the whole school as "new".
 */
function seedAttendanceThresholdLog() {
  const levels = readActiveAttendanceLevels_(true);
  const { nextLog } = evaluateAttendanceThresholds_(_getAllStudentData(), levels, readAttendanceLog_());
  writeAttendanceLog_(nextLog);
  Logger.log('seedAttendanceThresholdLog: recorded ' + nextLog.size + ' student/level entries.');
}

/** Creates the weekly trigger (ATTENDANCE_EMAIL_TRIGGER_DAY at ATTENDANCE_EMAIL_TRIGGER_HOUR). */
function setupAttendanceThresholdTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'sendAttendanceThresholdEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendAttendanceThresholdEmails')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay[ATTENDANCE_EMAIL_TRIGGER_DAY])
    .atHour(ATTENDANCE_EMAIL_TRIGGER_HOUR)
    .create();
  Logger.log(`Attendance threshold trigger set for ${ATTENDANCE_EMAIL_TRIGGER_DAY} at ${ATTENDANCE_EMAIL_TRIGGER_HOUR}:00.`);
}

// ===============================================================
// Admin Config endpoints
// ===============================================================

/** Rows for the Admin Config editor (all levels, incl. inactive). */
function readAttendanceThresholdsForAdmin_() {
  return readAllAttendanceLevels_(true).map(l => ({
    name: l.name,
    legalStatus: l.legalStatus,
    category: l.category,
    threshold: l.threshold,
    repeatEvery: l.repeatEvery || '',
    response: l.response,
    recipientEmails: l.recipients.join(', '),
    includeCounselor: l.includeCounselor,
    contacts: l.contacts,
    active: l.active
  }));
}

/**
 * Replaces the Attendance Thresholds list. ADMIN only.
 * Renaming a level resets its "already reported" history (the log is keyed by level name).
 * @returns {Array} the re-read list.
 */
function saveAttendanceThresholds(levels) {
  requireAdmin_();
  const list = Array.isArray(levels) ? levels : [];
  const seen = new Set();
  const rows = list.map((l, idx) => {
    const label = ' (row ' + (idx + 1) + ')';
    const name = requireField_(l && l.name, 'Level name' + label);
    if (seen.has(name.toLowerCase())) throw new Error('Duplicate level name: ' + name);
    seen.add(name.toLowerCase());
    const category = requireField_(l.category, 'Category' + label).toUpperCase();
    if (!ATTENDANCE_CATEGORIES[category]) {
      throw new Error('Invalid category "' + category + '". Must be one of: ' + Object.keys(ATTENDANCE_CATEGORIES).join(', '));
    }
    const threshold = toPositiveInt_(l.threshold);
    if (!threshold) throw new Error('Threshold must be a whole number of periods greater than 0' + label);
    const repeatRaw = cellToString_(l.repeatEvery);
    const repeatEvery = repeatRaw === '' ? '' : toPositiveInt_(repeatRaw);
    if (repeatEvery === 0) throw new Error('Repeat Every must be blank or a whole number greater than 0' + label);
    const emails = parseEmailList_(l.recipientEmails);
    emails.forEach(e => { if (!isValidEmail_(e)) throw new Error('Invalid recipient email: ' + e); });
    return [
      name, cellToString_(l.legalStatus), category, threshold, repeatEvery, cellToString_(l.response),
      emails.join(', '), l.includeCounselor === true, cellToString_(l.contacts), l.active !== false
    ];
  });
  return withLock_(() => {
    const sheet = getSheetOrNull_(ATTENDANCE_THRESHOLDS_SHEET) || createAttendanceThresholdsSheet_();
    overwriteColumns_(sheet, 1, ATTENDANCE_THRESHOLD_HEADERS.length, rows);
    return readAttendanceThresholdsForAdmin_();
  });
}

// ===============================================================
// Dashboard ("Attendance Tiers" tab)
// ===============================================================

/**
 * Payload for the Attendance Tiers tab. Never contains recipient emails.
 * @param {Object[]} namedStudents  Students the user may see by name (admin: all; counselor: own alpha).
 * @param {Object[]} allStudents    All students, used only for anonymous school-wide counts.
 */
function buildAttendanceTiersPayload_(namedStudents, allStudents) {
  const levels = readActiveAttendanceLevels_(false);
  const toRow = e => ({
    studentName: e.student.studentName,
    grade: e.student.grade,
    id: e.student.id,
    category: e.category,
    levelName: e.level.name,
    steps: e.steps,
    periods: e.periods,
    attendanceLetters: cellToString_(e.student.attendanceLetters)
  });
  const schoolCounts = {};
  evaluateAttendanceThresholds_(allStudents, levels, new Map()).entries.forEach(e => {
    schoolCounts[e.level.name] = (schoolCounts[e.level.name] || 0) + 1;
  });
  return {
    periodsPerDay: PERIODS_PER_DAY,
    levels: levels.map(l => ({
      name: l.name, legalStatus: l.legalStatus, category: l.category, categoryLabel: l.categoryLabel,
      threshold: l.threshold, repeatEvery: l.repeatEvery, response: l.response
    })),
    rows: evaluateAttendanceThresholds_(namedStudents, levels, new Map()).entries.map(toRow),
    schoolCounts: schoolCounts
  };
}
