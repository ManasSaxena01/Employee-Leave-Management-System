import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { apiClient, setTokenGetter } from '../lib/apiClient.js'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
}

interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  setAuth: (user: AuthUser, token: string) => void
  clearAuth: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // AD-5: stored in React state only — never localStorage/sessionStorage/JS-readable cookie
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiClient
      .post<{ success: boolean; data: { accessToken: string; user: AuthUser } }>('/auth/refresh')
      .then(res => {
        if (res.data.success) {
          const { user: refreshedUser, accessToken: token } = res.data.data
          setUser(refreshedUser)
          setAccessToken(token)
          setTokenGetter(() => token)
        }
      })
      .catch(() => {
        // No valid session — stay logged out
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  function setAuth(newUser: AuthUser, token: string) {
    setUser(newUser)
    setAccessToken(token)
    setTokenGetter(() => token)
  }

  function clearAuth() {
    setUser(null)
    setAccessToken(null)
    setTokenGetter(() => null)
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
