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
 *  - Each recipient gets ONE email per run: an "at a glance" summary, then one table per level listing
 *    everyone currently at it, with newly reached students badged NEW and listed first.
 *    A student only appears under their HIGHEST level per category.
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
// fieldLabels (parallel to fields) are the email column headings for that category.
const ATTENDANCE_CATEGORIES = {
  TARDY:   { label: 'Tardy',                       fields: ['unexcusedTardies'],                      fieldLabels: ['Tardies'] },              // O
  TRUANT:  { label: 'Truant / Unresolved Absence', fields: ['unexcusedAbsences', 'truancyAbsences'], fieldLabels: ['Unexcused', 'Truancy'] }, // N + S
  ILLNESS: { label: 'Illness / Medical',           fields: ['medicalAbsences', 'illnessAbsences'],   fieldLabels: ['Medical', 'Illness'] }    // P + Q
};

// Row colors mirror the response chart (blank / yellow / orange / pink).
const ATTENDANCE_LEGAL_STATUS_COLORS = {
  'Continuing Truant': '#fff2cc',
  'Habitual Truant': '#f9cb9c',
  'Withdrawn': '#f4cccc'
};
const ATTENDANCE_DEFAULT_LEVEL_COLOR = '#f2f4f7';
// Darker accent of the same hue, used for the level's left border and status pill.
const ATTENDANCE_LEGAL_STATUS_ACCENTS = {
  'Continuing Truant': '#c99a06',
  'Habitual Truant': '#d9682b',
  'Withdrawn': '#c0392b'
};
const ATTENDANCE_DEFAULT_LEVEL_ACCENT = '#8a94a6';

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
// Email HTML (tables + inline styles only, for email-client compatibility)
// ===============================================================

const ATTENDANCE_EMAIL_FONT = 'font-family: Arial, Helvetica, sans-serif;';

function escapeAttendanceHtml_(value) {
  return cellToString_(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatAttendanceDays_(periods) {
  return (Math.round((periods / PERIODS_PER_DAY) * 10) / 10).toString();
}

function attendancePill_(text, background, color) {
  return `<span style="display: inline-block; padding: 2px 7px; border-radius: 9px; background-color: ${background}; color: ${color}; font-size: 10px; font-weight: bold; letter-spacing: 0.4px; vertical-align: middle; ${ATTENDANCE_EMAIL_FONT}">${text}</span>`;
}

/**
 * Merges a recipient's "new" and "current" entries into one group per level (sheet order).
 * Within a level, new students come first, then most periods first.
 * @returns {Array<{level: Object, rows: Array<{entry: Object, isNew: boolean}>, newCount: number}>}
 */
function groupAttendanceBucketByLevel_(bucket, levels) {
  return levels.map(level => {
    const rows = [];
    const seen = new Set();
    bucket.newEntries.filter(e => e.newLevel === level).forEach(e => { seen.add(e); rows.push({ entry: e, isNew: true }); });
    bucket.currentEntries.filter(e => e.level === level && !seen.has(e)).forEach(e => rows.push({ entry: e, isNew: false }));
    rows.sort((a, b) => (b.isNew - a.isNew) || (b.entry.periods - a.entry.periods) ||
      cellToString_(a.entry.student.studentName).localeCompare(cellToString_(b.entry.student.studentName)));
    return { level: level, rows: rows, newCount: rows.filter(r => r.isNew).length };
  }).filter(g => g.rows.length > 0);
}

/** "At a glance" table: one row per level with new / total counts. */
function buildAttendanceSummaryHtml_(groups) {
  const cell = `padding: 8px 12px; border-bottom: 1px solid #e6e9ef; font-size: 13px; color: #1f2937; ${ATTENDANCE_EMAIL_FONT}`;
  const th = `padding: 8px 12px; font-size: 10px; letter-spacing: 0.6px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e6e9ef; ${ATTENDANCE_EMAIL_FONT}`;
  const rows = groups.map(g => {
    const accent = ATTENDANCE_LEGAL_STATUS_ACCENTS[g.level.legalStatus] || ATTENDANCE_DEFAULT_LEVEL_ACCENT;
    return `
      <tr>
        <td style="${cell} border-left: 4px solid ${accent};"><strong>${escapeAttendanceHtml_(g.level.name)}</strong>${g.level.legalStatus ? `<br><span style="font-size: 11px; color: #6b7280;">${escapeAttendanceHtml_(g.level.legalStatus)}</span>` : ''}</td>
        <td style="${cell}">${escapeAttendanceHtml_(g.level.response)}</td>
        <td style="${cell} text-align: center; font-weight: bold; color: ${g.newCount ? '#2d3f89' : '#9ca3af'};">${g.newCount}</td>
        <td style="${cell} text-align: center;">${g.rows.length}</td>
      </tr>`;
  }).join('');
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #e6e9ef; border-radius: 6px;">
      <tr style="background-color: #f7f8fa;">
        <th style="${th} text-align: left;">Level</th>
        <th style="${th} text-align: left;">Response</th>
        <th style="${th} text-align: center;">New</th>
        <th style="${th} text-align: center;">Total</th>
      </tr>
      ${rows}
    </table>`;
}

/** One level: colored header block + student table showing only the columns that matter for it. */
function buildAttendanceLevelSectionHtml_(group) {
  const level = group.level;
  const category = ATTENDANCE_CATEGORIES[level.category];
  const tint = ATTENDANCE_LEGAL_STATUS_COLORS[level.legalStatus] || ATTENDANCE_DEFAULT_LEVEL_COLOR;
  const accent = ATTENDANCE_LEGAL_STATUS_ACCENTS[level.legalStatus] || ATTENDANCE_DEFAULT_LEVEL_ACCENT;

  const notesFor = r => {
    const notes = [];
    if (level.repeatEvery) notes.push('Reached ' + r.entry.steps + '&times;' + (r.isNew && r.entry.newSteps ? ' (+' + r.entry.newSteps + ')' : ''));
    if (r.isNew && r.entry.alsoCrossed.length) notes.push('Also crossed: ' + r.entry.alsoCrossed.map(escapeAttendanceHtml_).join(', '));
    return notes;
  };
  const showLetters = group.rows.some(r => cellToString_(r.entry.student.attendanceLetters));
  const showNotes = group.rows.some(r => notesFor(r).length);

  const th = `padding: 8px 10px; font-size: 10px; letter-spacing: 0.6px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e6e9ef; ${ATTENDANCE_EMAIL_FONT}`;
  const td = `padding: 8px 10px; border-bottom: 1px solid #eef0f4; font-size: 13px; color: #1f2937; ${ATTENDANCE_EMAIL_FONT}`;
  const num = value => {
    const n = Number(value) || 0;
    return `<td style="${td} text-align: center;${n ? '' : ' color: #c0c6d0;'}">${n}</td>`;
  };

  const headerCells = [
    `<th style="${th} text-align: left;">Student</th>`,
    `<th style="${th} text-align: center;">Grade</th>`,
    `<th style="${th} text-align: center;">ID</th>`
  ].concat(category.fieldLabels.map(label => `<th style="${th} text-align: center;">${escapeAttendanceHtml_(label)}</th>`))
   .concat([`<th style="${th} text-align: center;">Periods</th>`, `<th style="${th} text-align: center;">Days</th>`])
   .concat(showLetters ? [`<th style="${th} text-align: left;">Letters Sent</th>`] : [])
   .concat(showNotes ? [`<th style="${th} text-align: left;">Notes</th>`] : []);

  const bodyRows = group.rows.map((r, i) => {
    const s = r.entry.student;
    const newPill = r.isNew ? ' &nbsp;' + attendancePill_('NEW', '#2d3f89', '#ffffff') : '';
    return `
      <tr style="background-color: ${i % 2 ? '#fafbfc' : '#ffffff'};">
        <td style="${td} white-space: nowrap;"><strong>${escapeAttendanceHtml_(s.studentName)}</strong>${newPill}</td>
        <td style="${td} text-align: center;">${escapeAttendanceHtml_(s.grade)}</td>
        <td style="${td} text-align: center; color: #6b7280;">${escapeAttendanceHtml_(s.id)}</td>
        ${category.fields.map(f => num(s[f])).join('')}
        <td style="${td} text-align: center; font-weight: bold;">${r.entry.periods}</td>
        <td style="${td} text-align: center; font-weight: bold;">${formatAttendanceDays_(r.entry.periods)}</td>
        ${showLetters ? `<td style="${td} font-size: 12px; color: #4b5563;">${escapeAttendanceHtml_(s.attendanceLetters)}</td>` : ''}
        ${showNotes ? `<td style="${td} font-size: 12px; color: #4b5563;">${notesFor(r).join('<br>')}</td>` : ''}
      </tr>`;
  }).join('');

  const statusPill = level.legalStatus ? attendancePill_(escapeAttendanceHtml_(level.legalStatus).toUpperCase(), accent, '#ffffff') + '&nbsp; ' : '';
  const trigger = `${escapeAttendanceHtml_(category.label)} &middot; ${level.threshold} period${level.threshold === 1 ? '' : 's'}` +
    (level.threshold >= PERIODS_PER_DAY ? ` (${formatAttendanceDays_(level.threshold)} days)` : '') +
    (level.repeatEvery ? ` &middot; repeats every ${level.repeatEvery}` : '');

  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin: 0 0 22px 0; border: 1px solid #e6e9ef;">
      <tr><td colspan="${headerCells.length}" style="padding: 14px 16px; background-color: ${tint}; border-left: 5px solid ${accent}; ${ATTENDANCE_EMAIL_FONT}">
        <div style="font-size: 16px; font-weight: bold; color: #111827;">${statusPill}${escapeAttendanceHtml_(level.name)}</div>
        <div style="font-size: 13px; color: #1f2937; margin-top: 4px;">Response: <strong>${escapeAttendanceHtml_(level.response)}</strong></div>
        <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">${trigger} &middot; ${group.rows.length} student${group.rows.length === 1 ? '' : 's'}${group.newCount ? ` &middot; <strong style="color: #2d3f89;">${group.newCount} new</strong>` : ''}</div>
      </td></tr>
      <tr style="background-color: #f7f8fa;">${headerCells.join('')}</tr>
      ${bodyRows}
    </table>`;
}

function buildAttendanceEmailHtml_(bucket, levels, previewNote) {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "EEEE, MMMM d, yyyy");
  const groups = groupAttendanceBucketByLevel_(bucket, levels);
  const totalNew = groups.reduce((sum, g) => sum + g.newCount, 0);
  const preview = previewNote
    ? `<tr><td style="padding: 12px 32px; background-color: #fff3cd; color: #5c4400; font-size: 13px; ${ATTENDANCE_EMAIL_FONT}">${previewNote}</td></tr>`
    : '';
  const newLine = totalNew
    ? `<strong style="color: #2d3f89;">${totalNew} new</strong> since the last report (marked ${attendancePill_('NEW', '#2d3f89', '#ffffff')}, listed first in each level).`
    : 'No students reached a new level since the last report.';

  return `
    <!DOCTYPE html><html><body style="margin: 0; padding: 0; background-color: #eef1f6; ${ATTENDANCE_EMAIL_FONT}">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eef1f6;"><tr><td align="center" style="padding: 24px 12px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 860px; border-collapse: collapse; background-color: #ffffff;">
          <tr><td style="padding: 28px 32px; background-color: #2d3f89; color: #ffffff; ${ATTENDANCE_EMAIL_FONT}">
            <div style="font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #c7d0f0;">OHS Academics &amp; Attendance Hub</div>
            <div style="font-size: 24px; font-weight: bold; margin-top: 6px;">Weekly Attendance Threshold Report</div>
            <div style="font-size: 13px; color: #dbe1f5; margin-top: 6px;">${date}</div>
          </td></tr>
          ${preview}
          <tr><td style="padding: 24px 32px 8px 32px; color: #1f2937; font-size: 14px; line-height: 1.5; ${ATTENDANCE_EMAIL_FONT}">
            <p style="margin: 0 0 8px 0;">Hello,</p>
            <p style="margin: 0 0 8px 0;">These students have reached attendance thresholds that call for a response from you. ${newLine}</p>
            <p style="margin: 0; font-size: 12px; color: #6b7280;">Counts are class periods (${PERIODS_PER_DAY} periods = 1 day). Each student appears under their highest level per category.</p>
          </td></tr>
          <tr><td style="padding: 16px 32px 8px 32px; ${ATTENDANCE_EMAIL_FONT}">
            <div style="font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 8px;">At a glance</div>
            ${buildAttendanceSummaryHtml_(groups)}
          </td></tr>
          <tr><td style="padding: 20px 32px 12px 32px; ${ATTENDANCE_EMAIL_FONT}">
            ${groups.map(buildAttendanceLevelSectionHtml_).join('')}
          </td></tr>
          <tr><td style="padding: 18px 32px; background-color: #f7f8fa; border-top: 1px solid #e6e9ef; text-align: center; font-size: 11px; color: #6b7280; line-height: 1.5; ${ATTENDANCE_EMAIL_FONT}">
            Automated notification from the OHS Academics &amp; Attendance Hub. Please do not reply to this email.<br>
            Thresholds and recipients are managed in Admin Config &rarr; Attendance Thresholds.
          </td></tr>
        </table>
      </td></tr></table>
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
