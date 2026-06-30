import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../env.js'

export const authenticate: RequestHandler = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId?: unknown; role?: unknown }
    if (typeof payload.userId !== 'string' || typeof payload.role !== 'string') {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    req.user = { userId: payload.userId, role: payload.role }
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Unauthorized' })
  }
}
