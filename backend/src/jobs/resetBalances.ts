import { createTask } from 'node-cron'

// node-cron v4: use createTask (does not auto-start); call .start() in server.ts
// Full implementation in Story 3.3
export const resetBalancesJob = createTask(
  '0 0 1 1 *',  // January 1st, midnight in the configured timezone
  async () => {
    console.log('[resetBalances] Annual balance reset triggered')
  },
  { timezone: process.env['CRON_TIMEZONE'] ?? 'UTC' }
)
