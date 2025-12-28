# Scout's Journal - Critical Reliability Learnings

## 2024-05-22 - Logic Isolation in Snapshot Comparison
**Risk:** The `compareSnapshots` function tightly coupled data fetching (`getSnapshotByDate`) with mathematical comparison logic. This made it impossible to test the comparison formulas (delta, percentage change) without mocking the entire SpreadsheetApp or creating actual snapshot data in the sheet.
**Prevention:** We refactored the mathematical logic into a pure function `calculateSnapshotDiff(snapshot1, snapshot2)`. This allows us to write unit tests that pass in plain JavaScript objects and verify the output, ensuring the math is correct regardless of the data source. We now test this logic in `Tests.gs`.

## 2024-05-22 - Admin Settings Empty Sheet Crash
**Risk:** The `getAdminNames` function assumed that `adminSheet.getLastRow()` would always be >= 2. If the sheet was empty (or header only), `getRange` was called with invalid coordinates (e.g., `A2:A1`), causing a script crash.
**Prevention:** Added a guard clause `if (lastRow < 2) return [];` to handle empty sheets gracefully. This was verified with a regression test in `tests/test_getAdminNames.js`.
