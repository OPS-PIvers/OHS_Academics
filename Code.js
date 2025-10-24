/**
 * @OnlyCurrentDoc
 *
 * The above comment directs App Script to limit the scope of file access for this script
 * to the Spreadsheet this script is container-bound to. It is required for publishing
 * this script as an add-on.
 */

// ===============================================================
// NEW CODE FOR TIER 2 INSTRUCTOR SUMMARY EMAILS
// ===============================================================

/**
 * Scans student data and sends a summary email to each Tier 2 instructor with their assigned students.
 * This function is designed to be run by a time-based trigger.
 */
function sendTier2InstructorEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const adminSheet = ss.getSheetByName("Admin Settings");
  const hubSheet = ss.getSheetByName("⭐Academics & Attendance Hub");

  if (!adminSheet || !hubSheet) {
    Logger.log("Error: Could not find one of the required sheets ('Admin Settings' or '⭐Academics & Attendance Hub').");
    return;
  }

  // 1. Get Tier 2 Instructor Data from Admin Settings sheet
  let instructorData = [];
  try {
    const adminLastRow = adminSheet.getLastRow();
    if (adminLastRow < 2) {
      Logger.log("No instructor data found in 'Admin Settings' sheet.");
      return;
    }
    // Assumes Tier 2 Instructor Name (J), Email (L)
    const instructorRange = adminSheet.getRange("J2:L" + adminLastRow).getValues();
    
    instructorData = instructorRange.map(row => {
      const fullName = row[0];
      const email = row[2];
      if (fullName && email) {
        const nameParts = fullName.trim().split(' ');
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
        return {
          fullName: fullName.trim(),
          lastName: lastName.trim().toLowerCase(),
          email: email.trim(),
          students: [] // Initialize an empty array to hold students
        };
      }
      return null;
    }).filter(Boolean); // Filter out any null entries from empty rows

    if (instructorData.length === 0) {
      Logger.log("No valid Tier 2 instructor entries found.");
      return;
    }
  } catch (e) {
    Logger.log(`Error reading Tier 2 instructor data: ${e.toString()}`);
    return;
  }

  // 2. Get all student data from the Hub
  const studentData = [];
  try {
    const hubLastRow = hubSheet.getLastRow();
    if (hubLastRow >= 2) {
      // Get columns: Student Name [B], Grade [C], Unserved Detention [G], Failing Class(es) [L], Tier 2 Instructor [AB]
      const studentRange = hubSheet.getRange("B2:AB" + hubLastRow).getValues();
      studentRange.forEach(row => {
        const studentName = row[0]; // Index 0 of range -> Col B
        const tier2Instructor = row[26]; // Index 26 -> Col AB

        // Only include students who have an assigned Tier 2 instructor
        if (studentName && tier2Instructor) {
          studentData.push({
            name: studentName,
            grade: row[1],             // Index 1 -> Col C
            detention: row[5] || '0',  // Index 5 -> Col G
            failing: row[10] || '',   // Index 10 -> Col L
            instructor: tier2Instructor.trim()
          });
        }
      });
    }
  } catch (e) {
    Logger.log(`Error reading student data: ${e.toString()}`);
    return;
  }

  // 3. Get Spartan Hour Data
  const spartanHourSheet = ss.getSheetByName("Spartan Hour Intervention");
  const spartanHourData = new Map();
  if (spartanHourSheet) {
    const lastRow = spartanHourSheet.getLastRow();
    if (lastRow >= 2) {
      // Columns: C (Student Name), H (Requests), P (Skipped), Q (Signups)
      const range = spartanHourSheet.getRange("C2:Q" + lastRow).getValues();
      const today = new Date();
      const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0); // Normalize to the beginning of the day for an accurate 7-day window

      const processColumn = (columnData) => {
        if (!columnData) return '';
        const delimiters = /[\n,]/;
        return columnData.toString().split(delimiters).map(entry => {
          entry = entry.trim();
          if (!entry) return null;
          const match = entry.match(/\((\d{1,2}\/\d{1,2})\)/);
          if (match && match[1]) {
            const dateParts = match[1].split('/');
            const month = parseInt(dateParts[0], 10) - 1; // JavaScript months are 0-indexed
            const day = parseInt(dateParts[1], 10);
            const date = new Date(today.getFullYear(), month, day);

            if (date > today) {
              date.setFullYear(date.getFullYear() - 1);
            }
            if (date >= sevenDaysAgo && date <= today) {
              return entry;
            }
          }
          return null;
        }).filter(Boolean).join('<br>');
      };

      range.forEach(row => {
        const studentName = row[0]; // Col C
        if (!studentName) return;

        const requests = row[5]; // Col H
        const skipped = row[13]; // Col P
        const signups = row[14]; // Col Q

        const recentRequests = processColumn(requests);
        const recentSkipped = processColumn(skipped);
        const recentSignups = processColumn(signups);

        if (recentRequests || recentSkipped || recentSignups) {
          const key = studentName.trim().toLowerCase();
          if (!spartanHourData.has(key)) {
            spartanHourData.set(key, { requests: '', skipped: '', signups: '' });
          }
          const existingData = spartanHourData.get(key);
          if (recentRequests) {
            existingData.requests = existingData.requests ? `${existingData.requests}<br>${recentRequests}` : recentRequests;
          }
          if (recentSkipped) {
            existingData.skipped = existingData.skipped ? `${existingData.skipped}<br>${recentSkipped}` : recentSkipped;
          }
          if (recentSignups) {
            existingData.signups = existingData.signups ? `${existingData.signups}<br>${recentSignups}` : recentSignups;
          }
        }
      });
    }
  }

  // 4. Get Absence Data
  const absenceSheet = ss.getSheetByName("Absences (total)");
  const absenceData = new Map();
  if (absenceSheet) {
    const lastRow = absenceSheet.getLastRow();
    if (lastRow >= 2) {
      // Columns: A (Student Name), C-K (Periods)
      const range = absenceSheet.getRange("A2:K" + lastRow).getValues();
      range.forEach(row => {
        const studentName = row[0];
        if (studentName) {
          const key = studentName.trim().toLowerCase();
          absenceData.set(key, {
            p0: row[2] || 0,
            p1: row[3] || 0,
            p2: row[4] || 0,
            p3: row[5] || 0,
            p4: row[6] || 0,
            p5: row[7] || 0,
            p6: row[8] || 0,
            p7: row[9] || 0,
            sphr: row[10] || 0,
          });
        }
      });
    }
  }

  // 5. Assign students to their respective instructors
  studentData.forEach(student => {
    const instructorLastName = student.instructor.trim().toLowerCase();
    const instructor = instructorData.find(inst => inst.lastName === instructorLastName);
    if (instructor) {
      instructor.students.push(student);
    }
  });

  // 6. Generate and send an email for each instructor
  instructorData.forEach(instructor => {
    if (instructor.students.length === 0) {
      Logger.log(`No students to report for ${instructor.name}. Skipping email.`);
      return;
    }

    instructor.students.sort((a, b) => a.name.localeCompare(b.name));

    const studentCardsHtml = instructor.students.map(student => {
      const spartanData = spartanHourData.get(student.name.trim().toLowerCase()) || { requests: 0, skipped: 0, signups: 0 };
      const studentAbsenceData = absenceData.get(student.name.trim().toLowerCase()) || { p0: 0, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, sphr: 0 };

      return `
        <div style="border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; padding: 16px; background-color: #f9f9f9;">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 18px; color: #333;">${student.name}</h3>
          <p style="margin: 0 0 8px;"><strong>Grade:</strong> ${student.grade}</p>
          <p style="margin: 0 0 8px;"><strong>Failing Classes:</strong> ${student.failing ? student.failing.replace(/\n/g, ', ') : 'None'}</p>
          <p style="margin: 0 0 16px;"><strong>Unserved Detention:</strong> ${student.detention} hours</p>
          
          <h4 style="margin-top: 0; margin-bottom: 8px; font-size: 16px; color: #555;">Spartan Hour Summary (Last 7 Days)</h4>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Requests:</strong> ${spartanData.requests}</li>
            <li><strong>Sign-ups:</strong> ${spartanData.signups}</li>
            <li><strong>Skipped Sessions:</strong> ${spartanData.skipped}</li>
          </ul>

          <h4 style="margin-top: 16px; margin-bottom: 8px; font-size: 16px; color: #555;">Absences by Period</h4>
          <table style="width: 100%; border-collapse: collapse; text-align: center;">
            <thead>
              <tr style="background-color: #eee;">
                <th style="padding: 4px; border: 1px solid #ddd;">P0</th>
                <th style="padding: 4px; border: 1px solid #ddd;">P1</th>
                <th style="padding: 4px; border: 1px solid #ddd;">P2</th>
                <th style="padding: 4px; border: 1px solid #ddd;">P3</th>
                <th style="padding: 4px; border: 1px solid #ddd;">P4</th>
                <th style="padding: 4px; border: 1px solid #ddd;">P5</th>
                <th style="padding: 4px; border: 1px solid #ddd;">P6</th>
                <th style="padding: 4px; border: 1px solid #ddd;">P7</th>
                <th style="padding: 4px; border: 1px solid #ddd;">SpHr</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 4px; border: 1px solid #ddd;">${studentAbsenceData.p0}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${studentAbsenceData.p1}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${studentAbsenceData.p2}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${studentAbsenceData.p3}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${studentAbsenceData.p4}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${studentAbsenceData.p5}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${studentAbsenceData.p6}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${studentAbsenceData.p7}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${studentAbsenceData.sphr}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const timestampForSubject = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy");
    const instructorFirstName = instructor.fullName.split(' ')[0];

    const subject = `Weekly Student Workload Summary - ${timestampForSubject}`;
    const htmlBody = `
      <!DOCTYPE html><html><body style="margin: 0; padding: 20px; background-color: #f0f0f0; font-family: Arial, sans-serif;">
        <div style="max-width: 800px; margin: auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h1 style="font-size: 24px; margin: 0 0 20px; color: #4356a0;">Weekly Student Summary</h1>
          <p style="margin: 0 0 20px; font-size: 16px; color: #333;">Hi ${instructorFirstName},</p>
          <p style="margin: 0 0 30px; font-size: 16px; color: #333;">Here is the weekly summary for the students on your workload:</p>
          ${studentCardsHtml}
          <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d; text-align: center;">This is an automated notification from the OHS Academics & Attendance Hub.</p>
        </div>
      </body></html>
    `;

    try {
      MailApp.sendEmail({
        to: instructor.email,
        subject: subject,
        htmlBody: htmlBody
      });
      Logger.log(`Successfully sent summary email to ${instructor.name} at ${instructor.email}`);
    } catch (e) {
      Logger.log(`Failed to send email to ${instructor.name}. Error: ${e.toString()}`);
    }
  });
}

// ===============================================================
// NEW CODE FOR COUNSELOR SUMMARY EMAILS
// ===============================================================

/**
 * Scans student data and sends a summary email to each counselor based on their assigned last-name alpha range.
 * This function is designed to be run by a time-based trigger.
 */
function sendCounselorSummaryEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const adminSheet = ss.getSheetByName("Admin Settings");
  const hubSheet = ss.getSheetByName("⭐Academics & Attendance Hub");

  if (!adminSheet || !hubSheet) {
    Logger.log("Error: Could not find one of the required sheets ('Admin Settings' or '⭐Academics & Attendance Hub').");
    return;
  }

  // 1. Get Counselor Data from Admin Settings sheet
  let counselorData = [];
  try {
    const adminLastRow = adminSheet.getLastRow();
    if (adminLastRow < 2) {
      Logger.log("No counselor data found in 'Admin Settings' sheet.");
      return;
    }
    // Assumes Counselor Name (F), Email (G), Alpha Start (H)
    const counselorRange = adminSheet.getRange("F2:H" + adminLastRow).getValues();
    
    counselorData = counselorRange.map(row => {
      const name = row[0];
      const email = row[1];
      const alphaStart = row[2];
      if (name && email && alphaStart) {
        return {
          name: name.trim(),
          email: email.trim(),
          alphaStart: alphaStart.toString().trim(),
          students: [] // Initialize an empty array to hold students
        };
      }
      return null;
    }).filter(Boolean); // Filter out any null entries from empty rows

    if (counselorData.length === 0) {
      Logger.log("No valid counselor entries found.");
      return;
    }

    // Sort counselors by their alpha start range. This is crucial for correctly assigning students.
    counselorData.sort((a, b) => a.alphaStart.localeCompare(b.alphaStart));

  } catch (e) {
    Logger.log(`Error reading counselor data: ${e.toString()}`);
    return;
  }

  // 2. Get all student data from the Hub, filtering for academic concern
  const studentData = [];
  try {
    const hubLastRow = hubSheet.getLastRow();
    if (hubLastRow >= 2) {
      // Get columns: Student Name [B], Grade [C], Unserved Detention [G], Failing Class(es) [L], Total Absences [S]
      const studentRange = hubSheet.getRange("B2:S" + hubLastRow).getValues();
      studentRange.forEach(row => {
        const studentName = row[0]; // Index 0 of range -> Col B
        const failingClasses = row[10]; // Index 10 -> Col L

        // Only include students who are failing at least one class
        if (studentName && failingClasses) {
          studentData.push({
            name: studentName,
            grade: row[1],             // Index 1 -> Col C
            detention: row[5] || '0',  // Index 5 -> Col G
            failing: failingClasses,   // This will have a value
            absences: row[17] || '0'   // Index 17 -> Col S
          });
        }
      });
    }
  } catch (e) {
    Logger.log(`Error reading student data: ${e.toString()}`);
    return;
  }

  // 3. Get Spartan Hour Data
  const spartanHourSheet = ss.getSheetByName("Spartan Hour Intervention");
  const spartanHourData = new Map();
  if (spartanHourSheet) {
    const lastRow = spartanHourSheet.getLastRow();
    if (lastRow >= 2) {
      // Columns: C (Student Name), H (Requests), P (Skipped)
      const range = spartanHourSheet.getRange("B2:P" + lastRow).getValues();
      const today = new Date();
      const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0); // Normalize to the beginning of the day for an accurate 7-day window

      const processColumn = (columnData) => {
        if (!columnData) return '';
        const delimiters = /[\n,]/;
        return columnData.toString().split(delimiters).map(entry => {
          entry = entry.trim();
          if (!entry) return null;
          const match = entry.match(/\((\d{1,2}\/\d{1,2})\)/);
          if (match && match[1]) {
            const dateParts = match[1].split('/');
            const month = parseInt(dateParts[0], 10) - 1; // JavaScript months are 0-indexed
            const day = parseInt(dateParts[1], 10);
            const date = new Date(today.getFullYear(), month, day);

            if (date > today) {
              date.setFullYear(date.getFullYear() - 1);
            }
            if (date >= sevenDaysAgo && date <= today) {
              return entry;
            }
          }
          return null;
        }).filter(Boolean).join('<br>');
      };

      range.forEach(row => {
        const studentName = row[1]; // Col C (index 1 of a range starting at B)
        if (!studentName) return;

        const requests = row[6]; // Col H
        const skipped = row[14]; // Col P

        const recentRequests = processColumn(requests);
        const recentSkipped = processColumn(skipped);

        if (recentRequests || recentSkipped) {
          const key = studentName.trim().toLowerCase();
          if (!spartanHourData.has(key)) {
            spartanHourData.set(key, { requests: '', skipped: '' });
          }
          const existingData = spartanHourData.get(key);
          if (recentRequests) {
            existingData.requests = existingData.requests ? `${existingData.requests}<br>${recentRequests}` : recentRequests;
          }
          if (recentSkipped) {
            existingData.skipped = existingData.skipped ? `${existingData.skipped}<br>${recentSkipped}` : recentSkipped;
          }
        }
      });
    }
  }

  // 4. Assign students to their respective counselors
  studentData.forEach(student => {
    const lastName = student.name.split(',')[0].trim();
    if (!lastName) return;

    for (let i = 0; i < counselorData.length; i++) {
      const currentCounselor = counselorData[i];
      const nextCounselor = counselorData[i + 1];
      const isAfterCurrentStart = lastName.localeCompare(currentCounselor.alphaStart, 'en', { sensitivity: 'base' }) >= 0;

      if (isAfterCurrentStart) {
        if (nextCounselor) {
          const isBeforeNextStart = lastName.localeCompare(nextCounselor.alphaStart, 'en', { sensitivity: 'base' }) < 0;
          if (isBeforeNextStart) {
            currentCounselor.students.push(student);
            break;
          }
        } else {
          currentCounselor.students.push(student);
          break;
        }
      }
    }
  });

  // 5. Generate and send an email for each counselor
  counselorData.forEach(counselor => {
    if (counselor.students.length === 0) {
      Logger.log(`No students to report for ${counselor.name}. Skipping email.`);
      return;
    }

    counselor.students.sort((a, b) => a.name.localeCompare(b.name));

    const htmlTableRows = counselor.students.map(student => {
      const formattedClassList = student.failing.toString().split('\n').map(className =>
        `<div style="white-space: nowrap;">${className.trim()}</div>`
      ).join('');

      const spartanData = spartanHourData.get(student.name.trim().toLowerCase()) || { requests: '', skipped: '' };

      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 12px; font-family: Arial, sans-serif; white-space: nowrap;">${student.name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 12px; font-family: Arial, sans-serif; text-align: center; white-space: nowrap;">${student.grade}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 12px; font-family: Arial, sans-serif;">${formattedClassList}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 12px; font-family: Arial, sans-serif; text-align: center; white-space: nowrap;">${student.detention}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 12px; font-family: Arial, sans-serif; text-align: center; white-space: nowrap;">${student.absences}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 12px; font-family: Arial, sans-serif;">${spartanData.requests}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 12px; font-family: Arial, sans-serif;">${spartanData.skipped}</td>
        </tr>
      `;
    }).join('');

    const timestampForSubject = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy");
    const timestampForBody = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy 'at' h:mm a");
    const counselorFirstName = counselor.name.split(' ')[0];

    const subject = `Weekly Academic Summary for Your Alpha List - ${timestampForSubject}`;
    const htmlBody = `
      <!DOCTYPE html><html><body style="margin: 0; padding: 0; background-color: #f0f0f0; font-family: Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="800" style="border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr><td align="center" style="padding: 40px 0 30px 0; background-color: #4356a0; color: #ffffff;"><h1 style="font-size: 24px; margin: 0;">Weekly Academic Summary Report</h1></td></tr>
          <tr><td style="padding: 20px 30px 40px 30px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr><td style="color: #153643; font-size: 14px;">
                <p style="margin: 0;">Hi ${counselorFirstName},</p>
                <p style="margin: 15px 0 10px 0;">As of <strong>${timestampForBody}</strong>, the following students in your alpha list are failing one or more classes:</p>
              </td></tr>
              <tr><td>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border-radius: 4px; overflow: hidden; border: 1px solid #ddd;">
                  <thead>
                    <tr style="background-color: #f2f2f2;">
                      <th style="padding: 10px 12px; text-align: left; font-size: 10px;">Student Name</th>
                      <th style="padding: 10px 12px; text-align: center; font-size: 10px;">Grade</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 10px;">Failing Class(es)</th>
                      <th style="padding: 10px 12px; text-align: center; font-size: 10px;">Unserved Detention</th>
                      <th style="padding: 10px 12px; text-align: center; font-size: 10px;">Total Absences</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 10px;">Spartan Hour Request (Past 7 days)</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 10px;">Skipped Session(s) (Past 7 days)</th>
                    </tr>
                  </thead>
                  <tbody>${htmlTableRows}</tbody>
                </table>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding: 20px 30px; background-color: #ecf0f1; text-align: center; font-size: 12px; color: #7f8c8d;">This is an automated notification from the OHS Academics & Attendance Hub.</td></tr>
        </table>
      </body></html>
    `;

    try {
      MailApp.sendEmail({
        to: counselor.email,
        subject: subject,
        htmlBody: htmlBody
      });
      Logger.log(`Successfully sent summary email to ${counselor.name} at ${counselor.email}`);
    } catch (e) {
      Logger.log(`Failed to send email to ${counselor.name}. Error: ${e.toString()}`);
    }
  });
}


/**
 * Serves the HTML for the web app dashboard.
 * @returns {HtmlOutput} The HTML output for the web app.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle("OHS Academics & Attendance Dashboard")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Fetches and processes student data from the spreadsheet for the web app.
 * @returns {Object[]} An array of student data objects.
 */
function getStudentData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("⭐Academics & Attendance Hub");
    if (!sheet) {
      throw new Error("Sheet '⭐Academics & Attendance Hub' not found.");
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return []; // No data if there are no students
    }
    
    // Fetch data from column A (1) to AC (29) to include all necessary fields
    const range = sheet.getRange(2, 1, lastRow - 1, 29);
    const values = range.getValues();

    const headers = [
      "ineligible", "studentName", "grade", "id", "caseManager", "activity",
      "unservedDetention", "totalDetention", "disciplineDetention", "attendanceDetention",
      "isFailing", "failingClasses", "numFGrades", "unexcusedAbsences", "unexcusedTardies",
      "medicalAbsences", "illnessAbsences", "truancyAbsences", "totalAbsences",
      "totalAbsenceDays", "dishonestyReferrals", "tier2Interventions",
      "spartanHourTotalRequests", "spartanHourSkippedRequests", "spartanHourReqsHighPriority",
      "totalClubMeetingsAttended", "clubsAttended", "tier2Instructor", "attendanceLetters"
    ];

    const data = values.map(row => {
      let obj = {};
      headers.forEach((key, i) => {
        let value = row[i];
        // Perform necessary type conversions for charts and display
        if (['ineligible', 'isFailing'].includes(key)) {
          obj[key] = (value === true || String(value).toUpperCase() === 'TRUE');
        } else if (['grade', 'id', 'unservedDetention', 'numFGrades', 'totalAbsences', 'disciplineDetention', 'attendanceDetention', 'unexcusedAbsences', 'unexcusedTardies', 'medicalAbsences', 'illnessAbsences', 'truancyAbsences', 'spartanHourTotalRequests', 'spartanHourSkippedRequests', 'spartanHourReqsHighPriority', 'totalClubMeetingsAttended'].includes(key)) {
          // Ensure that numbers are parsed correctly, defaulting to 0 if blank or non-numeric
          const parsedValue = parseInt(value, 10);
          obj[key] = isNaN(parsedValue) ? 0 : parsedValue;
        } else {
          obj[key] = value;
        }
      });
      return obj;
    }).filter(student => student.studentName); // Filter out any rows that might be empty

    return data;
  } catch (e) {
    Logger.log("Error in getStudentData: " + e.message);
    // Re-throw the error so the client-side failure handler can catch it
    throw new Error("A server-side error occurred while fetching data: " + e.message);
  }
}


// ===============================================================
// EXISTING CODE FROM YOUR SPREADSHEET (NO CHANGES MADE BELOW)
// ===============================================================

/**
 * Scans all rows on the advisors sheet and sends an email for each row
 * where the "Send Notification" checkbox (Column I) is checked.
 * Designed to be run by a time-based trigger.
 */
function sendIneligibilityNotifications() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("✎Activity Advisors & Coaches");

  if (!sheet) {
    Logger.log("Sheet '✎Activity Advisors & Coaches' not found. Exiting.");
    return;
  }

  // --- Define column numbers for clarity ---
  const activityCol = 1;
  const studentsCol = 2;
  const primaryEmailCol = 4;
  const secondaryEmailCol = 6;
  const otherEmailsCol = 8;
  const sendCol = 9;
  const timestampCol = 10;

  // --- Get all data from the sheet at once for efficiency ---
  const dataRange = sheet.getDataRange();
  const allValues = dataRange.getValues();
  const headers = allValues.shift(); // Remove header row from our data array

  // --- Get admin names once to use for all emails ---
  const adminNames = getAdminNames();
  
  // Create the formatted contact message once
  let contactMessage = "";
  if (adminNames.length === 1) {
    contactMessage = `If you have any questions, please contact ${adminNames[0]} for additional information.`;
  } else if (adminNames.length === 2) {
    contactMessage = `If you have any questions, please contact ${adminNames[0]} or ${adminNames[1]} for additional information.`;
  } else if (adminNames.length > 2) {
    const lastAdmin = adminNames.pop();
    contactMessage = `If you have any questions, please contact ${adminNames.join(', ')}, or ${lastAdmin} for additional information.`;
  } else {
    contactMessage = "If you have any questions, please contact a school administrator for additional information.";
  }

  // --- Loop through every row of data ---
  allValues.forEach((rowData, index) => {
    const shouldSend = rowData[sendCol - 1]; // Column I is at index 8 of the array

    // If the checkbox in this row is TRUE, process it
    if (shouldSend === true) {
      // Calculate the actual row number in the sheet.
      // +2 because array indexes start at 0 and we removed one header row.
      const sheetRow = index + 2; 
      
      const activity = rowData[activityCol - 1];
      const students = rowData[studentsCol - 1];
      const primaryEmail = rowData[primaryEmailCol - 1];
      const secondaryEmail = rowData[secondaryEmailCol - 1];
      const otherEmails = rowData[otherEmailsCol - 1];
      
      // Skip if there are no students listed for this activity
      if (!students || students.trim() === "") {
        sheet.getRange(sheetRow, sendCol).setValue(false); // Uncheck the box to prevent future errors
        Logger.log(`Row ${sheetRow}: Skipped due to no students listed. Box unchecked.`);
        return; // This acts like 'continue' in a forEach loop
      }

      // Build the list of recipient emails
      const recipients = [];
      if (primaryEmail) recipients.push(primaryEmail);
      if (secondaryEmail) recipients.push(secondaryEmail);
      if (otherEmails) {
        const otherEmailList = otherEmails.split(',').map(email => email.trim());
        recipients.push(...otherEmailList);
      }
      
      // If no valid recipients, log and uncheck the box
      if (recipients.length === 0) {
        sheet.getRange(sheetRow, sendCol).setValue(false);
        Logger.log(`Row ${sheetRow}: Skipped because no recipient emails were found for '${activity}'. Box unchecked.`);
        return;
      }

      // --- The rest of the logic is the same as before, creating and sending the email ---
      const studentsHtmlList = students.split('\n').map(name => `
        <tr><td style="padding: 8px 12px; border-bottom: 1px solid #ddd; background-color: #f9f9f9; font-size: 14px; font-family: Arial, sans-serif;">${name}</td></tr>
      `).join('');

      const timestamp = new Date();
      const formattedTimestamp = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "MMMM d, yyyy 'at' h:mm a");

      const subject = `Ineligible Students for ${activity}`;
      const htmlBody = `
        <!DOCTYPE html><html><body style="margin: 0; padding: 0; background-color: #f0f0f0; font-family: Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <tr><td align="center" style="padding: 40px 0 30px 0; background-color: #2c3e50; color: #ffffff;"><h1 style="font-size: 24px; margin: 0;">Ineligibility Alert</h1></td></tr>
            <tr><td style="padding: 20px 30px 40px 30px;">
              <p>Hello,</p><p>As of <strong>${formattedTimestamp}</strong>, the following students are currently flagged as ineligible for <strong>${activity}</strong>:</p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #ddd;">${studentsHtmlList}</table>
              <p style="margin-top: 20px;">${contactMessage}</p>
              <p style="margin-top: 20px; font-size: 12px; color: #888;">This is an automated notification. Please do not reply directly to this email.</p>
            </td></tr>
            <tr><td style="padding: 20px 30px; background-color: #ecf0f1; text-align: center; font-size: 12px; color: #7f8c8d;">This notification was generated by the school's eligibility tracking system.</td></tr>
          </table></body></html>`;

      try {
        MailApp.sendEmail({ to: recipients.join(','), subject: subject, htmlBody: htmlBody });

        // --- IMPORTANT: Update the sheet after sending the email ---
        sheet.getRange(sheetRow, timestampCol).setValue(timestamp); // Add the new timestamp
        sheet.getRange(sheetRow, sendCol).setValue(false);          // Uncheck the box to prevent re-sending
        Logger.log(`Successfully sent email for row ${sheetRow} ('${activity}').`);

      } catch (e) {
        Logger.log(`Error sending email for row ${sheetRow}: ${e.toString()}`);
      }
    }
  });
}
/**
 * Gets the admin names from the "Admin Settings" sheet.
 * @return {string[]} An array of admin names.
 */
function getAdminNames() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const adminSheet = spreadsheet.getSheetByName("Admin Settings");
  if (!adminSheet) {
    Logger.log("Admin Settings sheet not found!");
    return [];
  }

  // Get all data from column A and filter out any empty rows.
  const lastRow = adminSheet.getLastRow();
  const adminNames = adminSheet.getRange('A2:A' + lastRow)
    .getValues()
    .map(row => row[0])
    .filter(String); // The .filter(String) method removes all empty values.

  return adminNames;
}

/**
 * Gets the admin email addresses from the "Admin Settings" sheet.
 * Assumes emails are in Column B.
 * @return {string[]} An array of admin email addresses.
 */
function getAdminEmails() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const adminSheet = spreadsheet.getSheetByName("Admin Settings");
  if (!adminSheet) {
    Logger.log("Admin Settings sheet not found!");
    return [];
  }

  // Get all data from column B, starting from B2, and filter out any empty rows.
  const lastRow = adminSheet.getLastRow();
  if (lastRow < 2) return []; // No data to get

  const adminEmails = adminSheet.getRange('B2:B' + lastRow)
    .getValues()
    .map(row => row[0].trim()) // Get email and remove whitespace
    .filter(String); // Removes any empty values

  return adminEmails;
}

/**
 * Generates and emails a summary of all ineligible students to administrators,
 * split into two categories based on the number of failing classes.
 * Designed to be run by a time-based trigger.
 */
function sendIneligibilitySummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hubSheet = ss.getSheetByName("⭐Academics & Attendance Hub");
  const advisorsSheet = ss.getSheetByName("✎Activity Advisors & Coaches");

  if (!hubSheet || !advisorsSheet) {
    Logger.log("Could not find one of the required sheets: '⭐Academics & Attendance Hub' or '✎Activity Advisors & Coaches'.");
    return;
  }

  // 1. Get F counts and class lists for all students from the Hub sheet
  const studentFailureData = new Map();
  const hubData = hubSheet.getRange("B2:L" + hubSheet.getLastRow()).getValues();
  hubData.forEach(row => {
    const studentName = row[0]; // Column B
    const classList = row[10]; // Column L
    if (studentName && classList && typeof classList.toString === 'function') {
      const failingClasses = classList.toString().split('\n').filter(String);
      const fCount = failingClasses.length;
      if (fCount > 0) {
        studentFailureData.set(studentName.trim().toLowerCase(), {
          fCount: fCount,
          classes: failingClasses.join('\n')
        });
      }
    }
  });

  // 2. Collect students from the Advisors sheet and categorize them
  const ineligibleStudents = []; // >= 2 Fs
  const atRiskStudents = []; // == 1 F

  const advisorData = advisorsSheet.getDataRange().getValues();
  const dataRows = advisorData.slice(1); // Remove header row

  dataRows.forEach(row => {
    const activity = row[0]; // Activity is in Column A
    const studentsString = row[1]; // Students are in Column B

    if (activity && studentsString) {
      const studentNames = studentsString.split('\n').filter(String);
      studentNames.forEach(name => {
        const studentName = name.trim();
        const studentData = studentFailureData.get(studentName.toLowerCase()) || {
          fCount: 0,
          classes: ''
        };

        const studentInfo = {
          student: studentName,
          activity: activity.trim(),
          classes: studentData.classes
        };

        if (studentData.fCount >= 2) {
          ineligibleStudents.push(studentInfo);
        } else if (studentData.fCount === 1) {
          atRiskStudents.push(studentInfo);
        }
      });
    }
  });

  // If there are no students in either category, stop the function.
  if (ineligibleStudents.length === 0 && atRiskStudents.length === 0) {
    Logger.log("No ineligible or at-risk students to report.");
    return;
  }

  // 3. Sort both lists: first by activity, then by student name
  const sortFunction = (a, b) => {
    const activityCompare = a.activity.localeCompare(b.activity);
    if (activityCompare !== 0) return activityCompare;
    return a.student.localeCompare(b.student);
  };
  ineligibleStudents.sort(sortFunction);
  atRiskStudents.sort(sortFunction);

  // 4. Helper function to create an HTML table for a list of students
  const createHtmlTable = (studentList) => {
    return studentList.map((item, index) => {
      const backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9'; // Alternating colors
      const formattedClasses = item.classes.replace(/\n/g, '<br>');
      return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; background-color: ${backgroundColor}; font-size: 14px; font-family: Arial, sans-serif; width: 30%;">${item.student}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; background-color: ${backgroundColor}; font-size: 14px; font-family: Arial, sans-serif; width: 30%;">${item.activity}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; background-color: ${backgroundColor}; font-size: 14px; font-family: Arial, sans-serif; width: 40%;">${formattedClasses}</td>
      </tr>
    `
    }).join('');
  };

  // 5. Build the HTML for both sections
  let emailSectionsHtml = "";

  // Section 1: Ineligible Students (Red Alert)
  if (ineligibleStudents.length > 0) {
    const ineligibleHtml = createHtmlTable(ineligibleStudents);
    emailSectionsHtml += `
      <div style="margin-bottom: 30px;">
        <div style="background-color: #f8d7da; color: #721c24; padding: 12px; border-radius: 4px; border-left: 5px solid #d9534f; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 18px; font-family: Arial, sans-serif;">Ineligible: Students Failing 2 or More Classes</h2>
        </div>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #ddd; border-left: 5px solid #d9534f;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 10px 12px; text-align: left; font-size: 14px; font-family: Arial, sans-serif; width: 30%;">Student Name</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 14px; font-family: Arial, sans-serif; width: 30%;">Activity</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 14px; font-family: Arial, sans-serif; width: 40%;">Classes with Failing Grade</th>
            </tr>
          </thead>
          <tbody>
            ${ineligibleHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // Section 2: At-Risk Students (Yellow Warning)
  if (atRiskStudents.length > 0) {
    const atRiskHtml = createHtmlTable(atRiskStudents);
    emailSectionsHtml += `
      <div style="margin-bottom: 30px;">
        <div style="background-color: #fff3cd; color: #856404; padding: 12px; border-radius: 4px; border-left: 5px solid #ffc107; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 18px; font-family: Arial, sans-serif;">At-Risk: Students Failing 1 Class</h2>
        </div>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #ddd; border-left: 5px solid #ffc107;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="padding: 10px 12px; text-align: left; font-size: 14px; font-family: Arial, sans-serif; width: 30%;">Student Name</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 14px; font-family: Arial, sans-serif; width: 30%;">Activity</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 14px; font-family: Arial, sans-serif; width: 40%;">Classes with Failing Grade</th>
            </tr>
          </thead>
          <tbody>
            ${atRiskHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // 6. Prepare and send the email
  const recipients = getAdminEmails();
  if (recipients.length === 0) {
    Logger.log("No administrator emails found to send the summary to.");
    return;
  }

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy");
  const subject = `Eligibility Report - ${timestamp}`;
  const introMessage = `As of <strong>${timestamp}</strong>, here is the summary of students currently flagged for academic reasons:`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #f0f0f0;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <tr>
          <td align="center" style="padding: 40px 0 30px 0; background-color: #2c3e50; color: #ffffff;">
            <h1 style="font-size: 24px; margin: 0; font-family: Arial, sans-serif;">Academic Eligibility Summary</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 30px 40px 30px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="color: #153643; font-family: Arial, sans-serif; font-size: 16px;">
                  <p style="margin: 0;">Hello,</p>
                  <p style="margin: 15px 0 25px 0;">${introMessage}</p>
                </td>
              </tr>
              <tr>
                <td>
                  ${emailSectionsHtml}
                </td>
              </tr>
              <tr>
                <td style="padding: 30px 30px 10px 30px; text-align: center;">
                  <a href="https://docs.google.com/spreadsheets/d/1CTPpE2sOHwcsRRCaH8p70RFUXpWqo23t8Hrk49oJrMw/edit?gid=1157397038#gid=1157397038" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; background-color: #4356a0; background: linear-gradient(to right, #4356a0, #c13435); padding: 15px 25px; border-radius: 8px; display: inline-block; font-weight: bold; border: 1px solid #2c3a6b; border-bottom: 3px solid #2c3a6b; border-right: 3px solid #2c3a6b;">
                    View detailed information on the OHS Academic Standing & Attendance Hub
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 30px; background-color: #ecf0f1; text-align: center; font-size: 12px; color: #7f8c8d; font-family: Arial, sans-serif;">
            This summary was generated automatically by the school's eligibility tracking system.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: subject,
      htmlBody: htmlBody
    });
    Logger.log("Eligibility summary email sent successfully.");
  } catch (e) {
    Logger.log(`Error sending summary email: ${e.toString()}`);
  }
}


/**
 * Scans the Academics & Attendance Hub for failing students and sends a
 * summary email to their respective case managers, using a new matching logic.
 */
function sendCaseManagerFailureReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hubSheet = ss.getSheetByName("⭐Academics & Attendance Hub");
  const adminSheet = ss.getSheetByName("Admin Settings");

  if (!hubSheet || !adminSheet) {
    Logger.log("Error: Could not find one of the required sheets ('⭐Academics & Attendance Hub' or 'Admin Settings').");
    return;
  }

  // 1. Create a lookup map using a standardized "match key" (e.g., "erickson, i")
  const caseManagerMap = new Map();
  // Read from columns C (First), D (Last), and E (Email)
  const adminData = adminSheet.getRange("C2:E" + adminSheet.getLastRow()).getValues();

  adminData.forEach(row => {
    const firstName = row[0];
    const lastName = row[1];
    const email = row[2];

    if (firstName && lastName && email) {
      const managerInfo = {
        firstName: firstName.trim(),
        email: email.trim()
      };

      // Create the primary match key: lastname,firstinitial (e.g., "troy,p")
      const matchKeyWithInitial = `${lastName.trim().toLowerCase()},${firstName.trim().toLowerCase().charAt(0)}`;
      caseManagerMap.set(matchKeyWithInitial, managerInfo);

      // Create a second key with only the last name (e.g., "troy")
      const matchKeyLastNameOnly = lastName.trim().toLowerCase();
      caseManagerMap.set(matchKeyLastNameOnly, managerInfo);
    }
  });

  if (caseManagerMap.size === 0) {
    Logger.log("No case manager data found in 'Admin Settings' sheet C:E.");
    return;
  }

  // 2. Group failing students by their case manager's standardized match key
  const studentsByCaseManagerKey = new Map();
  // Read data from the Hub, now including column S for absences
  const studentData = hubSheet.getRange("B2:S" + hubSheet.getLastRow()).getValues();

  studentData.forEach(row => {
    const studentName = row[0]; // Column B
    const caseManagerFromHub = row[3]; // Column E (e.g., "Erickson, I" or "Troy")
    const detentionHours = row[5] || ''; // Column G
    const classList = row[10]; // Column L
    const totalAbsences = row[17] || 0; // Column S (index 17 because range starts at B)

    if (caseManagerFromHub && studentName && classList) {
      // Standardize the name from the Hub to the "lastname,f" or "lastname" format
      const studentMatchKey = caseManagerFromHub.toString().trim().toLowerCase().replace(/\s/g, '');

      if (!studentsByCaseManagerKey.has(studentMatchKey)) {
        studentsByCaseManagerKey.set(studentMatchKey, []);
      }
      studentsByCaseManagerKey.get(studentMatchKey).push({
        name: studentName,
        classes: classList,
        detentions: detentionHours,
        totalAbsences: totalAbsences
      });
    }
  });

  // 3. Iterate over each group and send a tailored email
  for (const [matchKey, students] of studentsByCaseManagerKey.entries()) {
    const caseManagerInfo = caseManagerMap.get(matchKey);

    if (!caseManagerInfo) {
      Logger.log(`Could not find a matching case manager for key: "${matchKey}". Skipping.`);
      continue;
    }

    const {
      firstName,
      email
    } = caseManagerInfo;

    const htmlTableRows = students.map(student => {
      const formattedClassList = student.classes.toString().replace(/\n/g, '<br>');
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 14px; font-family: Arial, sans-serif;" width="25%">${student.name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 14px; font-family: Arial, sans-serif;" width="40%">${formattedClassList}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 14px; font-family: Arial, sans-serif; text-align: center;" width="15%">${student.detentions}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #ddd; font-size: 14px; font-family: Arial, sans-serif; text-align: center;" width="20%">${student.totalAbsences}</td>
        </tr>
      `;
    }).join('');

    const timestampForSubject = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy");
    const timestampForBody = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM d, yyyy 'at' h:mm a");

    const subject = `Failing Student Report for your Caseload - ${timestampForSubject}`;
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0; padding: 0; background-color: #f0f0f0; font-family: Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td align="center" style="padding: 40px 0 30px 0; background-color: #d9534f; color: #ffffff;">
              <h1 style="font-size: 24px; margin: 0;">Academic Alert</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px 40px 30px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #153643; font-size: 16px;">
                    <p style="margin: 0;">Hello ${firstName},</p>
                    <p style="margin: 15px 0 10px 0;">As of <strong>${timestampForBody}</strong>, the following students on your caseload are failing one or more classes:</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border-radius: 4px; overflow: hidden; border: 1px solid #ddd;">
                      <thead>
                        <tr style="background-color: #f2f2f2;">
                  -        <th style="padding: 10px 12px; text-align: left; font-size: 14px;" width="25%">Student Name</th>
                          <th style="padding: 10px 12px; text-align: left; font-size: 14px;" width="40%">Classes with Failing Grade</th>
                          <th style="padding: 10px 12px; text-align: center; font-size: 14px;" width="15%">Unserved Detention Hours</th>
                          <th style="padding: 10px 12px; text-align: center; font-size: 14px;" width="20%">Total Absences</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${htmlTableRows}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; background-color: #ecf0f1; text-align: center; font-size: 12px; color: #7f8c8d;">
              This is an automated notification from the Academics & Attendance Hub.
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody
      });
      Logger.log(`Successfully sent report to ${firstName} at ${email}`);
    } catch (e) {
      Logger.log(`Failed to send email to ${firstName}. Error: ${e.toString()}`);
    }
  }
}

