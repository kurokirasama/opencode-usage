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

interface Credentials {
  apiKey: string;
  workspaceId: string;
}

export function parseConfig(configPath?: string, authPath?: string): Credentials | string {
  const envKey = process.env.OPENCODE_API_KEY?.trim();
  if (envKey) {
    return { apiKey: envKey, workspaceId: 'wrk_01KVS459SHCESGB9J1W46T6BD5' };
  }

  const authFile = authPath ?? join(homedir(), '.local', 'share', 'opencode', 'auth.json');
  if (authPath !== '' && existsSync(authFile)) {
    try {
      const raw = readFileSync(authFile, 'utf-8');
      const auth = JSON.parse(raw) as Record<string, unknown>;
      for (const provider of ['opencode-go', 'opencode-zen', 'opencode']) {
        const entry = auth[provider];
        if (typeof entry === 'object' && entry !== null) {
          const key = (entry as Record<string, unknown>).key;
          if (typeof key === 'string' && key) {
            return { apiKey: key, workspaceId: 'wrk_01KVS459SHCESGB9J1W46T6BD5' };
          }
        }
      }
    } catch {
      // fall through to config file
    }
  }

  const cfgPath = configPath ?? join(homedir(), '.config', 'opencode', 'opencode.json');
  let raw: string;
  try {
    raw = readFileSync(cfgPath, 'utf-8');
  } catch {
    return 'OpenCode config not found at ' + cfgPath;
  }

  let config: unknown;
  try {
    config = JSON.parse(raw);
  } catch {
    return 'Failed to parse OpenCode config. The file may be corrupted.';
  }

  if (typeof config !== 'object' || config === null) {
    return 'No OpenCode API key found in config.';
  }

  const cfg = config as Record<string, unknown>;
  const provider = cfg.provider;
  if (typeof provider !== 'object' || provider === null) {
    return 'No OpenCode API key found in config.';
  }

  const providers = provider as Record<string, unknown>;
  let matchedProvider: Record<string, unknown> | null = null;

  if ('opencode-go' in providers) {
    matchedProvider = providers['opencode-go'] as Record<string, unknown>;
  } else if ('opencode-zen' in providers) {
    matchedProvider = providers['opencode-zen'] as Record<string, unknown>;
  }

  if (!matchedProvider || typeof matchedProvider.apiKey !== 'string') {
    return 'No OpenCode API key found in config.';
  }

  const workspaceId = typeof matchedProvider.workspaceId === 'string'
    ? matchedProvider.workspaceId
    : 'wrk_01KVS459SHCESGB9J1W46T6BD5';

  return { apiKey: matchedProvider.apiKey, workspaceId };
}

export async function fetchUsageStats(
  apiKey: string,
  workspaceId: string,
  fetchFn = fetch
): Promise<UsageStats | string> {
  const url = `https://opencode.ai/api/workspace/${workspaceId}/usage`;
  let response: Response;
  try {
    response = await fetchFn(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Failed to reach OpenCode API: ${msg}`;
  }

  if (response.status !== 200) {
    return `OpenCode API returned status ${response.status}.`;
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch {
    return 'Received unexpected API response. Usage data may be incomplete.';
  }

  const num = (key: string) => typeof data[key] === 'number' ? data[key] as number : 0;

  let reset_time: Date;
  const rt = data.reset_time;
  if (typeof rt === 'string') {
    reset_time = new Date(rt);
  } else if (typeof rt === 'number') {
    reset_time = new Date(Date.now() + rt * 1000);
  } else {
    reset_time = new Date();
  }

  return {
    rolling_usage: num('rolling_usage'),
    weekly_usage: num('weekly_usage'),
    monthly_usage: num('monthly_usage'),
    limit_rolling: num('limit_rolling'),
    limit_weekly: num('limit_weekly'),
    limit_monthly: num('limit_monthly'),
    reset_time,
  };
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
  if (typeof creds === 'string') return creds;
  const stats = await fetchUsageStats(creds.apiKey, creds.workspaceId, fetchFn);
  if (typeof stats === 'string') return stats;
  const termWidth = typeof process !== 'undefined' && process.stdout?.columns
    ? process.stdout.columns : 80;
  return renderUsage(stats, termWidth);
}

export const UsagePlugin = async () => {
  const { tool } = await import('@opencode-ai/plugin');
  return {
    tool: {
      usage: tool({
        description: 'Fetch and display your OpenCode API quota usage (5h rolling, weekly, monthly).',
        args: {},
        async execute() {
          return await runUsage();
        },
      }),
    },
  };
};
