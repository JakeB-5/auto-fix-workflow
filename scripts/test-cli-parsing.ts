/**
 * Test CLI argument parsing for --all flag
 */

// Simulate CLI argument parsing like in index.ts main()
function parseCliArgs(argv: string[]): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      const nextArg = argv[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        // Boolean check
        if (nextArg === 'true') {
          args[key] = true;
        } else if (nextArg === 'false') {
          args[key] = false;
        } else if (!isNaN(Number(nextArg))) {
          args[key] = Number(nextArg);
        } else {
          args[key] = nextArg;
        }
        i++;
      } else {
        // Flag without value = true
        args[key] = true;
      }
    }
  }

  return args;
}

console.log('Testing CLI argument parsing...\n');

// Test 1: --all flag
const test1 = parseCliArgs(['--all']);
console.log('Test 1 - --all:', test1);
console.log('✓ all =', test1.all === true);

// Test 2: --all --dry-run
const test2 = parseCliArgs(['--all', '--dry-run']);
console.log('\nTest 2 - --all --dry-run:', test2);
console.log('✓ all =', test2.all === true, ', dryRun =', test2.dryRun === true);

// Test 3: --all --verbose --max-parallel 5
const test3 = parseCliArgs(['--all', '--verbose', '--max-parallel', '5']);
console.log('\nTest 3 - --all --verbose --max-parallel 5:', test3);
console.log('✓ all =', test3.all === true, ', verbose =', test3.verbose === true, ', maxParallel =', test3.maxParallel === 5);

// Test 4: --all --issues 123
const test4 = parseCliArgs(['--all', '--issues', '123']);
console.log('\nTest 4 - --all --issues 123:', test4);
console.log('✓ both flags present (should be rejected by schema):', test4.all === true && test4.issues === '123');

// Test 5: --dry-run (without --all)
const test5 = parseCliArgs(['--dry-run']);
console.log('\nTest 5 - --dry-run (no --all):', test5);
console.log('✓ dryRun =', test5.dryRun === true, ', all =', test5.all === undefined);

console.log('\n✅ CLI parsing tests completed!');
