/**
 * AdminConfig.js
 * Server-side endpoints for the in-app "Admin Config" page.
 *
 * Every endpoint that is callable from the client (no trailing underscore) first calls
 * requireAdmin_() (defined in Code.js) so access is enforced on the server, independent of
 * the client-side tab hiding. Writes are serialized with a script lock.
 *
 * Sheet layout notes:
 *  - "Admin Settings" holds FOUR independent side-by-side lists. Rows do NOT correlate across
 *    blocks, so each block is read/written using only its own columns. Saving a block overwrites
 *    just that block's columns (padding with blanks to clear removed rows), leaving the other
 *    three blocks untouched.
 *      Admins         A,B        (Name, Email)
 *      Case Managers  C,D,E      (First, Last, Email)
 *      Counselors     F,G,H,I    (Name, Email, Alpha Start, Alpha End)
 *      Tier 2         J,K,L      (Name, Intervention, Email)
 *  - "Staff Roles"   A,B,C      (Name, Email, Role)
 *  - "✎Activity Advisors & Coaches" — edit existing rows only (A=Activity, B=Students are read-only).
 *      Editable: C=PrimaryName, D=PrimaryEmail, E=SecondaryName, F=SecondaryEmail,
 *                G=OtherNames, H=OtherEmails, I=SendNotification (checkbox). J=Timestamp is never written here.
 */

const ADMIN_SETTINGS_SHEET = "Admin Settings";
const STAFF_ROLES_SHEET = "Staff Roles";
// Exact sheet name including the leading ✎ (pencil) character — do not normalize.
const ACTIVITY_ADVISORS_SHEET = "✎Activity Advisors & Coaches";
const STAFF_ROLE_OPTIONS = ['ADMIN', 'TEACHER', 'COUNSELOR'];

// ===============================================================
// Small shared helpers (private)
// ===============================================================

/** @returns {Sheet|null} */
function getSheetOrNull_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

/** @returns {Sheet} the sheet, or throws if it does not exist. */
function getConfigSheetOrThrow_(name) {
  const sheet = getSheetOrNull_(name);
  if (!sheet) throw new Error('Required sheet not found: ' + name);
  return sheet;
}

/** True if `value` looks like a valid email address. */
function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value == null ? '' : value).trim());
}

/** Returns the trimmed string, or throws if it is blank. */
function requireField_(value, label) {
  const s = value == null ? '' : String(value).trim();
  if (s === '') throw new Error(label + ' is required.');
  return s;
}

/** True if any cell in the row has content. */
function rowHasContent_(row) {
  return row.some(cell => cell !== '' && cell !== null && cell !== undefined && String(cell).trim() !== '');
}

/**
 * Reads `width` columns starting at `startCol` from row 2 to the sheet's last row,
 * drops fully-empty rows, and maps each remaining row with `mapper`.
 */
function readColumns_(sheet, startCol, width, mapper) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, startCol, lastRow - 1, width).getValues();
  return values.filter(rowHasContent_).map(mapper);
}

/**
 * Overwrites `width` columns starting at `startCol` from row 2 with `rows`, padding with
 * blank rows up to the sheet's current last data row so that removed entries are cleared.
 * Only the targeted columns are written, so sibling column blocks are never disturbed.
 */
function overwriteColumns_(sheet, startCol, width, rows) {
  const lastRow = sheet.getLastRow();
  const existingDataRows = Math.max(0, lastRow - 1);
  const clearCount = Math.max(existingDataRows, rows.length);
  if (clearCount === 0) return; // nothing to write and nothing to clear
  const out = [];
  for (let i = 0; i < clearCount; i++) {
    out.push(i < rows.length ? rows[i] : new Array(width).fill(''));
  }
  sheet.getRange(2, startCol, clearCount, width).setValues(out);
}

/** Runs `fn` while holding the script lock; throws if the lock can't be acquired. */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Another save is in progress, please retry.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ===============================================================
// Admin Settings — per-block readers (private)
// ===============================================================

function readAdmins_() {
  const sheet = getSheetOrNull_(ADMIN_SETTINGS_SHEET);
  if (!sheet) return [];
  return readColumns_(sheet, 1, 2, r => ({
    name: String(r[0]).trim(),
    email: String(r[1]).trim()
  }));
}

function readCaseManagers_() {
  const sheet = getSheetOrNull_(ADMIN_SETTINGS_SHEET);
  if (!sheet) return [];
  return readColumns_(sheet, 3, 3, r => ({
    first: String(r[0]).trim(),
    last: String(r[1]).trim(),
    email: String(r[2]).trim()
  }));
}

function readCounselors_() {
  const sheet = getSheetOrNull_(ADMIN_SETTINGS_SHEET);
  if (!sheet) return [];
  return readColumns_(sheet, 6, 4, r => ({
    name: String(r[0]).trim(),
    email: String(r[1]).trim(),
    alphaStart: String(r[2]).trim(),
    alphaEnd: String(r[3]).trim()
  }));
}

function readTier2_() {
  const sheet = getSheetOrNull_(ADMIN_SETTINGS_SHEET);
  if (!sheet) return [];
  return readColumns_(sheet, 10, 3, r => ({
    name: String(r[0]).trim(),
    intervention: String(r[1]).trim(),
    email: String(r[2]).trim()
  }));
}

function readStaffRoles_() {
  const sheet = getSheetOrNull_(STAFF_ROLES_SHEET);
  if (!sheet) return [];
  return readColumns_(sheet, 1, 3, r => ({
    name: String(r[0]).trim(),
    email: String(r[1]).trim(),
    role: String(r[2]).trim().toUpperCase()
  }));
}

function readActivityAdvisors_() {
  const sheet = getSheetOrNull_(ACTIVITY_ADVISORS_SHEET);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  const out = [];
  values.forEach((r, idx) => {
    const activity = String(r[0] == null ? '' : r[0]).trim();
    if (activity === '') return; // skip rows that are not real activities
    out.push({
      row: idx + 2, // actual sheet row number
      activity: activity,
      students: r[1] == null ? '' : String(r[1]),
      primaryName: String(r[2]).trim(),
      primaryEmail: String(r[3]).trim(),
      secondaryName: String(r[4]).trim(),
      secondaryEmail: String(r[5]).trim(),
      otherNames: String(r[6]).trim(),
      otherEmails: String(r[7]).trim(),
      sendNotification: r[8] === true
    });
  });
  return out;
}

// ===============================================================
// Public endpoints (callable via google.script.run)
// ===============================================================

/**
 * Returns all config data needed to render the Admin Config page. ADMIN only.
 * Reads are tolerant of missing/empty sheets (return empty arrays) so the page still loads.
 */
function getAdminConfigData() {
  requireAdmin_();
  return {
    appSettings: { automatedEmailsEnabled: areAutomatedEmailsEnabled() },
    adminSettings: {
      admins: readAdmins_(),
      caseManagers: readCaseManagers_(),
      counselors: readCounselors_(),
      tier2: readTier2_()
    },
    staffRoles: readStaffRoles_(),
    activityAdvisors: readActivityAdvisors_(),
    roleOptions: STAFF_ROLE_OPTIONS.slice()
  };
}

/**
 * Saves the Admins block (columns A,B). ADMIN only.
 * @param {Array<{name:string,email:string}>} admins
 * @returns {Array} the re-read admins list.
 */
function saveAdmins(admins) {
  requireAdmin_();
  const list = Array.isArray(admins) ? admins : [];
  const rows = list.map((a, idx) => {
    const name = requireField_(a && a.name, 'Admin name (row ' + (idx + 1) + ')');
    const email = requireField_(a && a.email, 'Admin email (row ' + (idx + 1) + ')');
    if (!isValidEmail_(email)) throw new Error('Invalid admin email: ' + email);
    return [name, email];
  });
  return withLock_(() => {
    const sheet = getConfigSheetOrThrow_(ADMIN_SETTINGS_SHEET);
    overwriteColumns_(sheet, 1, 2, rows);
    return readAdmins_();
  });
}

/**
 * Saves the Case Managers block (columns C,D,E). ADMIN only.
 * @param {Array<{first:string,last:string,email:string}>} caseManagers
 * @returns {Array} the re-read case managers list.
 */
function saveCaseManagers(caseManagers) {
  requireAdmin_();
  const list = Array.isArray(caseManagers) ? caseManagers : [];
  const rows = list.map((c, idx) => {
    const first = c && c.first ? String(c.first).trim() : '';
    const last = requireField_(c && c.last, 'Case Manager last name (row ' + (idx + 1) + ')');
    const email = requireField_(c && c.email, 'Case Manager email (row ' + (idx + 1) + ')');
    if (!isValidEmail_(email)) throw new Error('Invalid case manager email: ' + email);
    return [first, last, email];
  });
  return withLock_(() => {
    const sheet = getConfigSheetOrThrow_(ADMIN_SETTINGS_SHEET);
    overwriteColumns_(sheet, 3, 3, rows);
    return readCaseManagers_();
  });
}

/**
 * Saves the Counselors block (columns F,G,H,I). ADMIN only.
 * Note: getUserRole derives a counselor's effective alpha end from the next counselor's start,
 * so Alpha End (I) is stored for transparency but is not what the role logic reads.
 * @param {Array<{name:string,email:string,alphaStart:string,alphaEnd:string}>} counselors
 * @returns {Array} the re-read counselors list.
 */
function saveCounselors(counselors) {
  requireAdmin_();
  const list = Array.isArray(counselors) ? counselors : [];
  const rows = list.map((c, idx) => {
    const name = requireField_(c && c.name, 'Counselor name (row ' + (idx + 1) + ')');
    const email = requireField_(c && c.email, 'Counselor email (row ' + (idx + 1) + ')');
    if (!isValidEmail_(email)) throw new Error('Invalid counselor email: ' + email);
    const alphaStart = requireField_(c && c.alphaStart, 'Counselor alpha start (row ' + (idx + 1) + ')');
    const alphaEnd = c && c.alphaEnd ? String(c.alphaEnd).trim() : '';
    return [name, email, alphaStart, alphaEnd];
  });
  return withLock_(() => {
    const sheet = getConfigSheetOrThrow_(ADMIN_SETTINGS_SHEET);
    overwriteColumns_(sheet, 6, 4, rows);
    return readCounselors_();
  });
}

/**
 * Saves the Tier 2 Instructors/Advisors block (columns J,K,L). ADMIN only.
 * @param {Array<{name:string,intervention:string,email:string}>} tier2
 * @returns {Array} the re-read Tier 2 list.
 */
function saveTier2Instructors(tier2) {
  requireAdmin_();
  const list = Array.isArray(tier2) ? tier2 : [];
  const rows = list.map((t, idx) => {
    const name = requireField_(t && t.name, 'Tier 2 instructor name (row ' + (idx + 1) + ')');
    const intervention = t && t.intervention ? String(t.intervention).trim() : '';
    const email = requireField_(t && t.email, 'Tier 2 instructor email (row ' + (idx + 1) + ')');
    if (!isValidEmail_(email)) throw new Error('Invalid Tier 2 instructor email: ' + email);
    return [name, intervention, email];
  });
  return withLock_(() => {
    const sheet = getConfigSheetOrThrow_(ADMIN_SETTINGS_SHEET);
    overwriteColumns_(sheet, 10, 3, rows);
    return readTier2_();
  });
}

/**
 * Replaces the Staff Roles list (columns A,B,C). ADMIN only.
 * Guards against self-lockout: the saved list must keep at least one ADMIN, and the calling
 * admin must remain an ADMIN.
 * @param {Array<{name:string,email:string,role:string}>} staffRoles
 * @returns {Array} the re-read staff roles list.
 */
function saveStaffRoles(staffRoles) {
  const admin = requireAdmin_();
  const list = Array.isArray(staffRoles) ? staffRoles : [];
  const rows = list.map((s, idx) => {
    const name = requireField_(s && s.name, 'Staff name (row ' + (idx + 1) + ')');
    const email = requireField_(s && s.email, 'Staff email (row ' + (idx + 1) + ')');
    if (!isValidEmail_(email)) throw new Error('Invalid staff email: ' + email);
    const role = requireField_(s && s.role, 'Staff role (row ' + (idx + 1) + ')').toUpperCase();
    if (STAFF_ROLE_OPTIONS.indexOf(role) === -1) {
      throw new Error('Invalid role "' + role + '". Must be one of: ' + STAFF_ROLE_OPTIONS.join(', '));
    }
    return [name, email, role];
  });

  const adminRows = rows.filter(r => r[2] === 'ADMIN');
  if (adminRows.length === 0) {
    throw new Error('You must keep at least one ADMIN in Staff Roles.');
  }
  const selfEmail = String(admin.email).toLowerCase().trim();
  const selfStillAdmin = adminRows.some(r => String(r[1]).toLowerCase().trim() === selfEmail);
  if (!selfStillAdmin) {
    throw new Error('You cannot remove your own ADMIN access (' + admin.email + ').');
  }

  return withLock_(() => {
    const sheet = getConfigSheetOrThrow_(STAFF_ROLES_SHEET);
    overwriteColumns_(sheet, 1, 3, rows);
    return readStaffRoles_();
  });
}

/**
 * Updates contact fields (C..I) on existing Activity Advisors & Coaches rows. ADMIN only.
 * Does not add/remove rows and never writes A (Activity), B (Students), or J (Timestamp).
 * @param {Array<{row:number,primaryName:string,primaryEmail:string,secondaryName:string,
 *   secondaryEmail:string,otherNames:string,otherEmails:string,sendNotification:boolean}>} edits
 * @returns {Array} the re-read advisor list.
 */
function saveActivityAdvisors(edits) {
  requireAdmin_();
  const list = Array.isArray(edits) ? edits : [];
  return withLock_(() => {
    const sheet = getConfigSheetOrThrow_(ACTIVITY_ADVISORS_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // Read C:I once (columns 3..9, width 7); matrix row 0 corresponds to sheet row 2.
    const range = sheet.getRange(2, 3, lastRow - 1, 7);
    const matrix = range.getValues();

    list.forEach(edit => {
      const rowNum = Number(edit && edit.row);
      if (!rowNum || rowNum < 2 || rowNum > lastRow) {
        throw new Error('Invalid activity advisor row: ' + (edit && edit.row));
      }
      const i = rowNum - 2;

      const primaryEmail = edit.primaryEmail ? String(edit.primaryEmail).trim() : '';
      const secondaryEmail = edit.secondaryEmail ? String(edit.secondaryEmail).trim() : '';
      const otherEmails = edit.otherEmails ? String(edit.otherEmails).trim() : '';
      if (primaryEmail && !isValidEmail_(primaryEmail)) throw new Error('Invalid primary email: ' + primaryEmail);
      if (secondaryEmail && !isValidEmail_(secondaryEmail)) throw new Error('Invalid secondary email: ' + secondaryEmail);
      if (otherEmails) {
        otherEmails.split(',').map(e => e.trim()).filter(String).forEach(e => {
          if (!isValidEmail_(e)) throw new Error('Invalid email in "other emails": ' + e);
        });
      }

      // matrix columns: 0=C 1=D 2=E 3=F 4=G 5=H 6=I
      matrix[i][0] = edit.primaryName ? String(edit.primaryName).trim() : '';
      matrix[i][1] = primaryEmail;
      matrix[i][2] = edit.secondaryName ? String(edit.secondaryName).trim() : '';
      matrix[i][3] = secondaryEmail;
      matrix[i][4] = edit.otherNames ? String(edit.otherNames).trim() : '';
      matrix[i][5] = otherEmails;
      matrix[i][6] = edit.sendNotification === true; // keep as a real boolean (checkbox)
    });

    range.setValues(matrix);
    return readActivityAdvisors_();
  });
}
