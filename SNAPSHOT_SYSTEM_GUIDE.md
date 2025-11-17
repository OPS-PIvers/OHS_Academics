# Weekly Data Snapshot System - User Guide

## Overview

The Weekly Data Snapshot System allows you to preserve historical data from the "⭐Academics & Attendance Hub" sheet and compare student performance across different weeks. This solves the problem of losing historical data when the spreadsheet is updated dynamically.

## Features

### 1. **Automatic Weekly Snapshots**
- Snapshots are automatically created every Monday at 6:00 AM
- Each snapshot is a complete copy of your student data at that point in time
- Snapshots are named with the format: `Snapshot_YYYY-MM-DD`

### 2. **Manual Snapshot Creation**
- Create snapshots on-demand at any time
- Useful for capturing data before major updates or at key milestones

### 3. **Snapshot Comparison**
- Compare any two snapshots or a snapshot with current live data
- Track student improvements and declines
- View detailed metrics changes including:
  - Number of failing grades
  - Total absences
  - Unserved detention hours

### 4. **Visual Comparison Reports**
- Color-coded improvements (green) and declines (red)
- Summary statistics showing total changes
- Detailed student-by-student breakdown

## Getting Started

### Initial Setup

1. **Open your Google Sheets document**
   - Navigate to your OHS Academics spreadsheet

2. **Access the Web Dashboard**
   - Click on "Extensions" → "Apps Script" or access your published web app URL
   - Navigate to the "Weekly Snapshots" tab

3. **Setup Automatic Snapshots**
   - Click the **"Setup Weekly Trigger"** button
   - This configures the system to automatically create snapshots every Monday at 6:00 AM
   - You only need to do this once

4. **Create Your First Snapshot**
   - Click the **"Create Snapshot Now"** button
   - Wait for the success message
   - This snapshot serves as your baseline for future comparisons

## How to Use

### Creating Snapshots

#### Automatic Creation
Once you've run the setup trigger, snapshots will be created automatically every Monday morning. No further action is needed.

#### Manual Creation
1. Navigate to the **"Weekly Snapshots"** tab in the dashboard
2. Click **"Create Snapshot Now"**
3. Wait for the confirmation message
4. Click **"Refresh List"** to see your new snapshot in the dropdown menus

### Comparing Snapshots

1. **Select First Snapshot (Older)**
   - Use the left dropdown menu
   - Choose an older snapshot date to compare from

2. **Select Second Snapshot (Newer)**
   - Use the right dropdown menu
   - Choose a newer snapshot or select "Current Data (Live)" to compare with real-time data

3. **Run Comparison**
   - Click the **"Compare Snapshots"** button
   - Wait for the comparison to complete (usually 5-10 seconds)

4. **Review Results**
   - **Comparison Summary**: Overview of improvements, declines, and total changes
   - **Improvements**: Students who showed progress (fewer failing grades, less detention, etc.)
   - **Declines**: Students whose metrics worsened
   - **All Changes**: Complete list of all students with any changes

### Understanding Comparison Metrics

The system tracks changes across multiple categories for comprehensive student monitoring:

#### **Academic Metrics**
- **Failing Classes (numFGrades)** - Number of classes with F grades
  - ↓ Green: Student improved (fewer F's)
  - ↑ Red: Student declined (more F's)

#### **Detention Metrics** (all lower is better)
- **Unserved Detention** - Hours of detention not yet served
- **Total Detention** - Total detention hours assigned
- **Discipline Detention** - Detention from behavior issues
- **Attendance Detention** - Detention from attendance issues

#### **Attendance Metrics** (all lower is better)
- **Total Absences** - Overall absence count
- **Unexcused Absences** - Absences without valid excuse
- **Unexcused Tardies** - Late arrivals without excuse
- **Medical Absences** - Absences for medical appointments
- **Illness Absences** - Absences due to illness
- **Truancy Absences** - Unexcused absences (truancy)

#### **Spartan Hour Metrics** (lower is better)
- **Spartan Hour Requests** - Total intervention requests
- **Skipped Sessions** - Missed Spartan Hour appointments
- **High Priority Requests** - Urgent intervention needs

#### **Engagement Metrics** (higher is better)
- **Club Meetings Attended** - Extracurricular participation
  - ↑ Green: More attendance (improved)
  - ↓ Red: Less attendance (declined)

#### **Progress Tracking**
- **Consecutive Weeks on D/F List** - Weeks student has been struggling
  - ↓ Green: Fewer weeks (improvement)
  - ↑ Red: More weeks (ongoing concern)

## Advanced Features

### Programmatic Access

You can also run snapshot functions directly from the Apps Script editor:

```javascript
// Create a snapshot
createWeeklySnapshot();

// Get all available snapshots
const snapshots = getAvailableSnapshots();

// Compare two specific snapshots
const comparison = compareSnapshots('Snapshot_2025-11-10', 'Snapshot_2025-11-17');

// Get data from a specific snapshot
const data = getSnapshotData('Snapshot_2025-11-10');

// Delete old snapshots (keeps last 12 weeks by default)
deleteOldSnapshots(12);
```

### Snapshot Cleanup

Snapshots are stored as sheets in your spreadsheet. Over time, you may want to clean up old snapshots:

1. **Manual Deletion**
   - Navigate to your spreadsheet
   - Right-click on any snapshot sheet (starts with "Snapshot_")
   - Select "Delete"

2. **Automated Cleanup** (via Apps Script)
   - Open the Apps Script editor
   - Run the function: `deleteOldSnapshots(12)` (keeps last 12 weeks)
   - Adjust the number to keep more or fewer weeks

## Troubleshooting

### Problem: Snapshots tab shows "No snapshots available"
**Solution**: Create your first snapshot by clicking "Create Snapshot Now"

### Problem: Weekly trigger not working
**Solution**:
1. Click "Setup Weekly Trigger" again
2. Check Apps Script triggers: Extensions → Apps Script → Triggers (clock icon)
3. Verify you have a trigger for `createWeeklySnapshot` set to run weekly on Mondays

### Problem: Comparison fails with error
**Solution**:
1. Ensure both snapshots still exist in your spreadsheet
2. Check that the snapshot sheets haven't been renamed
3. Verify you have sufficient permissions to access the spreadsheet

### Problem: Snapshot creation fails
**Solution**:
1. Ensure the "⭐Academics & Attendance Hub" sheet exists
2. Check that you have edit permissions for the spreadsheet
3. Verify the sheet isn't protected

## Best Practices

1. **Create snapshots before major data updates**
   - Before grade imports
   - Before attendance batch updates
   - At the end of each grading period

2. **Compare weekly progress**
   - Use the current week snapshot vs. previous week
   - Track student improvement trends over time

3. **Use with counselor meetings**
   - Generate comparison reports before student/parent conferences
   - Show concrete data on progress or areas needing attention

4. **Monitor long-term trends**
   - Compare beginning of semester vs. current data
   - Track intervention effectiveness over multiple weeks

5. **Regular cleanup**
   - Keep 12-16 weeks of snapshots (one semester)
   - Archive older snapshots externally if needed for records

## Data Privacy Note

Snapshots are stored within the same Google Sheets document and inherit the same sharing permissions. Ensure your spreadsheet access is properly configured to protect student data.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the Google Apps Script logs: Extensions → Apps Script → Executions
3. Contact your system administrator

## Technical Details

- **Storage**: Snapshots are stored as separate sheets within the same spreadsheet
- **Format**: Each snapshot is a complete copy of the "⭐Academics & Attendance Hub" sheet
- **Trigger Time**: Monday 6:00 AM (configurable in Apps Script)
- **Data Retention**: Unlimited (manual cleanup recommended)
- **Comparison Algorithm**: Client-side processing using JavaScript Maps for efficient O(n) comparison

## Version History

- **v1.0** (2025-11-17): Initial release with core snapshot and comparison features
