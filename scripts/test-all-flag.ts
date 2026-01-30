/**
 * Manual test script for --all flag functionality
 */
import { parseArgs, AutofixArgsSchema } from '../src/commands/autofix/config.js';

console.log('Testing --all flag implementation...\n');

// Test 1: Parse --all flag correctly
console.log('Test 1: Parse --all flag correctly');
try {
  const result1 = AutofixArgsSchema.parse({ all: true });
  console.log('✓ --all flag parsed:', result1.all === true);
} catch (error) {
  console.log('✗ Failed:', error);
}

// Test 2: Default --all to false
console.log('\nTest 2: Default --all to false');
try {
  const result2 = AutofixArgsSchema.parse({});
  console.log('✓ Default value:', result2.all === false);
} catch (error) {
  console.log('✗ Failed:', error);
}

// Test 3: Reject --all with --issues
console.log('\nTest 3: Reject --all with --issues');
try {
  AutofixArgsSchema.parse({
    all: true,
    issues: '123,456',
  });
  console.log('✗ Should have thrown an error');
} catch (error) {
  console.log('✓ Correctly rejected:', (error as Error).message.includes('Cannot use --all and --issues together'));
}

// Test 4: Allow --all with --dry-run
console.log('\nTest 4: Allow --all with --dry-run');
try {
  const result4 = AutofixArgsSchema.parse({
    all: true,
    dryRun: true,
  });
  console.log('✓ --all with --dry-run:', result4.all === true && result4.dryRun === true);
} catch (error) {
  console.log('✗ Failed:', error);
}

// Test 5: parseArgs includes all flag
console.log('\nTest 5: parseArgs includes all flag');
try {
  const options = parseArgs({ all: true });
  console.log('✓ all flag in options:', options.all === true);
} catch (error) {
  console.log('✗ Failed:', error);
}

// Test 6: parseArgs rejects --all with --issues
console.log('\nTest 6: parseArgs rejects --all with --issues');
try {
  parseArgs({
    all: true,
    issues: [123, 456],
  });
  console.log('✗ Should have thrown an error');
} catch (error) {
  console.log('✓ Correctly rejected:', (error as Error).message.includes('Cannot use --all and --issues together'));
}

console.log('\n✅ All tests completed!');
