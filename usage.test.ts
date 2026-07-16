import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { parseConfig, parseHumanReadableTime, parseWindowUsage, parseDataSlotFormat, fetchUsageFromDashboard, renderProgressBar, renderUsage, runUsage, queryUsageLocal } from './usage.js';
import type { UsageStats } from './usage.js';

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

const tmpDir = tmpdir();

function makeConfig(filename: string, obj: object) {
  writeFileSync(filename, JSON.stringify(obj));
}

function clean(filename: string) {
  if (existsSync(filename)) unlinkSync(filename);
}

// ponytail: all imports consolidated at top of file

// ── Tests ──────────────────────────────────────────────

// ── Phase 1: Scraper Config Parsing (refactored) ──
console.log('\n── Phase 1: Scraper Config Parsing ──');

// 1: Env vars OPENCODE_GO_WORKSPACE_ID + OPENCODE_GO_AUTH_COOKIE
{
  process.env.OPENCODE_GO_WORKSPACE_ID = 'wrk_env123';
  process.env.OPENCODE_GO_AUTH_COOKIE = 'cookie_env123';
  const result = parseConfig('/nonexistent.json');
  assert(typeof result === 'object', 'env: returns object for valid env vars');
  if (typeof result === 'object') {
    eq(result.workspaceId, 'wrk_env123', 'env: reads workspaceId from env');
    eq(result.authCookie, 'cookie_env123', 'env: reads authCookie from env');
  }
  delete process.env.OPENCODE_GO_WORKSPACE_ID;
  delete process.env.OPENCODE_GO_AUTH_COOKIE;
}

// 2: Env vars — only workspaceId set (missing authCookie → not enough)
{
  process.env.OPENCODE_GO_WORKSPACE_ID = 'wrk_partial';
  const result = parseConfig('/nonexistent.json');
  eq(typeof result, 'string', 'env partial: returns error when only workspaceId set');
  delete process.env.OPENCODE_GO_WORKSPACE_ID;
}

// 3: Main opencode.json config with opencode-go-quota key
{
  const cfg = join(tmpDir, 'opencode-quota-main.json');
  makeConfig(cfg, {
    model: 'some-model',
    'opencode-go-quota': {
      workspaceId: 'wrk_main123',
      authCookie: 'cookie_mainABC'
    }
  });
  const result = parseConfig(cfg);
  assert(typeof result === 'object', 'main config: returns object for valid quota section');
  if (typeof result === 'object') {
    eq(result.workspaceId, 'wrk_main123', 'main config: reads workspaceId');
    eq(result.authCookie, 'cookie_mainABC', 'main config: reads authCookie');
  }
  clean(cfg);
}

// 4: Main config with opencode-go-quota but missing authCookie
{
  const cfg = join(tmpDir, 'opencode-quota-incomplete.json');
  makeConfig(cfg, {
    'opencode-go-quota': {
      workspaceId: 'wrk_only'
    }
  });
  const result = parseConfig(cfg);
  eq(typeof result, 'string', 'main config incomplete: returns error when authCookie missing');
  clean(cfg);
}

// 5: Dedicated opencode-quota/opencode-go.json file
{
  const cfg = join(tmpDir, 'opencode-quota-dedicated.json');
  makeConfig(cfg, {
    workspaceId: 'wrk_dedicated',
    authCookie: 'cookie_dedicated'
  });
  const result = parseConfig('/nonexistent.json', cfg);
  assert(typeof result === 'object', 'dedicated file: returns object for valid quota json');
  if (typeof result === 'object') {
    eq(result.workspaceId, 'wrk_dedicated', 'dedicated file: reads workspaceId');
    eq(result.authCookie, 'cookie_dedicated', 'dedicated file: reads authCookie');
  }
  clean(cfg);
}

// 6: No credentials anywhere
{
  const result = parseConfig('/nonexistent.json');
  eq(typeof result, 'string', 'no creds: returns error string when nothing found');
  assert((result as string).includes('No workspace credentials'), 'no creds: mentions missing credentials');
}

// ── Phase 2: Scraper Engine ─────────────────────────────

(async () => {

console.log('\n── Phase 2: Scraper Engine ──');

// parseHumanReadableTime
{
  eq(parseHumanReadableTime('26 days 17 hours'), 26 * 86400 + 17 * 3600, 'parseHumanReadableTime: days+hours');
  eq(parseHumanReadableTime('Resets now'), 0, 'parseHumanReadableTime: resets now → 0');
  eq(parseHumanReadableTime('reset now'), 0, 'parseHumanReadableTime: reset now (lowercase) → 0');
  eq(parseHumanReadableTime('Now'), 0, 'parseHumanReadableTime: Now → 0');
  eq(parseHumanReadableTime('3 hours 45 minutes'), 3 * 3600 + 45 * 60, 'parseHumanReadableTime: hours+minutes');
  eq(parseHumanReadableTime('30 seconds'), 30, 'parseHumanReadableTime: seconds');
  eq(parseHumanReadableTime('garbage'), null, 'parseHumanReadableTime: garbage → null');
  eq(parseHumanReadableTime(''), null, 'parseHumanReadableTime: empty → null');
}

// parseDataSlotFormat — mock HTML with data-slot attributes
{
  const html = `
    <div data-slot="usage-item">
      <span data-slot="usage-label">Rolling 5h</span>
      <span data-slot="usage-value">Used $8.50 of $12.00 (70.83%)</span>
      <span data-slot="reset-time">Resets in 4 hours 12 minutes</span>
    </div>
    <div data-slot="usage-item">
      <span data-slot="usage-label">Weekly</span>
      <span data-slot="usage-value">Used $15.00 of $30.00 (50.00%)</span>
      <span data-slot="reset-time">Resets in 3 days 6 hours</span>
    </div>
    <div data-slot="usage-item">
      <span data-slot="usage-label">Monthly</span>
      <span data-slot="usage-value">Used $22.00 of $60.00 (36.67%)</span>
      <span data-slot="reset-now">0 seconds</span>
    </div>
  `;
  const result = parseDataSlotFormat(html);
  eq(typeof result.rolling?.usagePercent, 'number', 'data-slot: rolling percent is number');
  eq(typeof result.weekly?.usagePercent, 'number', 'data-slot: weekly percent is number');
  eq(typeof result.monthly?.usagePercent, 'number', 'data-slot: monthly percent is number');
  assert(result.rolling != null, 'data-slot: rolling window parsed');
  if (result.rolling) {
    eq(result.rolling.resetInSec > 0, true, 'data-slot: rolling has positive reset');
  }
  eq(result.monthly?.resetInSec, 0, 'data-slot: monthly reset-now → 0');
}

// parseDataSlotFormat — empty input
{
  const result = parseDataSlotFormat('<div>no usage items here</div>');
  eq(Object.keys(result).length, 0, 'data-slot empty: returns empty object');
}

// fetchUsageFromDashboard — mock SolidJS SSR HTML
{
  const mockHtml = `
    rollingUsage:$R[0]={usageLimit:12,usageTotal:8.50,usagePercent:70.83,resetInSec:15120}
    weeklyUsage:$R[1]={usageLimit:30,usageTotal:15.00,usagePercent:50.00,resetInSec:280800}
    monthlyUsage:$R[2]={usageLimit:60,usageTotal:22.00,usagePercent:36.67,resetInSec:280800}
  `;
  const mockFetch = (async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => mockHtml,
  })) as unknown as typeof fetch;
  const result = await fetchUsageFromDashboard('wrk_test', 'cookie_test', mockFetch);
  assert(typeof result === 'object', 'fetchDashboard: returns object for SSR HTML');
  if (typeof result === 'object') {
    eq(result.rolling_usage, 8.50, 'fetchDashboard: rolling usage from SSR');
    eq(result.weekly_usage, 15.00, 'fetchDashboard: weekly usage from SSR');
    eq(result.monthly_usage, 22.00, 'fetchDashboard: monthly usage from SSR');
    eq(result.limit_rolling, 12, 'fetchDashboard: rolling limit');
    eq(result.limit_weekly, 30, 'fetchDashboard: weekly limit');
    eq(result.limit_monthly, 60, 'fetchDashboard: monthly limit');
    assert(result.reset_time instanceof Date, 'fetchDashboard: reset_time is Date');
  }
}

// fetchUsageFromDashboard — HTTP error
{
  const mockFetch = (async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => '',
  })) as unknown as typeof fetch;
  const result = await fetchUsageFromDashboard('wrk', 'bad_cookie', mockFetch);
  eq(typeof result, 'string', 'fetchDashboard: returns error string on 401');
}

// fetchUsageFromDashboard — network failure
{
  const mockFetch = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
  const result = await fetchUsageFromDashboard('wrk', 'cookie', mockFetch);
  eq(typeof result, 'string', 'fetchDashboard: returns error string on network failure');
}

// ── SQLite Fallback ────────────────────────────────────

console.log('\n── SQLite Fallback ──');

{
  const result = await queryUsageLocal('/nonexistent/db.sqlite');
  eq(typeof result, 'string', 'sqlite: returns error for nonexistent DB');
  assert((result as string).includes('not found'), 'sqlite: error mentions not found');
}

{
  const dbPath = join(homedir(), '.local', 'share', 'opencode', 'opencode.db');
  if (existsSync(dbPath)) {
    const result = await queryUsageLocal(dbPath);
    if (typeof result === 'object') {
      assert(typeof result.rolling_usage === 'number', 'sqlite real: rolling_usage is number');
      assert(typeof result.weekly_usage === 'number', 'sqlite real: weekly_usage is number');
      assert(typeof result.monthly_usage === 'number', 'sqlite real: monthly_usage is number');
      assert(result.reset_time instanceof Date, 'sqlite real: reset_time is Date');
      console.log(`  INFO: SQLite — rolling=$${result.rolling_usage.toFixed(2)}, weekly=$${result.weekly_usage.toFixed(2)}, monthly=$${result.monthly_usage.toFixed(2)}`);
    } else {
      console.log(`  INFO: SQLite returned: ${result}`);
    }
  }
}

})();

(async () => {

// ── Phase 3: Rendering ─────────────────────────────────

console.log('\n── Phase 3: Rendering ──');

// 1: Green bar (≤75%)
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

// 2: Yellow bar (75-95%)
{
  const bar = renderProgressBar(10, 12, 'Test', 90);
  assert(bar.includes('\x1b[33m'), 'Yellow ANSI code for 75-95% usage');
}

// 3: Red bar (>95%)
{
  const bar = renderProgressBar(12, 12, 'Test', 90);
  assert(bar.includes('\x1b[31m'), 'Red ANSI code for >95% usage');
}

// 4: Dynamic width scaling
{
  const wide = renderProgressBar(5, 10, 'T', 120);
  const narrow = renderProgressBar(5, 10, 'T', 60);
  assert(wide.length > narrow.length, 'Wider terminal produces longer bar');
}

// 5: Dollar formatting
{
  const bar = renderProgressBar(4.2, 10, 'T', 90);
  assert(bar.includes('$4.20'), 'Formats to two decimal places');
}

// 6: Zero limit handled
{
  const bar = renderProgressBar(0, 0, 'Zero', 90);
  assert(bar.includes('$0.00'), 'Handles zero limit without division by zero');
}

// 7: renderUsage composes all bars
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

// 8: Reset countdown — future
{
  const future = new Date(Date.now() + 3600 * 1000);
  const output = renderUsage({
    rolling_usage: 0, weekly_usage: 0, monthly_usage: 0,
    limit_rolling: 12, limit_weekly: 30, limit_monthly: 60,
    reset_time: future
  });
  assert(output.includes('Resets in'), 'Shows countdown for future reset');
}

// 9: Reset countdown — past (resetting now)
{
  const past = new Date(Date.now() - 1000);
  const output = renderUsage({
    rolling_usage: 0, weekly_usage: 0, monthly_usage: 0,
    limit_rolling: 12, limit_weekly: 30, limit_monthly: 60,
    reset_time: past
  });
  assert(output.includes('Resetting'), 'Shows resetting message for past reset time');
}

// ── Phase 4: Plugin Integration ────────────────────────
console.log('\n── Phase 4: Plugin Integration ──');

{
  process.env.OPENCODE_GO_WORKSPACE_ID = 'wrk_test_int';
  process.env.OPENCODE_GO_AUTH_COOKIE = 'cookie_test_int';
  const mockHtml = `
    rollingUsage:$R[0]={usageLimit:12,usageTotal:6.84,usagePercent:57.00,resetInSec:7200}
    weeklyUsage:$R[1]={usageLimit:30,usageTotal:8.20,usagePercent:27.33,resetInSec:7200}
    monthlyUsage:$R[2]={usageLimit:60,usageTotal:8.20,usagePercent:13.67,resetInSec:7200}
  `;
  const mockFetch = (async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => mockHtml,
  })) as unknown as typeof fetch;
  const result = await runUsage(mockFetch);
  delete process.env.OPENCODE_GO_WORKSPACE_ID;
  delete process.env.OPENCODE_GO_AUTH_COOKIE;
  assert(typeof result === 'string' && result.includes('OpenCode API Usage'), 'runUsage returns rendered output');
  assert(result.includes('Rolling 5h'), 'runUsage output includes rolling bar');
  assert(result.includes('Resets in'), 'runUsage output includes countdown');
}

// ── Phase 5: Error Handling ────────────────────────────
console.log('\n── Phase 5: Error Handling ──');

{
  const result = parseConfig('/nonexistent.json');
  eq(typeof result, 'string', 'no creds: returns error string');
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
})();
