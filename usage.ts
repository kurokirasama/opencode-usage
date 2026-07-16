import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface UsageStats {
  rolling_usage: number;
  weekly_usage: number;
  monthly_usage: number;
  limit_rolling: number;
  limit_weekly: number;
  limit_monthly: number;
  reset_time: Date;
}

export interface Credentials {
  workspaceId: string;
  authCookie: string;
}

export function parseConfig(configPath?: string, dedicatedPath?: string): Credentials | string {
  const envWorkspaceId = process.env.OPENCODE_GO_WORKSPACE_ID?.trim();
  const envAuthCookie = process.env.OPENCODE_GO_AUTH_COOKIE?.trim();
  if (envWorkspaceId && envAuthCookie) {
    return { workspaceId: envWorkspaceId, authCookie: envAuthCookie };
  }

  const mainCfgPath = configPath ?? join(homedir(), '.config', 'opencode', 'opencode.json');
  if (existsSync(mainCfgPath)) {
    try {
      const raw = readFileSync(mainCfgPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const quota = parsed['opencode-go-quota'];
      if (quota && typeof quota === 'object') {
        const q = quota as Record<string, unknown>;
        const workspaceId = typeof q.workspaceId === 'string' ? q.workspaceId.trim() : '';
        const authCookie = typeof q.authCookie === 'string' ? q.authCookie.trim() : '';
        if (workspaceId && authCookie) {
          return { workspaceId, authCookie };
        }
      }
    } catch {
      // fall through
    }
  }

  const subCfgPath = dedicatedPath ?? join(homedir(), '.config', 'opencode', 'opencode-quota', 'opencode-go.json');
  if (existsSync(subCfgPath)) {
    try {
      const raw = readFileSync(subCfgPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const workspaceId = typeof parsed.workspaceId === 'string' ? parsed.workspaceId.trim() : '';
      const authCookie = typeof parsed.authCookie === 'string' ? parsed.authCookie.trim() : '';
      if (workspaceId && authCookie) {
        return { workspaceId, authCookie };
      }
    } catch {
      // fall through
    }
  }

  return 'No workspace credentials found. Configure environment variables or settings_opencode.json.';
}

// ── Scraper Engine ─────────────────────────────────────

const DASHBOARD_URL_PREFIX = 'https://opencode.ai/workspace/';
const DASHBOARD_URL_SUFFIX = '/go';

const SCRAPED_NUMBER_PATTERN = String.raw`(-?\d+(?:\.\d+)?)`;
const RE_ROLLING_PCT_FIRST = new RegExp(
  String.raw`rollingUsage:\$R\[\d+\]=\{[^}]*usagePercent:${SCRAPED_NUMBER_PATTERN}[^}]*resetInSec:${SCRAPED_NUMBER_PATTERN}[^}]*\}`
);
const RE_ROLLING_RESET_FIRST = new RegExp(
  String.raw`rollingUsage:\$R\[\d+\]=\{[^}]*resetInSec:${SCRAPED_NUMBER_PATTERN}[^}]*usagePercent:${SCRAPED_NUMBER_PATTERN}[^}]*\}`
);
const RE_WEEKLY_PCT_FIRST = new RegExp(
  String.raw`weeklyUsage:\$R\[\d+\]=\{[^}]*usagePercent:${SCRAPED_NUMBER_PATTERN}[^}]*resetInSec:${SCRAPED_NUMBER_PATTERN}[^}]*\}`
);
const RE_WEEKLY_RESET_FIRST = new RegExp(
  String.raw`weeklyUsage:\$R\[\d+\]=\{[^}]*resetInSec:${SCRAPED_NUMBER_PATTERN}[^}]*usagePercent:${SCRAPED_NUMBER_PATTERN}[^}]*\}`
);
const RE_MONTHLY_PCT_FIRST = new RegExp(
  String.raw`monthlyUsage:\$R\[\d+\]=\{[^}]*usagePercent:${SCRAPED_NUMBER_PATTERN}[^}]*resetInSec:${SCRAPED_NUMBER_PATTERN}[^}]*\}`
);
const RE_MONTHLY_RESET_FIRST = new RegExp(
  String.raw`monthlyUsage:\$R\[\d+\]=\{[^}]*resetInSec:${SCRAPED_NUMBER_PATTERN}[^}]*usagePercent:${SCRAPED_NUMBER_PATTERN}[^}]*\}`
);

export interface ScrapedWindowUsage {
  usagePercent: number;
  resetInSec: number;
}

export function parseHumanReadableTime(timeStr: string): number | null {
  const normalized = timeStr.toLowerCase().trim().replace(/\s+/g, ' ');
  if (['reset-now', 'reset now', 'now', 'resets now'].includes(normalized)) {
    return 0;
  }
  let totalSeconds = 0;
  const dayMatch = normalized.match(/(\d+(?:\.\d+)?)\s*days?/);
  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*hours?/);
  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)\s*minutes?/);
  const secondMatch = normalized.match(/(\d+(?:\.\d+)?)\s*seconds?/);
  const hasDuration = Boolean(dayMatch || hourMatch || minuteMatch || secondMatch);

  if (dayMatch) totalSeconds += Number(dayMatch[1]) * 86400;
  if (hourMatch) totalSeconds += Number(hourMatch[1]) * 3600;
  if (minuteMatch) totalSeconds += Number(minuteMatch[1]) * 60;
  if (secondMatch) totalSeconds += Number(secondMatch[1]);
  return hasDuration ? totalSeconds : null;
}

export function parseWindowUsage(
  html: string,
  rePctFirst: RegExp,
  reResetFirst: RegExp,
): ScrapedWindowUsage | null {
  const pctFirstMatch = rePctFirst.exec(html);
  if (pctFirstMatch) {
    const usagePercent = Number(pctFirstMatch[1]);
    const resetInSec = Number(pctFirstMatch[2]);
    if (Number.isFinite(usagePercent) && Number.isFinite(resetInSec)) {
      return { usagePercent, resetInSec };
    }
  }
  const resetFirstMatch = reResetFirst.exec(html);
  if (resetFirstMatch) {
    const resetInSec = Number(resetFirstMatch[1]);
    const usagePercent = Number(resetFirstMatch[2]);
    if (Number.isFinite(usagePercent) && Number.isFinite(resetInSec)) {
      return { usagePercent, resetInSec };
    }
  }
  return null;
}

export function parseDataSlotFormat(html: string): Partial<Record<string, ScrapedWindowUsage>> {
  const result: Partial<Record<string, ScrapedWindowUsage>> = {};
  const items = html.split(/data-slot="usage-item"/);
  for (let i = 1; i < items.length; i++) {
    const content = items[i];
    const labelMatch = content.match(/data-slot="usage-label">([^<]+)</);
    if (!labelMatch) continue;
    const label = labelMatch[1].trim().toLowerCase();

    const usageMatch = content.match(/data-slot="usage-value">[^0-9]*(\d+(?:\.\d+)?)/);
    if (!usageMatch) continue;
    const usagePercent = Number(usageMatch[1]);

    const resetMatch = content.match(/data-slot="(reset-time|reset-now)">([\s\S]*?)<\/span>/);
    if (!resetMatch) continue;

    const resetContent = resetMatch[2]
      .replace(/<!--\$-->/g, '')
      .replace(/<!--\/-->/g, '')
      .replace(/Resets?\s*in\s*/i, '')
      .trim();

    const resetInSec = resetMatch[1] === 'reset-now' ? 0 : parseHumanReadableTime(resetContent);
    if (!Number.isFinite(usagePercent) || resetInSec === null || !Number.isFinite(resetInSec)) continue;

    let windowKey: string | null = null;
    if (label.includes('rolling')) windowKey = 'rolling';
    else if (label.includes('weekly')) windowKey = 'weekly';
    else if (label.includes('monthly')) windowKey = 'monthly';

    if (windowKey) {
      result[windowKey] = { usagePercent, resetInSec };
    }
  }
  return result;
}

export async function fetchUsageFromDashboard(
  workspaceId: string,
  authCookie: string,
  fetchFn = fetch
): Promise<UsageStats | string> {
  const url = `${DASHBOARD_URL_PREFIX}${encodeURIComponent(workspaceId)}${DASHBOARD_URL_SUFFIX}`;
  try {
    const res = await fetchFn(url, {
      headers: {
        Accept: 'text/html',
        Cookie: `auth=${authCookie}`,
      }
    });
    if (!res.ok) {
      return `Scraper error ${res.status}: ${res.statusText}`;
    }
    const html = await res.text();

    const rolling = parseWindowUsage(html, RE_ROLLING_PCT_FIRST, RE_ROLLING_RESET_FIRST);
    const weekly = parseWindowUsage(html, RE_WEEKLY_PCT_FIRST, RE_WEEKLY_RESET_FIRST);
    const monthly = parseWindowUsage(html, RE_MONTHLY_PCT_FIRST, RE_MONTHLY_RESET_FIRST);

    const dataSlot = parseDataSlotFormat(html);

    const finalRolling = rolling || dataSlot.rolling;
    const finalWeekly = weekly || dataSlot.weekly;
    const finalMonthly = monthly || dataSlot.monthly;

    if (!finalRolling && !finalWeekly && !finalMonthly) {
      return 'Could not parse any known OpenCode Go dashboard usage windows.';
    }

    const now = Date.now();
    return {
      rolling_usage: finalRolling ? Math.round((finalRolling.usagePercent / 100) * 12 * 100) / 100 : 0,
      weekly_usage: finalWeekly ? Math.round((finalWeekly.usagePercent / 100) * 30 * 100) / 100 : 0,
      monthly_usage: finalMonthly ? Math.round((finalMonthly.usagePercent / 100) * 60 * 100) / 100 : 0,
      limit_rolling: 12,
      limit_weekly: 30,
      limit_monthly: 60,
      reset_time: finalRolling
        ? new Date(now + finalRolling.resetInSec * 1000)
        : new Date(now + 5 * 3600 * 1000),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Dashboard connection failure: ${msg}`;
  }
}

// ── SQLite Fallback Engine ─────────────────────────────

export async function queryUsageLocal(dbPath?: string): Promise<UsageStats | string> {
  const path = dbPath ?? join(homedir(), '.local', 'share', 'opencode', 'opencode.db');
  if (!existsSync(path)) {
    return `OpenCode local database not found at ${path}`;
  }

  let db: { prepare: (sql: string) => { get: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown[] }; close: () => void };
  try {
    try {
      const mod = await import('bun:sqlite');
      const Database = (mod as Record<string, unknown>).Database as new (path: string, opts?: Record<string, unknown>) => {
        prepare: (sql: string) => { get: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown[] };
        close: () => void;
      };
      db = new Database(path, { readonly: true }) as unknown as typeof db;
    } catch {
      const { DatabaseSync } = await import('node:sqlite');
      db = new DatabaseSync(path) as unknown as typeof db;
    }
  } catch {
    return 'No SQLite database drivers available in this environment.';
  }

  try {
    const now = Date.now();
    const rollingStart = now - 5 * 3600 * 1000;
    const weeklyStart = now - 7 * 86400 * 1000;
    const d = new Date();
    const monthlyStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

    const getOne = (sql: string, params: unknown[]) => {
      const stmt = db.prepare(sql);
      if (typeof (stmt as Record<string, unknown>).get === 'function') {
        return (stmt as Record<string, unknown>).get(...params) as Record<string, unknown> | undefined;
      }
      return (stmt.all(...params) as Record<string, unknown>[])[0];
    };

    const rolling = getOne(
      'SELECT COALESCE(SUM(cost), 0) AS total, MIN(time_created) AS oldest FROM session WHERE time_created > ?',
      [rollingStart]
    );
    const weekly = getOne(
      'SELECT COALESCE(SUM(cost), 0) AS total FROM session WHERE time_created > ?',
      [weeklyStart]
    );
    const monthly = getOne(
      'SELECT COALESCE(SUM(cost), 0) AS total FROM session WHERE time_created > ?',
      [monthlyStart]
    );

    const rollingCost = Number(rolling?.total ?? 0);
    const oldest = rolling?.oldest != null ? Number(rolling.oldest) : 0;

    let reset_time: Date;
    if (oldest > 0) {
      reset_time = new Date(oldest + 5 * 3600 * 1000);
    } else {
      reset_time = new Date(now + 5 * 3600 * 1000);
    }

    return {
      rolling_usage: rollingCost,
      weekly_usage: Number(weekly?.total ?? 0),
      monthly_usage: Number(monthly?.total ?? 0),
      limit_rolling: 12,
      limit_weekly: 30,
      limit_monthly: 60,
      reset_time,
    };
  } finally {
    try { db.close(); } catch { /* ignore */ }
  }
}

const FULL = '█';
const EMPTY = '░';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

export function renderProgressBar(
  current: number,
  limit: number,
  label: string,
  termWidth = 80
): string {
  const pct = limit > 0 ? Math.min(current / limit, 1) : 0;
  const pctStr = `${Math.round(pct * 100)}%`;
  const color = pct <= 0.75 ? GREEN : pct <= 0.95 ? YELLOW : RED;
  const curStr = `$${current.toFixed(2)}`;
  const limStr = `$${limit.toFixed(2)}`;
  const header = `${label}:`;
  const amount = `${curStr} / ${limStr}`;

  const overhead = 28;
  const barWidth = Math.max(5, Math.min(40, termWidth - overhead));
  const filled = Math.round(pct * barWidth);
  const empty = barWidth - filled;

  return `${color}${header} ${BOLD}${FULL.repeat(filled)}${DIM}${EMPTY.repeat(empty)}${RESET}${color} ${amount} (${pctStr})${RESET}`;
}

export function renderUsage(stats: UsageStats, termWidth = 80): string {
  const bars = [
    renderProgressBar(stats.rolling_usage, stats.limit_rolling, 'Rolling 5h', termWidth),
    renderProgressBar(stats.weekly_usage, stats.limit_weekly, 'Weekly', termWidth),
    renderProgressBar(stats.monthly_usage, stats.limit_monthly, 'Monthly', termWidth),
  ];

  const now = Date.now();
  const diff = stats.reset_time.getTime() - now;
  let countdown: string;
  if (diff <= 0) {
    countdown = 'Resetting now';
  } else {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    countdown = h > 0 ? `Resets in ${h}h ${m}m` : `Resets in ${m}m`;
  }

  return `${BOLD}OpenCode API Usage${RESET}\n${bars.join('\n')}\n${DIM}${countdown}${RESET}`;
}

export async function runUsage(fetchFn = fetch): Promise<string> {
  const creds = parseConfig();
  if (typeof creds !== 'string') {
    const stats = await fetchUsageFromDashboard(creds.workspaceId, creds.authCookie, fetchFn);
    if (typeof stats !== 'string') {
      const termWidth = typeof process !== 'undefined' && process.stdout?.columns
        ? process.stdout.columns : 80;
      return renderUsage(stats, termWidth);
    }
    // ponytail: scraper failed — fall through to SQLite fallback
  }

  const localStats = await queryUsageLocal();
  if (typeof localStats === 'string') return localStats;
  const termWidth = typeof process !== 'undefined' && process.stdout?.columns
    ? process.stdout.columns : 80;
  return renderUsage(localStats, termWidth);
}
