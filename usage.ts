import { homedir } from 'os';
import { join } from 'path';

let SQLite: new (path: string, opts?: { readonly?: boolean }) => {
  prepare(sql: string): { get(...params: unknown[]): unknown; all(...params: unknown[]): unknown[] };
  close(): void;
};
try {
  SQLite = require('bun:sqlite').Database;
} catch {
  SQLite = require('node:sqlite').DatabaseSync;
}

export interface UsageStats {
  rolling_usage: number;
  weekly_usage: number;
  monthly_usage: number;
  limit_rolling: number;
  limit_weekly: number;
  limit_monthly: number;
  reset_time: Date;
}

function queryUsage(dbPath?: string): UsageStats | string {
  const path = dbPath ?? join(homedir(), '.local', 'share', 'opencode', 'opencode.db');
  let db: ReturnType<typeof SQLite.prototype.prepare> extends never ? never : InstanceType<typeof SQLite>;
  try {
    db = new SQLite(path, { readonly: true });
  } catch {
    return 'OpenCode database not found at ' + path;
  }

  try {
    const now = Date.now();
    const rollingStart = now - 5 * 3600 * 1000;
    const weeklyStart = now - 7 * 86400 * 1000;
    const d = new Date();
    const monthlyStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();

    const rolling = db.prepare(
      'SELECT COALESCE(SUM(cost), 0) AS total, MIN(time_created) AS oldest FROM session WHERE time_created > ?'
    ).get(rollingStart) as { total: number; oldest: number | null };

    const weekly = db.prepare(
      'SELECT COALESCE(SUM(cost), 0) AS total FROM session WHERE time_created > ?'
    ).get(weeklyStart) as { total: number };

    const monthly = db.prepare(
      'SELECT COALESCE(SUM(cost), 0) AS total FROM session WHERE time_created > ?'
    ).get(monthlyStart) as { total: number };

    db.close();

    let reset_time: Date;
    if (rolling.oldest != null && rolling.oldest > 0) {
      reset_time = new Date(rolling.oldest + 5 * 3600 * 1000);
    } else {
      reset_time = new Date(now + 5 * 3600 * 1000);
    }

    return {
      rolling_usage: rolling.total,
      weekly_usage: weekly.total,
      monthly_usage: monthly.total,
      limit_rolling: 12,
      limit_weekly: 30,
      limit_monthly: 60,
      reset_time,
    };
  } finally {
    try { db.close(); } catch {}
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

export async function runUsage(): Promise<string> {
  const stats = queryUsage();
  if (typeof stats === 'string') return stats;
  const termWidth = typeof process !== 'undefined' && process.stdout?.columns
    ? process.stdout.columns : 80;
  return renderUsage(stats, termWidth);
}
