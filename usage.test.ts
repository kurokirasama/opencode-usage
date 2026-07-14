import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { parseConfig, fetchUsageStats, renderProgressBar, renderUsage, runUsage, UsagePlugin } from './usage.js';

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

// ── Tests ──────────────────────────────────────────────

// 1: Missing config file
const missingPath = join(tmpDir, 'opencode-nonexistent.json');
console.log('\n── Phase 1: Config Parsing ──');
{
  clean(missingPath);
  const result = parseConfig(missingPath, '');
  eq(typeof result, 'string', 'Returns error string when config is missing');
}

// 2: Valid opencode-go config with workspace ID
{
  const cfg = join(tmpDir, 'opencode-go-workspace.json');
  makeConfig(cfg, {
    provider: {
      'opencode-go': {
        apiKey: 'key-go-123',
        workspaceId: 'wrk_custom'
      }
    }
  });
  const result = parseConfig(cfg, '');
  assert(typeof result === 'object', 'Returns object for valid opencode-go config');
  if (typeof result === 'object') {
    eq(result.apiKey, 'key-go-123', 'Extracts apiKey from opencode-go');
    eq(result.workspaceId, 'wrk_custom', 'Reads workspaceId when present');
  }
  clean(cfg);
}

// 3: Valid opencode-zen config WITHOUT workspace ID → fallback
{
  const cfg = join(tmpDir, 'opencode-zen-no-workspace.json');
  makeConfig(cfg, {
    provider: {
      'opencode-zen': {
        apiKey: 'key-zen-456'
      }
    }
  });
  const result = parseConfig(cfg, '');
  assert(typeof result === 'object', 'Returns object for valid opencode-zen config');
  if (typeof result === 'object') {
    eq(result.apiKey, 'key-zen-456', 'Extracts apiKey from opencode-zen');
    eq(result.workspaceId, 'wrk_01KVS459SHCESGB9J1W46T6BD5', 'Falls back to hardcoded workspace ID');
  }
  clean(cfg);
}

// 4: No valid provider
{
  const cfg = join(tmpDir, 'opencode-no-provider.json');
  makeConfig(cfg, { provider: { someOther: { apiKey: 'nope' } } });
  const result = parseConfig(cfg, '');
  eq(typeof result, 'string', 'Returns error string when no matching provider found');
  eq(result, 'No OpenCode API key found in config.', 'Correct error message for missing provider');
  clean(cfg);
}

// 5: Config with both providers — picks first match (go preferred)
{
  const cfg = join(tmpDir, 'opencode-both.json');
  makeConfig(cfg, {
    provider: {
      'opencode-go': { apiKey: 'go-first' },
      'opencode-zen': { apiKey: 'zen-second' }
    }
  });
  const result = parseConfig(cfg, '');
  assert(typeof result === 'object', 'Returns object for config with both providers');
  if (typeof result === 'object') {
    eq(result.apiKey, 'go-first', 'Picks opencode-go when both are present');
  }
  clean(cfg);
}

// 6: Malformed JSON
{
  const cfg = join(tmpDir, 'opencode-malformed.json');
  writeFileSync(cfg, '{ broken json }');
  const result = parseConfig(cfg, '');
  eq(typeof result, 'string', 'Returns error string for malformed JSON');
  clean(cfg);
}

// ── Phase 2: API Fetching ──────────────────────────────

interface MockResponse {
  status: number;
  json: () => Promise<unknown>;
}

function mockFetch(response: MockResponse): typeof fetch {
  return (async () => response) as unknown as typeof fetch;
}

(async () => {
console.log('\n── Phase 2: API Fetching ──');

// 1: Valid response with all fields
{
  const fetchFn = mockFetch({
    status: 200,
    json: async () => ({
      rolling_usage: 6.84,
      weekly_usage: 8.20,
      monthly_usage: 8.20,
      limit_rolling: 12,
      limit_weekly: 30,
      limit_monthly: 60,
      reset_time: '2026-07-13T08:00:00Z'
    })
  });
  const result = await fetchUsageStats('key-test', 'wrk_test', fetchFn);
  assert(typeof result === 'object', 'Returns object for valid API response');
  if (typeof result === 'object') {
    eq(result.rolling_usage, 6.84, 'Parses rolling_usage correctly');
    eq(result.weekly_usage, 8.20, 'Parses weekly_usage correctly');
    eq(result.monthly_usage, 8.20, 'Parses monthly_usage correctly');
    eq(result.limit_rolling, 12, 'Parses limit_rolling correctly');
    eq(result.limit_weekly, 30, 'Parses limit_weekly correctly');
    eq(result.limit_monthly, 60, 'Parses limit_monthly correctly');
    assert(result.reset_time instanceof Date, 'Parses reset_time as Date');
  }
}

// 2: Partial response — missing fields default to 0
{
  const fetchFn = mockFetch({
    status: 200,
    json: async () => ({ rolling_usage: 1.5 })
  });
  const result = await fetchUsageStats('key', 'wrk', fetchFn);
  assert(typeof result === 'object', 'Returns object for partial API response');
  if (typeof result === 'object') {
    eq(result.rolling_usage, 1.5, 'Parses rolling_usage from partial response');
    eq(result.weekly_usage, 0, 'Defaults missing weekly_usage to 0');
    eq(result.monthly_usage, 0, 'Defaults missing monthly_usage to 0');
    eq(result.limit_rolling, 0, 'Defaults missing limit_rolling to 0');
    eq(result.limit_weekly, 0, 'Defaults missing limit_weekly to 0');
    eq(result.limit_monthly, 0, 'Defaults missing limit_monthly to 0');
  }
}

// 3: reset_time as seconds-until-reset (number)
{
  const fetchFn = mockFetch({
    status: 200,
    json: async () => ({ reset_time: 7200 })
  });
  const result = await fetchUsageStats('key', 'wrk', fetchFn);
  assert(typeof result === 'object', 'Returns object when reset_time is seconds');
  if (typeof result === 'object') {
    assert(result.reset_time instanceof Date, 'Parses numeric reset_time as Date');
  }
}

// 4: Network failure
{
  const fetchFn = (async () => { throw new Error('connect ECONNREFUSED'); }) as unknown as typeof fetch;
  const result = await fetchUsageStats('key', 'wrk', fetchFn);
  eq(typeof result, 'string', 'Returns error string on network failure');
}

// 5: Non-200 HTTP status
{
  const fetchFn = mockFetch({
    status: 401,
    json: async () => ({ error: 'unauthorized' })
  });
  const result = await fetchUsageStats('key', 'wrk', fetchFn);
  eq(typeof result, 'string', 'Returns error string on non-200 status');
}

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

// Phase 2b: Credential discovery — env var
{
  process.env.OPENCODE_API_KEY = 'env-key-123';
  const result = parseConfig('/nonexistent/config.json');
  assert(typeof result === 'object', 'OPENCODE_API_KEY: returns credentials object');
  if (typeof result === 'object') {
    eq(result.apiKey, 'env-key-123', 'OPENCODE_API_KEY: uses env var value');
  }
  delete process.env.OPENCODE_API_KEY;
}

// Phase 2b: Real auth file exists check (informational)
{
  const authPath = join(homedir(), '.local', 'share', 'opencode', 'auth.json');
  if (existsSync(authPath)) {
    const result = parseConfig('/nonexistent/config.json', authPath);
    assert(typeof result === 'object', 'real auth.json: found credentials');
  }
}

// ── Phase 4: Plugin Integration ────────────────────────

console.log('\n── Phase 4: Plugin Integration ──');

// 1: Plugin exports a function
{
  assert(typeof UsagePlugin === 'function', 'UsagePlugin is a function');
}

// 2: runUsage pipeline with mocked fetch
{
  process.env.OPENCODE_API_KEY = 'test-key';
  const fetchFn = mockFetch({
    status: 200,
    json: async () => ({
      rolling_usage: 6.84,
      weekly_usage: 8.20,
      monthly_usage: 8.20,
      limit_rolling: 12,
      limit_weekly: 30,
      limit_monthly: 60,
      reset_time: new Date(Date.now() + 7200 * 1000).toISOString()
    })
  });
  const result = await runUsage(fetchFn);
  delete process.env.OPENCODE_API_KEY;
  assert(typeof result === 'string' && result.includes('OpenCode API Usage'), 'runUsage returns rendered output');
  assert(result.includes('Rolling 5h'), 'runUsage output includes rolling bar');
  assert(result.includes('Resets in'), 'runUsage output includes countdown');
}

// ── Phase 5: Error Handling ────────────────────────────

console.log('\n── Phase 5: Error Handling ──');

// 1: Config is valid JSON but lacks provider entries
{
  const cfg = join(tmpDir, 'opencode-no-provider-entries.json');
  makeConfig(cfg, { model: 'opencode-go/something' });
  const result = parseConfig(cfg, '');
  eq(typeof result, 'string', 'Returns error for config without provider section');
  clean(cfg);
}

// 2: API returns HTML (Content-Type text/html) instead of JSON
{
  const fetchFn = (async () => ({
    status: 200,
    json: async () => { throw new Error('Not JSON'); }
  })) as unknown as typeof fetch;
  const result = await fetchUsageStats('key', 'wrk', fetchFn);
  eq(typeof result, 'string', 'Returns error when response is not JSON');
  assert((result as string).includes('unexpected'), 'Error message mentions unexpected response');
}

// 3: API returns empty object {} → all zeros
{
  const fetchFn = mockFetch({ status: 200, json: async () => ({}) });
  const result = await fetchUsageStats('key', 'wrk', fetchFn);
  assert(typeof result === 'object', 'Returns object for empty API response');
  if (typeof result === 'object') {
    eq(result.rolling_usage, 0, 'Empty response: rolling defaults to 0');
    eq(result.limit_rolling, 0, 'Empty response: limit defaults to 0');
  }
}

// 4: Malformed JSON in config
{
  const cfg = join(tmpDir, 'opencode-bad-json.json');
  writeFileSync(cfg, '{ not json at all }');
  const result = parseConfig(cfg, '');
  eq(typeof result, 'string', 'Returns error for malformed config JSON');
  clean(cfg);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
})();
