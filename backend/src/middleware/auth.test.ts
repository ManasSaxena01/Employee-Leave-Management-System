import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test-secret-min-32-chars-xxxxxxxxx'

// Must be set before importing authenticate
vi.stubEnv('JWT_SECRET', TEST_SECRET)

const { authenticate } = await import('./auth.js')

function makeReq(authHeader?: string): Request {
  return { headers: { authorization: authHeader } } as unknown as Request
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

describe('authenticate middleware', () => {
  const next: NextFunction = vi.fn()

  beforeEach(() => { vi.clearAllMocks() })

  afterEach(() => { vi.restoreAllMocks() })

  it('returns 401 when no Authorization header is present', () => {
    const req = makeReq()
    const res = makeRes()
    authenticate(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header is not Bearer', () => {
    const req = makeReq('Basic sometoken')
    const res = makeRes()
    authenticate(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token is invalid', () => {
    const req = makeReq('Bearer invalidtoken')
    const res = makeRes()
    authenticate(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token is signed with wrong secret', () => {
    const token = jwt.sign({ userId: 'u1', role: 'EMPLOYEE' }, 'wrong-secret', { expiresIn: '15m' })
    const req = makeReq(`Bearer ${token}`)
    const res = makeRes()
    authenticate(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('sets req.user and calls next() for a valid token', () => {
    const token = jwt.sign({ userId: 'u1', role: 'ADMIN' }, TEST_SECRET, { expiresIn: '15m' })
    const req = makeReq(`Bearer ${token}`)
    const res = makeRes()
    authenticate(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect((req as Request & { user?: { userId: string; role: string } }).user).toEqual({
      userId: 'u1',
      role: 'ADMIN'
    })
  })

  it('returns 401 for an expired token', () => {
    const token = jwt.sign({ userId: 'u1', role: 'EMPLOYEE' }, TEST_SECRET, { expiresIn: -1 })
    const req = makeReq(`Bearer ${token}`)
    const res = makeRes()
    authenticate(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
