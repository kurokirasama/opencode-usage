import { tool } from '@opencode-ai/plugin';
import { runUsage } from './usage';

export const UsagePlugin = async (ctx: Record<string, unknown>) => {
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
