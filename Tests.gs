// ✅ GOOD: Isolated from GAS services. Easy to test.
function test_generateNameKey() {
  const cases = [
    { input: 'Smith, John', expected: 'smith|john', desc: 'Standard Last, First' },
    { input: 'Doe, Jane', expected: 'doe|jane', desc: 'Standard Last, First' },
    { input: 'Bond, James', expected: 'bond|james', desc: 'Standard Last, First' },
    { input: '  Space  ,  Cadet  ', expected: 'space|cadet', desc: 'Whitespace padding' },
    { input: 'Single', expected: 'single', desc: 'Mononym' },
    { input: 'First Last', expected: 'last|first', desc: 'First Last format' },
    { input: null, expected: '', desc: 'Null input' },
    { input: '', expected: '', desc: 'Empty input' }
  ];

  let passed = 0;
  let failed = 0;
  const errors = [];

  cases.forEach(c => {
    try {
      const result = generateNameKey(c.input);
      if (result !== c.expected) {
        throw new Error(`Expected '${c.expected}', got '${result}'`);
      }
      passed++;
    } catch (e) {
      failed++;
      errors.push(`${c.desc}: ${e.message}`);
    }
  });

  if (failed > 0) {
    throw new Error(`test_generateNameKey failed ${failed} cases:\n${errors.join('\n')}`);
  }
}

function test_calculateSnapshotDiff() {
    // Mock Config
    const mockConfig = [
        { key: 'totalStudents', header: 'Total Students', type: 'number' },
        { key: 'avgScore', header: 'Average Score', type: 'number', precision: 1 },
        { key: 'rate', header: 'Pass Rate', type: 'number', precision: 1 }
    ];

    const snapshot1 = {
        totalStudents: 100,
        avgScore: 80.5,
        rate: 50.0
    };

    const snapshot2 = {
        totalStudents: 110, // +10 (+10%)
        avgScore: 82.5,     // +2.0
        rate: 55.0          // +5.0
    };

    // Case 1: Normal diff
    const diff = calculateSnapshotDiff(snapshot1, snapshot2, mockConfig);

    // Check totalStudents
    const totalDiff = diff.changes.find(c => c.metric === 'Total Students');
    if (!totalDiff || totalDiff.delta !== 10 || totalDiff.percentChange !== '10.0') {
         throw new Error(`Total Students diff failed. Got: ${JSON.stringify(totalDiff)}`);
    }

    // Check avgScore (precision 1)
    const scoreDiff = diff.changes.find(c => c.metric === 'Average Score');
    if (!scoreDiff || scoreDiff.delta !== '2.0') {
         throw new Error(`Average Score diff failed. Got: ${JSON.stringify(scoreDiff)}`);
    }

    // Case 2: Zero baseline for percent change
    const sZero = { totalStudents: 0 };
    const sTen = { totalStudents: 10 };
    const diffZero = calculateSnapshotDiff(sZero, sTen, [{key:'totalStudents', header:'Total Students'}]);
    const zeroChange = diffZero.changes[0];
    if (zeroChange.percentChange !== 'N/A (from zero)') {
        throw new Error(`Zero baseline percent change failed. Expected 'N/A (from zero)', got '${zeroChange.percentChange}'`);
    }
}

function runAllTests() {
  const results = [];

  // Helper to run test and record result
  const runTest = (name, testFn) => {
    try {
      testFn();
      results.push({ name: name, passed: true, message: 'Passed' });
    } catch (e) {
      console.error(`Test ${name} failed: ${e.message}`);
      results.push({ name: name, passed: false, message: e.message });
    }
  };

  runTest('generateNameKey', test_generateNameKey);
  runTest('calculateSnapshotDiff', test_calculateSnapshotDiff);

  // Output results in OPS Tech Brand style
  Logger.log('--- TEST RESULTS ---');
  results.forEach(r => {
    if (r.passed) {
      Logger.log(`[PASS] ${r.name}`);
    } else {
      Logger.log(`[FAIL] ${r.name}: ${r.message}`);
    }
  });

  return results;
}
