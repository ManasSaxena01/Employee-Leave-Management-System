import { describe, it, expect, vi, beforeEach } from 'vitest'

const TEST_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-xxxx'

vi.mock('../env.js', () => ({
  JWT_SECRET: 'test-secret-min-32-chars-xxxxxxxxx',
  JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-chars-xxxx',
}))

vi.mock('../prisma/client.js', () => ({
  prisma: {
    refreshToken: {
      findMany: vi.fn().mockResolvedValue([{ tokenHash: 'stored-hash' }]),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hashSync: vi.fn().mockReturnValue('mocked-hash'),
  },
}))

vi.mock('dotenv/config', () => ({}))

import jwt from 'jsonwebtoken'
import { prisma } from '../prisma/client.js'
import { logout } from './auth.js'

describe('logout()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.refreshToken.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ tokenHash: 'stored-hash' }])
  })

  it('deletes refresh tokens for a valid token', async () => {
    const rawToken = jwt.sign({ userId: 'user-1', role: 'EMPLOYEE' }, TEST_REFRESH_SECRET, { expiresIn: '7d' })
    await logout(rawToken)
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
  })

  it('resolves without error for an invalid token (best-effort)', async () => {
    await expect(logout('not-a-valid-jwt')).resolves.toBeUndefined()
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled()
  })

  it('resolves without error for an expired token', async () => {
    const rawToken = jwt.sign({ userId: 'user-2', role: 'EMPLOYEE' }, TEST_REFRESH_SECRET, { expiresIn: -1 })
    await expect(logout(rawToken)).resolves.toBeUndefined()
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled()
  })
})
