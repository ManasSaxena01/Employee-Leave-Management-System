---
story_id: "1.3"
story_key: "1-3-silent-token-refresh-and-logout"
epic: 1
story: 3
title: "Silent Token Refresh & Logout"
status: "ready-for-dev"
created: "2026-06-30"
epic_title: "Foundation, Authentication & Project Scaffold"
baseline_commit: "NO_VCS"
---

# Story 1.3: Silent Token Refresh & Logout

## Status: ready-for-dev

## Story

**As a logged-in user,**
I want my session to automatically renew before my access token expires, and to be able to log out securely,
**So that** I stay authenticated throughout normal use and can cleanly end my session.

---

## Acceptance Criteria

**AC1 — Refresh endpoint:**
Given a valid httpOnly refresh token cookie exists,
When `POST /api/auth/refresh` is called,
Then a 200 response returns `{ success: true, data: { accessToken, user: { id, email, name, role } } }`; an expired or absent refresh token returns 401 **and clears the cookie** in the response.

**AC2 — 401 interceptor / silent refresh:**
Given `apiClient.ts`,
When any API call returns 401 (expired access token),
Then the client automatically calls `POST /auth/refresh`, stores the new access token in `AuthContext`, and retries the original request exactly once; if the refresh call also fails, `AuthContext` is cleared and the user is redirected to `/login`.

**AC3 — Logout:**
Given a logged-in user clicks Logout,
When `POST /auth/logout` is called,
Then the refresh token row is deleted from `refresh_tokens`; the httpOnly cookie is cleared in the response; `AuthContext` is reset to null; the user lands on `/login`.

**AC4 — RBAC responses:**
Given any protected API route,
When a request arrives without a valid `Authorization: Bearer <token>` header,
Then `middleware/auth` returns 401 with `{ success: false, error: "Unauthorized" }` and `middleware/rbac` is never reached;
And when the JWT is valid but the role does not satisfy the required role, `middleware/rbac` returns 403 with `{ success: false, error: "Forbidden" }`.

---

## ⚠️ CRITICAL — What Is Already Implemented (Do NOT Re-Implement)

The following were built during a code-review fix pass and are **complete and working**. Read these files before writing any code — do not overwrite or duplicate them:

### Already done in `backend/src/services/auth.ts`:
- `refreshAccessToken(rawToken: string)` — verifies JWT, looks up hash in DB, returns `{ accessToken, user }`
- Login now calls `prisma.refreshToken.deleteMany` before creating a new row (token rotation on login)

### Already done in `backend/src/controllers/auth.ts`:
- `refreshController` — parses cookie header manually, calls `refreshAccessToken`, returns 200

### Already done in `backend/src/routes/auth.ts`:
- `authRouter.post('/refresh', refreshController)` — wired and live

### Already done in `frontend/src/context/AuthContext.tsx`:
- `isLoading` state (starts `true`)
- `useEffect` on mount calls `POST /auth/refresh` to rehydrate session, then sets `isLoading(false)`
- `isLoading` exposed in context value

### Already done in `frontend/src/App.tsx`:
- `RequireAuth` checks `isLoading` before redirecting — no boot-loop on page refresh

### Verify these are working before starting:
```bash
curl -s -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json"
# Expected: {"success":false,"error":"No refresh token"}  ← correct — no cookie sent
```

---

## What This Story Must Implement

1. **Fix refresh 401 to clear the cookie** — currently the refresh 401 path does NOT clear the cookie
2. **`logoutService`** in `services/auth.ts`
3. **`logoutController`** in `controllers/auth.ts`
4. **`POST /auth/logout`** in `routes/auth.ts`
5. **`setAuthCallbacks`** export in `apiClient.ts`
6. **401 response interceptor** in `apiClient.ts`
7. **Wire `setAuthCallbacks`** in `AuthProvider` (`AuthContext.tsx`)
8. **Logout button** in `DashboardPage.tsx` (visible to all roles)
9. **`middleware/rbac.ts`** — ensure it returns 403 (not 401) for role failures (AC4)

---

## STOP — Critical Guardrails

| Risk | Wrong | Correct |
|------|-------|---------|
| Circular import | `apiClient.ts` importing `AuthUser` from `AuthContext.tsx` | Define callbacks as `(token: string) => void` — no AuthUser type needed in apiClient |
| Multiple refresh calls | Each 401 fires a new refresh | Use a module-level `isRefreshing` flag + `pendingRequests` queue to serialize |
| Refreshing the refresh call | 401 interceptor catches refresh endpoint's own 401 | Check `originalRequest.url !== '/auth/refresh'` before retrying |
| Logout requires valid access token | User can't logout if token expired | Logout endpoint does NOT use `authenticate` middleware — reads cookie directly |
| Cookie clear on refresh 401 | Currently missing | `res.clearCookie('refreshToken')` in `refreshController` catch path |
| rbac returns 401 | Both auth failure and role failure return 401 | Auth failure → 401 (`middleware/auth`), role failure → 403 (`middleware/rbac`) |
| navigate() outside React | Using React Router navigate in apiClient.ts | Use `window.location.replace('/login')` from the `onAuthExpired` callback |
| DashboardPage overwrites existing | Replacing the current stub entirely | The current file is `<div>Dashboard - {user.role}</div>` — extend it, add a logout button |

---

## Implementation Guide

### 1. Fix `refreshController` to clear cookie on 401

In `backend/src/controllers/auth.ts`, update `refreshController`:

```typescript
export async function refreshController(req: Request, res: Response, next: NextFunction) {
  const rawToken = req.headers.cookie
    ?.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('refreshToken='))
    ?.slice('refreshToken='.length)

  if (!rawToken) {
    res.clearCookie('refreshToken')
    res.status(401).json({ success: false, error: 'No refresh token' })
    return
  }

  try {
    const result = await refreshAccessToken(rawToken)
    res.status(200).json({ success: true, data: result })
  } catch (err) {
    res.clearCookie('refreshToken')   // ← clear on invalid/expired token
    next(err)
  }
}
```

### 2. Add logout to `services/auth.ts`

```typescript
export async function logout(rawToken: string): Promise<void> {
  // Best-effort: verify token to get userId, then delete matching hash
  // If token is invalid/expired, still succeeds (cookie will be cleared by controller)
  try {
    const payload = jwt.verify(rawToken, JWT_REFRESH_SECRET) as { userId: string }
    await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } })
  } catch {
    // Token invalid — nothing to delete, controller still clears cookie
  }
}
```

### 3. Add `logoutController` to `controllers/auth.ts`

```typescript
export async function logoutController(req: Request, res: Response, next: NextFunction) {
  try {
    const rawToken = req.headers.cookie
      ?.split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('refreshToken='))
      ?.slice('refreshToken='.length)

    if (rawToken) {
      await logout(rawToken)
    }

    res.clearCookie('refreshToken')
    res.status(200).json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
}
```

### 4. Wire logout route in `routes/auth.ts`

```typescript
// Logout does NOT require authenticate — must work even with expired access token
authRouter.post('/logout', logoutController)
```

### 5. Update `apiClient.ts` — add callbacks + 401 interceptor

```typescript
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
let pendingRequests: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue this request until the in-progress refresh completes
        return new Promise<string>((resolve) => {
          pendingRequests.push(resolve)
        }).then((token) => {
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

        // Flush queued requests
        pendingRequests.forEach((resolve) => resolve(newToken))
        pendingRequests = []

        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch {
        pendingRequests = []
        onAuthExpired?.()
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
```

You will need to import `AxiosError` and `InternalAxiosRequestConfig` from `axios`.

### 6. Wire `setAuthCallbacks` in `AuthProvider` (`AuthContext.tsx`)

Add a `useEffect` (separate from the rehydration one) that wires the callbacks once on mount:

```typescript
useEffect(() => {
  setAuthCallbacks(
    (token) => {
      setAccessToken(token)
      setTokenGetter(() => token)
    },
    () => {
      setUser(null)
      setAccessToken(null)
      setTokenGetter(() => null)
      window.location.replace('/login')
    }
  )
}, [])
```

Note: `setAuthCallbacks` must be imported from `../lib/apiClient.js`.

### 7. Add Logout button to `DashboardPage.tsx`

The current file renders `<div>Dashboard - {user.role}</div>`. Extend it:

```typescript
import { useAuth } from '../context/AuthContext.js'
import { apiClient } from '../lib/apiClient.js'
import { useNavigate } from 'react-router-dom'

export function DashboardPage() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded text-sm font-medium"
        >
          Sign out
        </button>
      </div>
      <p className="text-gray-600">Logged in as <strong>{user?.name}</strong> ({user?.role})</p>
    </div>
  )
}
```

### 8. Verify `middleware/rbac.ts` returns 403

Read the current file. It must return 403 (not 401) for role mismatches. If it currently returns 401, change the status code.

---

## File Checklist

| File | Action | Notes |
|------|--------|-------|
| `backend/src/controllers/auth.ts` | UPDATE | Fix refresh 401 path to clear cookie; add logoutController |
| `backend/src/services/auth.ts` | UPDATE | Add logout() function |
| `backend/src/routes/auth.ts` | UPDATE | Wire POST /logout (no authenticate middleware) |
| `backend/src/middleware/rbac.ts` | VERIFY/UPDATE | Must return 403 for role failures |
| `frontend/src/lib/apiClient.ts` | UPDATE | Add setAuthCallbacks + 401 interceptor |
| `frontend/src/context/AuthContext.tsx` | UPDATE | Wire setAuthCallbacks on mount |
| `frontend/src/pages/DashboardPage.tsx` | UPDATE | Add logout button |

**Do NOT touch:**
- `backend/src/services/auth.ts` `refreshAccessToken()` — already correct
- `backend/src/controllers/auth.ts` `refreshController` — except for the cookie-clear fix
- `frontend/src/context/AuthContext.tsx` rehydration `useEffect` — already correct
- `frontend/src/App.tsx` `RequireAuth` — already correct

---

## Testing Checklist

After implementation, manually verify:

- [ ] Login → see Dashboard with Sign out button
- [ ] Press F5 (hard reload) → stay on Dashboard (rehydration works)
- [ ] Click Sign out → redirected to `/login`; subsequent F5 stays on `/login`
- [ ] With DevTools: expire the access token (wait 15 min or manually shorten expiry in env); make an API call → it silently refreshes and succeeds
- [ ] Backend: `POST /api/auth/logout` with no cookie → 200, cookie cleared
- [ ] Backend: `POST /api/auth/refresh` with no cookie → 401, no cookie set

---

## Dev Agent Record

### Implementation Plan
*(to be filled by dev agent)*

### Debug Log
*(to be filled by dev agent)*

### Completion Notes
*(to be filled by dev agent)*

---

## Tasks / Subtasks

- [ ] Task 1: Backend logout
  - [ ] Add `logout()` to `services/auth.ts`
  - [ ] Add `logoutController` to `controllers/auth.ts`
  - [ ] Fix `refreshController` to clear cookie on 401 path
  - [ ] Wire `POST /auth/logout` in `routes/auth.ts` (no authenticate middleware)
  - [ ] Verify `middleware/rbac.ts` returns 403 for role failures

- [ ] Task 2: Frontend 401 interceptor
  - [ ] Add `setAuthCallbacks` export to `apiClient.ts`
  - [ ] Add `isRefreshing` flag + `pendingRequests` queue
  - [ ] Add response interceptor: retry once after refresh, redirect on double-401

- [ ] Task 3: Wire callbacks + logout UI
  - [ ] Wire `setAuthCallbacks` in `AuthProvider` (`AuthContext.tsx`)
  - [ ] Add logout button to `DashboardPage.tsx`

- [ ] Task 4: Smoke test full flow
  - [ ] Login, reload, logout all work end-to-end
