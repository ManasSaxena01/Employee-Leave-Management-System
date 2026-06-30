import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../prisma/client.js'
import { JWT_SECRET, JWT_REFRESH_SECRET } from '../env.js'

const ACCESS_TOKEN_EXPIRY = '15m'
export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
const REFRESH_TOKEN_EXPIRY_SECONDS = REFRESH_TOKEN_EXPIRY_MS / 1000

// Computed once at startup so the format is always a valid bcrypt hash
// (required for AC3 timing-safe comparison — see login()).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing-safety', 10)

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
  const user = await prisma.user.findUnique({ where: { email } })

  const hashToCompare = user?.passwordHash ?? DUMMY_HASH
  const passwordMatch = await bcrypt.compare(password, hashToCompare)

  if (!user || !passwordMatch || !user.active) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 })
  }

  // JWT payload: userId + role only (AC2)
  const payload = { userId: user.id, role: user.role }

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
  const rawRefreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY_SECONDS })

  const tokenHash = await bcrypt.hash(rawRefreshToken, 10)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } })
  ])

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  }
}

function asRefreshPayload(decoded: unknown): { userId: string; role?: string } {
  const payload = decoded as { userId?: unknown; role?: unknown }
  if (typeof payload.userId !== 'string') {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 })
  }
  if (payload.role !== undefined && typeof payload.role !== 'string') {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 })
  }
  return { userId: payload.userId, role: payload.role }
}

async function findMatchingRefreshToken(userId: string, rawToken: string): Promise<boolean> {
  const stored = await prisma.refreshToken.findMany({
    where: { userId, expiresAt: { gt: new Date() } }
  })

  for (const t of stored) {
    if (await bcrypt.compare(rawToken, t.tokenHash)) {
      return true
    }
  }
  return false
}

export async function refreshAccessToken(rawToken: string): Promise<{ accessToken: string; user: LoginResult['user'] }> {
  let payload: { userId: string; role?: string }
  try {
    payload = asRefreshPayload(jwt.verify(rawToken, JWT_REFRESH_SECRET))
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 })
  }

  const matched = await findMatchingRefreshToken(payload.userId, rawToken)

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

export async function logout(rawToken: string): Promise<void> {
  let payload: { userId: string; role?: string }
  try {
    payload = asRefreshPayload(jwt.verify(rawToken, JWT_REFRESH_SECRET))
  } catch {
    // Invalid/expired token — nothing to delete; controller still clears cookie
    return
  }

  const matched = await findMatchingRefreshToken(payload.userId, rawToken)
  if (matched) {
    await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } })
  }
}
