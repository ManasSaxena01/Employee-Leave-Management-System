import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { router } from './routes/index.js'
import { errorHandler } from './middleware/error.js'

export const app = express()

const allowedOrigins = (process.env['CORS_ORIGIN'] ?? 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(o => o.trim())

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api', router)

// Centralized error handler (must be last middleware)
app.use(errorHandler)
