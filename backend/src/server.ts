import 'dotenv/config'  // MUST be first — Prisma 7 does not auto-load .env

import { app } from './app.js'
import { resetBalancesJob } from './jobs/resetBalances.js'

const PORT = process.env.PORT ?? 4000

app.listen(PORT, () => {
  console.log(`[server] Backend listening on port ${PORT}`)
  resetBalancesJob.start()
  console.log('[server] Annual balance reset job scheduled')
})
