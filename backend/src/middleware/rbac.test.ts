import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from './rbac.js'

function makeReq(user?: { userId: string; role: string }): Request {
  return { user } as unknown as Request
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

describe('requireRole middleware', () => {
  it('calls next() when user role is in allowed list', () => {
    const next: NextFunction = vi.fn()
    const req = makeReq({ userId: 'u1', role: 'ADMIN' })
    const res = makeRes()
    requireRole(['ADMIN', 'MANAGER'])(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when user role is not in allowed list', () => {
    const next: NextFunction = vi.fn()
    const req = makeReq({ userId: 'u1', role: 'EMPLOYEE' })
    const res = makeRes()
    requireRole(['ADMIN', 'MANAGER'])(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Forbidden' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when req.user is undefined', () => {
    const next: NextFunction = vi.fn()
    const req = makeReq(undefined)
    const res = makeRes()
    requireRole(['ADMIN'])(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() for MANAGER on a MANAGER-only route', () => {
    const next: NextFunction = vi.fn()
    const req = makeReq({ userId: 'u2', role: 'MANAGER' })
    const res = makeRes()
    requireRole(['MANAGER'])(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })
})
