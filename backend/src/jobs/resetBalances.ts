import { createTask } from 'node-cron'
import { resetAllBalances } from '../services/leaveBalance.js'

export const resetBalancesJob = createTask(
  '0 0 1 1 *',
  async () => {
    console.log('[resetBalances] Annual balance reset started')
    await resetAllBalances()
    console.log('[resetBalances] Annual balance reset completed')
  },
  { timezone: process.env['CRON_TIMEZONE'] ?? 'UTC' }
)
