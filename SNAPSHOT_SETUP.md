# Historical Snapshot System - Setup Guide

## Overview

The Historical Snapshot System automatically captures weekly snapshots of **GLOBAL AGGREGATE METRICS** every Monday at 11:00 AM CST, preserving historical trends for week-over-week comparison and year-long analysis.

**IMPORTANT**: This system captures ONLY aggregate/summary statistics (totals, averages, counts) - **NO individual student data** is stored in snapshots. This ensures privacy while enabling comprehensive trend analysis.

## Features

- **Automated Weekly Snapshots**: Captures data every Monday before the Tuesday 12pm CST updates
- **Manual Snapshot Creation**: Create snapshots on-demand via the web dashboard
- **Week-Over-Week Comparison**: Compare any two snapshots to see changes in student metrics
- **Historical Trend Charts**: Visualize trends across the school year for:
  - Students with failing grades
  - Average absences
  - Unserved detention
  - Ineligibility rates

## Setup Instructions

### Step 1: Initial Setup (One-Time)

You need to set up the automated trigger once. Follow these steps:

1. Open your Google Spreadsheet
2. Click **Extensions** → **Apps Script**
3. In the Apps Script editor, find the function `setupWeeklySnapshotTrigger`
4. Click the **Run** button (▶️) next to the function selector
5. Authorize the script when prompted
6. Check the execution log to confirm: "Weekly snapshot trigger set up successfully for Mondays at 11:00 AM."

**Note**: This only needs to be done once. The trigger will continue running every Monday automatically.

### Step 2: Create Your First Snapshot

To populate the system with initial data:

1. Open your OHS Academics & Attendance Dashboard (web app)
2. Navigate to the **Historical Trends** tab
3. Click **Create Snapshot Now**
4. Wait for confirmation message

## Using the Historical Trends Dashboard

### Viewing Historical Data

Once you have multiple snapshots (recommended: at least 2-3 weeks of data):

1. Navigate to the **Historical Trends** tab
2. View the summary cards showing:
   - Total number of snapshots
   - Latest snapshot date
   - Total student count from latest snapshot

3. Scroll down to view trend charts:
   - **Failing Grades Over Time**: Shows students with 2+ F grades (ineligible) vs 1 F grade (at-risk)
   - **Average Absences**: Track attendance trends school-wide
   - **Unserved Detention**: Monitor average detention hours
   - **Ineligibility Rate**: See the percentage of ineligible students over time

### Comparing Weeks

To compare **global metrics** between two specific weeks:

1. In the "Week-Over-Week Comparison" section:
   - Select the first week from the dropdown (older date)
   - Select the second week from the dropdown (newer date)
2. Click **Compare Snapshots**
3. Review the comparison results showing:
   - Changes in aggregate metrics (totals, averages, rates)
   - Delta values (numeric change) for each metric
   - Percentage change for each metric
   - Color coding:
     - **Green rows**: Improvement (e.g., fewer failures, less detention)
     - **Red rows**: Decline (e.g., more failures, more absences)
   - Side-by-side table of all metrics for both weeks

### Understanding the Data

**22 Aggregate Metrics Tracked** (plus snapshot date - NO individual student data):

**Student Counts:**
- Total Students
- Ineligible Students
- Students with F Grades (any Fs)
- Students with 1 F (at-risk)
- Students with 2+ F (ineligible)
- Students with Detention
- Students in Activities
- Students with Club Participation
- Students with Tier 2 Interventions
- Students with Special Education

**Academic Performance:**
- Ineligibility Rate (%)
- Total F Grades (across all students)
- Average Unserved Detention (hours)

**Attendance:**
- Total Absences (all types combined)
- Average Absences per student
- Unexcused Absences
- Truancy Absences
- Medical Absences
- Illness Absences

**Spartan Hour:**
- Total Requests
- Skipped Requests
- High Priority Requests

**Color Coding in Comparisons:**
- 🟢 Green Row: Improvement (fewer failures, less detention, fewer absences)
- 🔴 Red Row: Decline (more failures, more detention, more absences)

## Data Storage

- **Sheet Name**: `Historical Snapshots`
- **Location**: Automatically created in your spreadsheet on first snapshot
- **Data Format**: One row per snapshot, 23 columns total (1 date + 22 metrics)
- **Data Retention**: All snapshots are preserved indefinitely
- **Privacy**: NO individual student names, IDs, or personally identifiable information

## Trigger Management

### Viewing Active Triggers

1. In Apps Script editor: Click the **clock icon** (⏰) in the left sidebar
2. You should see: `createWeeklySnapshot` running weekly on Monday

### Modifying Trigger Time

If you need to change the snapshot time:

1. Run `setupWeeklySnapshotTrigger` again - it will delete the old trigger and create a new one
2. Or manually edit the trigger in the Apps Script Triggers panel

### Disabling Automatic Snapshots

To stop automatic snapshots:

1. Go to Apps Script → Triggers panel (⏰)
2. Find `createWeeklySnapshot` trigger
3. Click the **three dots** (⋮) → **Delete trigger**

**Note**: You can still create manual snapshots via the dashboard even if automatic triggers are disabled.

## Troubleshooting

### "No historical snapshots found"

**Cause**: No snapshots have been created yet
**Solution**: Click "Create Snapshot Now" or wait until Monday 11:00 AM for automatic capture

### Snapshot creation fails

**Possible causes**:
1. No data in "⭐Academics & Attendance Hub" sheet
2. Permission issues

**Solution**:
1. Verify the hub sheet exists and contains data
2. Re-run authorization: Apps Script → Run any function → Authorize

### Charts not displaying

**Cause**: Need at least 1 snapshot to display charts
**Solution**: Create at least one snapshot using "Create Snapshot Now"

### Comparison shows no changes

**Possible causes**:
1. Comparing identical snapshots (same date)
2. No global metrics actually changed between weeks (rare - usually at least student counts change)

**Solution**: Select different dates with at least a week between them

## Best Practices

1. **Regular Snapshots**: Ensure snapshots run every Monday - check the trigger monthly
2. **Backup**: The Historical Snapshots sheet contains valuable data - consider periodic exports
3. **Review Trends Monthly**: Look at the historical charts monthly to identify patterns
4. **Document Interventions**: Note when interventions are implemented so you can correlate with trend changes
5. **Archive Old Data**: At the end of the school year, consider archiving the snapshot data

## Data Privacy

**Snapshots are Privacy-Friendly:**
- **NO individual student data** is stored (no names, IDs, or PII)
- Contains ONLY aggregate metrics (counts, averages, totals)
- Safe to share with administrators for trend analysis
- Complies with student privacy regulations (FERPA)
- Access still controlled by spreadsheet permissions
- Follow your school's data retention policies

## Support

For technical issues:
1. Check the Apps Script execution logs (View → Logs)
2. Verify trigger is active (Apps Script → Triggers)
3. Test snapshot creation manually first

For feature requests or bugs, contact your system administrator.

---

**Version**: 1.0
**Last Updated**: November 2025
**Created By**: Claude (AI Assistant)
