import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL } from './constants.js'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true  // for httpOnly refresh token cookie
})

// Token getter — set by AuthProvider after login (avoids calling hook outside React)
let getAccessToken: () => string | null = () => null
export function setTokenGetter(fn: () => string | null) {
  getAccessToken = fn
}

// Callback hooks — set by AuthProvider
let onTokenRefreshed: ((token: string) => void) | null = null
let onAuthExpired: (() => void) | null = null

export function setAuthCallbacks(
  onRefresh: (token: string) => void,
  onExpired: () => void
) {
  onTokenRefreshed = onRefresh
  onAuthExpired = onExpired
}

// Serialize concurrent refresh calls
let isRefreshing = false
let pendingRequests: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

// Attach Bearer token from AuthContext state
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// 401 interceptor: retry once after silent refresh, redirect on double-401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/logout')
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          pendingRequests.push({ resolve, reject })
        }).then((token) => {
          originalRequest._retry = true
          originalRequest.headers['Authorization'] = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const res = await apiClient.post<{ success: boolean; data: { accessToken: string } }>('/auth/refresh')
        const newToken = res.data.data.accessToken

        setTokenGetter(() => newToken)
        onTokenRefreshed?.(newToken)

        pendingRequests.forEach(({ resolve }) => resolve(newToken))
        pendingRequests = []

        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch (err) {
        pendingRequests.forEach(({ reject }) => reject(err))
        pendingRequests = []
        // Only treat the session as expired when the refresh call itself was
        // rejected as unauthorized — a transient/network error during refresh
        // shouldn't force a logout of a still-valid session.
        if ((err as AxiosError).response?.status === 401) {
          onAuthExpired?.()
        }
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
