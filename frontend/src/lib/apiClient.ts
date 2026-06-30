import axios from 'axios'
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

// Story 1.2: attach Bearer token from AuthContext state
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Story 1.3 implements: 401 interceptor triggers silent token refresh + retry
