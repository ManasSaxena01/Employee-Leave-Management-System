import type { RequestHandler } from 'express'

export function requireRole(roles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }
    next()
  }
}
