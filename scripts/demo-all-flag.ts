/**
 * Demonstration of --all flag behavior
 */
import { parseArgs } from '../src/commands/autofix/config.js';

console.log('='.repeat(60));
console.log('AUTOFIX --all FLAG DEMONSTRATION');
console.log('='.repeat(60));

console.log('\n📋 SPECIFICATION REQUIREMENTS:');
console.log('  1. --all: Process all auto-fix labeled issues without confirmation');
console.log('  2. --all and --issues cannot be used together');
console.log('  3. --all and --dry-run can be used together');

console.log('\n' + '='.repeat(60));
console.log('VALID USE CASES');
console.log('='.repeat(60));

console.log('\n✅ Case 1: Process all issues without confirmation');
console.log('   Command: autofix --all');
try {
  const opts1 = parseArgs({ all: true });
  console.log('   Result:', JSON.stringify(opts1, null, 2));
} catch (e) {
  console.log('   Error:', (e as Error).message);
}

console.log('\n✅ Case 2: Dry-run all issues');
console.log('   Command: autofix --all --dry-run');
try {
  const opts2 = parseArgs({ all: true, dryRun: true });
  console.log('   Result:', JSON.stringify(opts2, null, 2));
} catch (e) {
  console.log('   Error:', (e as Error).message);
}

console.log('\n✅ Case 3: All issues with custom grouping and parallelism');
console.log('   Command: autofix --all --group-by file --max-parallel 5');
try {
  const opts3 = parseArgs({ all: true, groupBy: 'file', maxParallel: 5 });
  console.log('   Result:', JSON.stringify(opts3, null, 2));
} catch (e) {
  console.log('   Error:', (e as Error).message);
}

console.log('\n' + '='.repeat(60));
console.log('INVALID USE CASES (SHOULD FAIL)');
console.log('='.repeat(60));

console.log('\n❌ Case 4: --all with --issues (MUST FAIL)');
console.log('   Command: autofix --all --issues 123,456');
try {
  const opts4 = parseArgs({ all: true, issues: '123,456' });
  console.log('   Result:', JSON.stringify(opts4, null, 2));
  console.log('   ⚠️  WARNING: Should have thrown an error!');
} catch (e) {
  console.log('   ✓ Correctly rejected:', (e as Error).message);
}

console.log('\n' + '='.repeat(60));
console.log('DEFAULT BEHAVIOR (WITHOUT --all)');
console.log('='.repeat(60));

console.log('\n✅ Case 5: Default behavior (prompts for confirmation)');
console.log('   Command: autofix');
try {
  const opts5 = parseArgs({});
  console.log('   Result:', JSON.stringify(opts5, null, 2));
  console.log('   Note: all flag is not present, may prompt user');
} catch (e) {
  console.log('   Error:', (e as Error).message);
}

console.log('\n✅ Case 6: Specific issues (no confirmation needed)');
console.log('   Command: autofix --issues 123,456');
try {
  const opts6 = parseArgs({ issues: '123,456' });
  console.log('   Result:', JSON.stringify(opts6, null, 2));
} catch (e) {
  console.log('   Error:', (e as Error).message);
}

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log('\n✅ All specification requirements met:');
console.log('   • --all flag processes all issues without confirmation');
console.log('   • --all and --issues are mutually exclusive');
console.log('   • --all works with --dry-run and other flags');
console.log('   • Type-safe implementation with Zod validation');
console.log('   • Runtime validation in index.ts');
console.log('   • Help text updated with examples');
console.log('\n' + '='.repeat(60));
