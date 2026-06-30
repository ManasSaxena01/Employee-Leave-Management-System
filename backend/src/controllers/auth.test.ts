import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.stubEnv('JWT_SECRET', 'test-secret-min-32-chars-xxxxxxxxx')
vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret-min-32-chars-xxxx')
vi.stubEnv('DATABASE_URL', 'postgresql://fake')

vi.mock('../services/auth.js', () => ({
  login: vi.fn(),
  refreshAccessToken: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('dotenv/config', () => ({}))

import { refreshController, logoutController } from './auth.js'
import { refreshAccessToken, logout } from '../services/auth.js'

function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    clearCookie: vi.fn(),
    cookie: vi.fn(),
  } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

const next: NextFunction = vi.fn()

describe('refreshController', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 and clears cookie when no cookie is present', async () => {
    const req = { headers: {} } as Request
    const res = makeRes()
    await refreshController(req, res, next)
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
    })
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No refresh token' })
    expect(next).not.toHaveBeenCalled()
  })

  it('clears cookie and calls next(err) when refreshAccessToken throws', async () => {
    const err = Object.assign(new Error('Invalid refresh token'), { status: 401 })
    ;(refreshAccessToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err)
    const req = { headers: { cookie: 'refreshToken=bad-token' } } as Request
    const res = makeRes()
    await refreshController(req, res, next)
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
    })
    expect(next).toHaveBeenCalledWith(err)
  })

  it('returns 200 with data on valid token', async () => {
    ;(refreshAccessToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      accessToken: 'new-access-token',
      user: { id: 'u1', email: 'test@example.com', name: 'Test', role: 'EMPLOYEE' },
    })
    const req = { headers: { cookie: 'refreshToken=valid-raw-token' } } as Request
    const res = makeRes()
    await refreshController(req, res, next)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        accessToken: 'new-access-token',
        user: { id: 'u1', email: 'test@example.com', name: 'Test', role: 'EMPLOYEE' },
      },
    })
  })
})

describe('logoutController', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls logout service with cookie token, clears cookie, returns 200', async () => {
    const req = { headers: { cookie: 'refreshToken=mytoken' } } as Request
    const res = makeRes()
    await logoutController(req, res, next)
    expect(logout).toHaveBeenCalledWith('mytoken')
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null })
    expect(next).not.toHaveBeenCalled()
  })

  it('clears cookie and returns 200 even when no refresh token cookie', async () => {
    const req = { headers: {} } as Request
    const res = makeRes()
    await logoutController(req, res, next)
    expect(logout).not.toHaveBeenCalled()
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('calls next(err) when logout service throws unexpectedly', async () => {
    ;(logout as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'))
    const req = { headers: { cookie: 'refreshToken=tok' } } as Request
    const res = makeRes()
    await logoutController(req, res, next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})
