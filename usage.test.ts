import { renderProgressBar, renderUsage, runUsage } from './usage.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function eq<T>(a: T, b: T, msg: string) {
  if (a === b) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.error(`  FAIL: ${msg} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }
}

// ── Rendering ───────────────────────────────────────────

console.log('\n── Rendering ──');

{
  const bar = renderProgressBar(6, 12, 'Test', 90);
  assert(bar.includes('\x1b[32m'), 'Green ANSI code for ≤75% usage');
  assert(bar.includes('█'), 'Uses filled block char');
  assert(bar.includes('░'), 'Uses empty block char');
  assert(bar.includes('Test'), 'Includes label');
  assert(bar.includes('$6.00'), 'Formats current amount');
  assert(bar.includes('$12.00'), 'Formats limit amount');
  assert(bar.includes('50%'), 'Shows percentage');
}

{
  const bar = renderProgressBar(10, 12, 'Test', 90);
  assert(bar.includes('\x1b[33m'), 'Yellow ANSI code for 75-95% usage');
}

{
  const bar = renderProgressBar(12, 12, 'Test', 90);
  assert(bar.includes('\x1b[31m'), 'Red ANSI code for >95% usage');
}

{
  const wide = renderProgressBar(5, 10, 'T', 120);
  const narrow = renderProgressBar(5, 10, 'T', 60);
  assert(wide.length > narrow.length, 'Wider terminal produces longer bar');
}

{
  const bar = renderProgressBar(4.2, 10, 'T', 90);
  assert(bar.includes('$4.20'), 'Formats to two decimal places');
}

{
  const bar = renderProgressBar(0, 0, 'Zero', 90);
  assert(bar.includes('$0.00'), 'Handles zero limit without division by zero');
}

{
  const output = renderUsage({
    rolling_usage: 3, weekly_usage: 10, monthly_usage: 20,
    limit_rolling: 12, limit_weekly: 30, limit_monthly: 60,
    reset_time: new Date(Date.now() + 7200 * 1000)
  });
  assert(output.includes('Rolling 5h'), 'Includes rolling label');
  assert(output.includes('Weekly'), 'Includes weekly label');
  assert(output.includes('Monthly'), 'Includes monthly label');
  assert(output.includes('$3.00'), 'Includes rolling amount');
  assert(!output.includes('\x1b[0m\x1b[0m'), 'No doubled ANSI resets');
}

{
  const future = new Date(Date.now() + 3600 * 1000);
  const output = renderUsage({
    rolling_usage: 0, weekly_usage: 0, monthly_usage: 0,
    limit_rolling: 12, limit_weekly: 30, limit_monthly: 60,
    reset_time: future
  });
  assert(output.includes('Resets in'), 'Shows countdown for future reset');
}

{
  const past = new Date(Date.now() - 1000);
  const output = renderUsage({
    rolling_usage: 0, weekly_usage: 0, monthly_usage: 0,
    limit_rolling: 12, limit_weekly: 30, limit_monthly: 60,
    reset_time: past
  });
  assert(output.includes('Resetting'), 'Shows resetting message for past reset time');
}

// ── Database Query ──────────────────────────────────────

(async () => {
console.log('\n── Database ──');

{
  const result = await runUsage();
  assert(typeof result === 'string' && result.includes('OpenCode API Usage'),
    'runUsage returns rendered output from real DB');
  assert(result.includes('Rolling 5h') || result.includes('OpenCode database'),
    'Returns bars or DB-not-found error');
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
})();
