import 'dotenv/config'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const JWT_SECRET = requireEnv('JWT_SECRET')
export const JWT_REFRESH_SECRET = requireEnv('JWT_REFRESH_SECRET')
