import type { Request, Response, NextFunction, CookieOptions } from 'express'
import { login, refreshAccessToken, logout, REFRESH_TOKEN_EXPIRY_MS } from '../services/auth.js'

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env['NODE_ENV'] === 'production',
  path: '/',
}

function getRefreshTokenCookie(req: Request): string | undefined {
  return req.headers.cookie
    ?.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('refreshToken='))
    ?.slice('refreshToken='.length)
}

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' })
      return
    }

    const result = await login(email, password)

    res.cookie('refreshToken', result.refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_EXPIRY_MS,
    })

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user
      }
    })
  } catch (err) {
    next(err)
  }
}

export async function refreshController(req: Request, res: Response, next: NextFunction) {
  const rawToken = getRefreshTokenCookie(req)

  if (!rawToken) {
    res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS)
    res.status(401).json({ success: false, error: 'No refresh token' })
    return
  }

  try {
    const result = await refreshAccessToken(rawToken)
    res.status(200).json({ success: true, data: result })
  } catch (err) {
    // Only clear the cookie when the refresh token itself is invalid (401).
    // Other errors (e.g. a transient DB failure) shouldn't sign the user out.
    if (typeof err === 'object' && err !== null && (err as { status?: number }).status === 401) {
      res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS)
    }
    next(err)
  }
}

export async function logoutController(req: Request, res: Response, next: NextFunction) {
  try {
    const rawToken = getRefreshTokenCookie(req)

    if (rawToken) {
      await logout(rawToken)
    }

    res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS)
    res.status(200).json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}
