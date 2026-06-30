import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma/client.js'
import { JWT_SECRET, JWT_REFRESH_SECRET } from '../env.js'

const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '7d'
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

export interface LoginResult {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    email: string
    name: string
    role: string
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  // Always run bcrypt compare to prevent timing attack (AC3)
  const DUMMY_HASH = '$2b$10$invalidhashfortimingnormalisation000000000000000000000'

  const user = await prisma.user.findUnique({ where: { email } })

  const hashToCompare = user?.passwordHash ?? DUMMY_HASH
  const passwordMatch = await bcrypt.compare(password, hashToCompare)

  if (!user || !passwordMatch || !user.active) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 })
  }

  // JWT payload: userId + role only (AC2)
  const payload = { userId: user.id, role: user.role }

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
  const rawRefreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY })

  const tokenHash = await bcrypt.hash(rawRefreshToken, 10)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } })
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt }
  })

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  }
}

export async function refreshAccessToken(rawToken: string): Promise<{ accessToken: string; user: LoginResult['user'] }> {
  let payload: { userId: string; role: string }
  try {
    payload = jwt.verify(rawToken, JWT_REFRESH_SECRET) as { userId: string; role: string }
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 })
  }

  const stored = await prisma.refreshToken.findMany({
    where: { userId: payload.userId, expiresAt: { gt: new Date() } }
  })

  let matched = false
  for (const t of stored) {
    if (await bcrypt.compare(rawToken, t.tokenHash)) {
      matched = true
      break
    }
  }

  if (!matched) {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user || !user.active) {
    throw Object.assign(new Error('User not found or inactive'), { status: 401 })
  }

  const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })

  return {
    accessToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  }
}
