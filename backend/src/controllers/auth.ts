import type { Request, Response, NextFunction } from 'express'
import { login, refreshAccessToken } from '../services/auth.js'

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' })
      return
    }

    const result = await login(email, password)

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env['NODE_ENV'] === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000
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
  try {
    const rawToken = req.headers.cookie
      ?.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('refreshToken='))
      ?.slice('refreshToken='.length)

    if (!rawToken) {
      res.status(401).json({ success: false, error: 'No refresh token' })
      return
    }

    const result = await refreshAccessToken(rawToken)
    res.status(200).json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
}
