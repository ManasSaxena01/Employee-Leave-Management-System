---
story_id: "1.1"
story_key: "1-1-monorepo-scaffold-docker-and-database-schema"
epic: 1
story: 1
title: "Monorepo Scaffold, Docker & Database Schema"
status: "review"
created: "2026-06-30"
epic_title: "Foundation, Authentication & Project Scaffold"
baseline_commit: "NO_VCS"
---

# Story 1.1: Monorepo Scaffold, Docker & Database Schema

## Status: review

## Story

**As a developer,**
I want the monorepo skeleton, Docker Compose environment, complete Prisma schema, and all shared backend/frontend scaffolding in place,
**So that** every subsequent story has a runnable, consistent foundation with no structural rework.

---

## Acceptance Criteria

**AC1 — Docker + dev servers start:**
Given the repository is freshly cloned, when `docker compose up -d` is run followed by backend and frontend dev start commands, then the backend starts on port 4000 with no errors and the frontend dev server starts successfully.

**AC2 — All 9 tables created:**
Given the Prisma schema, when `npx prisma migrate dev` is run, then all nine tables exist: `users`, `departments`, `leave_types`, `leave_balances`, `leave_requests`, `audit_logs`, `company_holidays`, `refresh_tokens`, `notifications`.

**AC3 — Utils export cleanly:**
Given the backend utility modules, when they are imported, then `utils/workingDays.ts`, `utils/storage.ts` (local provider), `utils/email.ts`, `utils/pdf.ts`, and `utils/csv.ts` export their interfaces without runtime errors.

**AC4 — Frontend scaffold:**
Given the frontend scaffold, when the app loads in a browser, then React Router 7 is wired with route stubs per role; TanStack Query client is initialized; TailwindCSS v4 uses `@theme` directive in root CSS with **no** `tailwind.config.js`; `AuthContext` provides user state initialized to `null`.

**AC5 — `.env.example` complete:**
Given `.env.example`, when inspected, then all required vars are documented (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `STORAGE_PROVIDER`, `PORT`, `EMAIL_PROVIDER`); no secrets are hardcoded anywhere in source.

**AC6 — workingDays unit tests:**
Given `utils/workingDays.ts`, unit tests verify at least three cases: (1) a date range with no holidays, (2) a range spanning a holiday, (3) a single-day request that falls on a holiday → 0 days.

---

## Epic Context

**Epic 1 Goal:** Foundation, Authentication & Project Scaffold — the monorepo skeleton, database schema, and all shared infrastructure are in place. Demo seed data is ready so all three role accounts work immediately.

**Story build order within Epic 1 (each depends on prior):**
1. **1.1 (THIS)** — monorepo scaffold, Docker, database schema, utility stubs
2. **1.2** — user login with JWT (needs schema + middleware stubs from 1.1)
3. **1.3** — silent token refresh & logout (builds on 1.2's auth flow)
4. **1.4** — demo seed data (runs against 1.1's schema)

**FRs covered:** Groundwork for FR-AUTH-1–5, FR-SEED-1–2, FR-BAL, FR-REQ, FR-NOTIF (all require schema)
**NFRs addressed:** NFR-SEC-3, NFR-SEC-4, NFR-DEPL-1, NFR-DEPL-2
**ADs active in this story:** AD-1, AD-3, AD-5, AD-6, AD-7, AD-9, AD-10, AD-11, AD-12

---

## STOP — Critical Guardrails (Read Before Writing Any Code)

These are the highest-risk areas where dev agents commonly make mistakes on this stack:

| Risk | Wrong | Correct |
|------|-------|---------|
| Prisma version | Using Prisma 5/6 patterns | Prisma 7: `prisma.config.ts` + `@prisma/adapter-pg` + ESM |
| TailwindCSS | Creating `tailwind.config.js` | v4: CSS-first via `@theme` in root CSS only |
| Access token storage | `localStorage` / `sessionStorage` / JS-readable cookie | Only in `AuthContext` React state (AD-5) |
| Balance calculation | Summing `leave_requests` | `leave_balances` table only — never aggregate (AD-2) |
| Prisma env vars | Assuming `.env` auto-loaded | Explicitly import `dotenv/config` at top of `server.ts` |
| node-cron v4 API | `task.running` | `task.isActive` (read-only getter; no EventEmitter) |
| React Router | v6 or v8 | v7 only — v6 EOL, v8 requires React 19 which breaks our stack |
| PDF library | Puppeteer | `@cantoo/pdf-lib` (or `pdf-lib` fallback) — no Puppeteer in v1 |

---

## Package Versions (Mandatory — Do Not Downgrade)

Install these exact major versions; do not default to npm's "latest" without verifying.

**Backend:**
```
express@5               Node.js 24 LTS target
typescript@6
prisma@7
@prisma/adapter-pg@7    required by Prisma 7
pg                      peer dep for adapter-pg
@types/pg
jsonwebtoken@9
@types/jsonwebtoken
bcryptjs@3
@types/bcryptjs
multer@2
@types/multer
nodemailer@9
@types/nodemailer
node-cron@4
csv-stringify@6
@cantoo/pdf-lib@2       (verify availability; fall back to pdf-lib if unavailable)
@aws-sdk/client-s3@3    R2 compat (install now, activated by STORAGE_PROVIDER=r2)
dotenv
```

**Frontend:**
```
react@18                NOT React 19 (React Router 7 incompatible with 19)
react-dom@18
react-router-dom@7      NOT v6 (EOL), NOT v8 (requires React 19)
@tanstack/react-query@5
axios
tailwindcss@4           CSS-first; NO tailwind.config.js
@tailwindcss/vite       Vite plugin for TailwindCSS 4
vite
typescript@6
```

---

## Prisma 7 — Breaking Changes (Critical)

Prisma 7 is a **major rewrite**. All v5/v6 patterns are wrong here.

### What changed

| Concern | Prisma 5/6 | Prisma 7 |
|---------|-----------|---------|
| Datasource config | In `schema.prisma` | In `prisma.config.ts` |
| `.env` loading | Auto-loaded | **Not auto-loaded** — must call `dotenv/config` first |
| Driver | Built-in pg | Requires `@prisma/adapter-pg` |
| Module format | CJS or ESM | **ESM-only** |
| Client init | `new PrismaClient()` | `new PrismaClient({ adapter })` |

### Required files

**`backend/package.json`** must include:
```json
{
  "type": "module"
}
```

**`backend/src/server.ts`** — first import must be:
```ts
import 'dotenv/config'  // MUST be first — Prisma 7 does not auto-load .env
```

**`backend/src/prisma/prisma.config.ts`** — verify exact Prisma 7 `defineConfig` API from the official Prisma 7 migration guide before implementing. The intent:
- Loads `DATABASE_URL` from environment
- Wires `@prisma/adapter-pg` as the driver adapter
- Exports the config as default

**`backend/src/prisma/schema.prisma`** — still contains data models and generator block. The datasource block may still be present but its URL resolution is now managed via `prisma.config.ts`. Confirm exact behavior in Prisma 7 docs.

**Shared Prisma client** (`backend/src/prisma/client.ts` or similar):
```ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
export const prisma = new PrismaClient({ adapter })
```

Import this singleton from all services. **Never** instantiate `PrismaClient` per request.

---

## TailwindCSS v4 — CSS-First Config (Breaking Change from v3)

**Do NOT create `tailwind.config.js`** — it does not exist in v4.

**Installation:**
```bash
npm install tailwindcss @tailwindcss/vite
```

**`frontend/vite.config.ts`:**
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**`frontend/src/index.css`** — configure via `@theme`:
```css
@import "tailwindcss";

@theme {
  --color-primary: #4f46e5;
  --color-primary-dark: #4338ca;
  --color-secondary: #10b981;
  /* Extend with project-specific tokens as needed */
}
```

No `tailwind.config.js`, no `tailwind.config.ts`, no `@tailwind base/components/utilities` directives — the `@import "tailwindcss"` handles all of that in v4.

---

## File Structure to Create

Files marked **[FULL]** require complete implementation for this story's ACs. Files marked **[STUB]** need the exported interface but minimal body — later stories fill them in.

```
employee-leave-management-system/
├── docker-compose.yml                       [FULL]
├── .env.example                             [FULL]
├── README.md                                [FULL — setup instructions; seed creds placeholder]
│
├── backend/
│   ├── package.json                         [FULL — type:module, all backend deps listed above]
│   ├── tsconfig.json                        [FULL — ESM, Node 24, strict]
│   └── src/
│       ├── server.ts                        [FULL — import dotenv first; mount app; start cron job]
│       ├── app.ts                           [FULL — Express 5 app; mount middleware; register routes]
│       │
│       ├── prisma/
│       │   ├── schema.prisma                [FULL — all 9 tables; see schema section below]
│       │   ├── prisma.config.ts             [FULL — Prisma 7 datasource + adapter-pg config]
│       │   ├── client.ts                    [FULL — singleton PrismaClient with adapter]
│       │   ├── migrations/                  [auto-generated by `prisma migrate dev`]
│       │   └── seed.ts                      [STUB — empty; implemented in Story 1.4]
│       │
│       ├── middleware/
│       │   ├── auth.ts                      [STUB — exports RequestHandler; calls next() for now]
│       │   ├── rbac.ts                      [STUB — exports factory (roles) => RequestHandler; calls next()]
│       │   ├── upload.ts                    [FULL — Multer 2: PDF/JPG/PNG only, 5 MB limit (NFR-SEC-2)]
│       │   └── error.ts                     [FULL — centralized error handler; AD-10 envelope format]
│       │
│       ├── routes/
│       │   └── index.ts                     [STUB — empty router; registers nothing yet]
│       │
│       ├── controllers/                     [STUB — empty directory]
│       │
│       ├── services/
│       │   ├── leaveRequest.ts              [STUB — export const leaveRequestService = {}]
│       │   ├── leaveBalance.ts              [STUB — export const leaveBalanceService = {}]
│       │   ├── audit.ts                     [STUB — export const audit = { append: async () => {} }]
│       │   └── notification.ts              [STUB — export const notification = { trigger: async () => {} }]
│       │
│       ├── utils/
│       │   ├── workingDays.ts               [FULL — see implementation notes + tests required (AC6)]
│       │   ├── storage.ts                   [FULL — local provider impl; R2 stub throws "not configured"]
│       │   ├── email.ts                     [FULL — fire-and-forget wrapper; catches and logs errors (AD-7)]
│       │   ├── pdf.ts                       [STUB — export async function generatePdf(): Promise<Buffer>]
│       │   └── csv.ts                       [STUB — export async function generateCsv(): Promise<string>]
│       │
│       └── jobs/
│           └── resetBalances.ts             [STUB — schedule cron but log only; full impl in Story 3.3]
│
└── frontend/
    ├── package.json                         [FULL — React 18, Router 7, TanStack Query 5, all deps]
    ├── tsconfig.json                        [FULL]
    ├── vite.config.ts                       [FULL — react plugin + @tailwindcss/vite plugin]
    ├── index.html                           [FULL]
    └── src/
        ├── index.css                        [FULL — @import "tailwindcss"; @theme directive]
        ├── main.tsx                         [FULL — React 18 createRoot; QueryClientProvider; BrowserRouter]
        ├── App.tsx                          [FULL — React Router 7 routes + RequireAuth + RequireRole stubs]
        │
        ├── context/
        │   └── AuthContext.tsx              [FULL — user + accessToken in React state ONLY; null initial]
        │
        ├── lib/
        │   ├── apiClient.ts                 [STUB — axios instance; base URL from env; 401 interceptor placeholder]
        │   ├── queryClient.ts               [FULL — TanStack Query 5 QueryClient instance]
        │   ├── types.ts                     [FULL — TypeScript interfaces matching all 9 Prisma entities]
        │   └── constants.ts                 [FULL — Role enum, LeaveStatus enum, API_BASE_URL]
        │
        ├── components/                      [STUB — empty; shared UI built per-story as needed]
        │
        ├── features/
        │   ├── auth/index.tsx               [STUB — export LoginPage placeholder]
        │   ├── leaves/index.tsx             [STUB — placeholder component]
        │   ├── employees/index.tsx          [STUB — placeholder component]
        │   ├── departments/index.tsx        [STUB — placeholder component]
        │   ├── leaveTypes/index.tsx         [STUB — placeholder component]
        │   ├── holidays/index.tsx           [STUB — placeholder component]
        │   ├── calendar/index.tsx           [STUB — placeholder component]
        │   ├── reports/index.tsx            [STUB — placeholder component]
        │   ├── audit/index.tsx              [STUB — placeholder component]
        │   └── profile/index.tsx            [STUB — placeholder component]
        │
        └── pages/                           [STUB — DashboardPage renders role name from AuthContext]
```

---

## Database Schema (All 9 Tables)

Implement in `backend/src/prisma/schema.prisma`. Use `@default(uuid())` for all PKs. Use `@map` to keep DB column names snake_case while Prisma model fields are camelCase.

```prisma
generator client {
  provider = "prisma-client-js"
}

// Note: datasource URL is configured in prisma.config.ts for Prisma 7
// Include datasource block per Prisma 7 docs requirements

enum Role {
  ADMIN
  MANAGER
  EMPLOYEE
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum AuditAction {
  SUBMITTED
  APPROVED
  REJECTED
  CANCELLED
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  name         String
  role         Role
  active       Boolean  @default(true)
  departmentId String?  @map("department_id")
  managerId    String?  @map("manager_id")
  contactEmail String?  @map("contact_email")
  phone        String?
  photoPath    String?  @map("photo_path")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  department    Department?    @relation("DeptEmployees", fields: [departmentId], references: [id])
  manager       User?          @relation("Reports", fields: [managerId], references: [id])
  directReports User[]         @relation("Reports")
  managedDept   Department?    @relation("DeptManager")
  leaveBalances LeaveBalance[]
  leaveRequests LeaveRequest[]
  notifications Notification[]
  refreshTokens RefreshToken[]
  auditActions  AuditLog[]

  @@map("users")
}

model Department {
  id        String   @id @default(uuid())
  name      String   @unique
  managerId String?  @unique @map("manager_id")
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  manager   User?  @relation("DeptManager", fields: [managerId], references: [id])
  employees User[] @relation("DeptEmployees")

  @@map("departments")
}

model LeaveType {
  id               String   @id @default(uuid())
  name             String   @unique
  defaultQuota     Int      @map("default_quota")
  documentRequired Boolean  @default(false) @map("document_required")
  active           Boolean  @default(true)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  leaveBalances LeaveBalance[]
  leaveRequests LeaveRequest[]

  @@map("leave_types")
}

model LeaveBalance {
  id          String @id @default(uuid())
  userId      String @map("user_id")
  leaveTypeId String @map("leave_type_id")
  balance     Int

  user      User      @relation(fields: [userId], references: [id])
  leaveType LeaveType @relation(fields: [leaveTypeId], references: [id])

  @@unique([userId, leaveTypeId])
  @@map("leave_balances")
}

model LeaveRequest {
  id           String      @id @default(uuid())
  userId       String      @map("user_id")
  leaveTypeId  String      @map("leave_type_id")
  startDate    DateTime    @map("start_date") @db.Date
  endDate      DateTime    @map("end_date") @db.Date
  durationDays Int         @map("duration_days")
  status       LeaveStatus @default(PENDING)
  reason       String
  documentPath String?     @map("document_path")
  comment      String?
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")

  user      User       @relation(fields: [userId], references: [id])
  leaveType LeaveType  @relation(fields: [leaveTypeId], references: [id])
  auditLogs AuditLog[]

  @@map("leave_requests")
}

model AuditLog {
  id             String      @id @default(uuid())
  leaveRequestId String      @map("leave_request_id")
  actorId        String      @map("actor_id")
  action         AuditAction
  comment        String?
  createdAt      DateTime    @default(now()) @map("created_at")

  leaveRequest LeaveRequest @relation(fields: [leaveRequestId], references: [id])
  actor        User         @relation(fields: [actorId], references: [id])

  @@map("audit_logs")
}

model CompanyHoliday {
  id        String   @id @default(uuid())
  date      DateTime @unique @db.Date
  name      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("company_holidays")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tokenHash String   @map("token_hash")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("refresh_tokens")
}

model Notification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("notifications")
}
```

---

## Implementation Notes

### API Response Envelope (AD-10 — every response)

All API responses use this shape. Enforce in `middleware/error.ts` and use consistently from all controllers:

```ts
// Success (single item)
res.status(200).json({ success: true, data: result })

// Success (list)
res.status(200).json({ success: true, data: items, meta: { page, limit, total } })

// Error
res.status(400).json({ success: false, error: "Human-readable message" })
```

HTTP status codes carry semantics: 200/201 success, 400 bad input, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 500 server error. No custom numeric error codes inside the envelope.

### Backend Layering Rule (AD-2 pattern — enforced for all stories)

```
routes/ → controllers/ → services/ → Prisma
```

- **Routes:** register path + middleware chain. Zero logic.
- **Controllers:** parse `req`, call one service method, call `res.json()`. No Prisma calls. No business logic.
- **Services:** all business logic, all Prisma access, all cross-service calls.

Violating this (e.g., Prisma in a controller) will break the pattern required by all subsequent stories.

### storage.ts Interface (AD-6)

```ts
export interface StorageProvider {
  save(buffer: Buffer, filename: string): Promise<string>  // returns stored path/key
  getSignedUrl(filename: string): Promise<string>          // returns URL for client access
}
```

- `STORAGE_PROVIDER=local`: save to `backend/uploads/` directory; `getSignedUrl` returns `http://localhost:4000/uploads/{filename}`.
- `STORAGE_PROVIDER=r2`: stub only — throw `new Error('R2 storage not configured')` for now; full impl in later story.
- `backend/uploads/` must exist and be gitignored (but not its directory entry).

### email.ts — Fire-and-Forget Contract (AD-7)

```ts
export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  try {
    // Nodemailer: Ethereal transport for EMAIL_PROVIDER=ethereal
    // Resend SMTP for EMAIL_PROVIDER=resend
  } catch (err) {
    console.error('[email] send failed:', err)
    // NEVER re-throw — callers do not await email in critical path
  }
}
```

Caller pattern (for future stories to follow):
```ts
// After DB transaction commits:
sendEmail({ to: ..., subject: ..., html: ... })  // intentionally no await
```

### workingDays.ts — Full Implementation + Tests Required

```ts
export function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: Date[]  // company holiday dates fetched from DB
): number {
  // Return count of Mon–Fri days in [startDate, endDate] inclusive
  // that do NOT fall on any date in the holidays array
  // Compare dates by YYYY-MM-DD string to avoid timezone issues
}
```

**Unit test file: `utils/workingDays.test.ts`** — minimum 3 test cases:
```
Case 1: Mon 2026-01-05 → Fri 2026-01-09, no holidays → 5 days
Case 2: Mon 2026-12-21 → Fri 2026-12-25, holiday on Thu 2026-12-24 → 4 days
Case 3: Thu 2026-12-25 → Thu 2026-12-25, holiday on 2026-12-25 → 0 days
```

Use Vitest (recommended for ESM + Vite project) or Jest. Add test script to `package.json`.

### resetBalances.ts — Stub for Now

Story 3.3 implements the full annual reset. For this story:

```ts
import cron from 'node-cron'

// node-cron v4: use task.isActive (not task.running); no EventEmitter
export const resetBalancesJob = cron.schedule(
  '0 0 1 1 *',  // January 1st, midnight
  async () => {
    console.log('[resetBalances] Annual balance reset triggered')
    // Full implementation in Story 3.3
  },
  { scheduled: false }  // don't start automatically until wired in server.ts
)
```

Wire in `server.ts` after app start:
```ts
resetBalancesJob.start()
```

### AuthContext.tsx — Access Token Security (AD-5)

```tsx
interface AuthUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
}

interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  setAuth: (user: AuthUser, token: string) => void
  clearAuth: () => void
}
```

Storage rules (enforced here, never relaxed):
- `user` and `accessToken`: stored in React `useState` only
- **Never** `localStorage.setItem(...)` for token or user
- **Never** `sessionStorage.setItem(...)` for token or user
- **Never** `document.cookie = ...` for access token (refresh token in httpOnly cookie is set server-side, never by JS)

### React Router 7 Route Stubs (AC4)

```tsx
// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// RequireAuth: redirects to /login if user is null in AuthContext
// RequireRole: redirects to /dashboard if user.role not in allowed list

<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<RequireAuth />}>
      {/* All authenticated roles */}
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/leaves" element={<LeavesPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      
      {/* Manager + Admin only */}
      <Route element={<RequireRole roles={['MANAGER', 'ADMIN']} />}>
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
      
      {/* Admin only */}
      <Route element={<RequireRole roles={['ADMIN']} />}>
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/leave-types" element={<LeaveTypesPage />} />
        <Route path="/holidays" element={<HolidaysPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
</BrowserRouter>
```

Page components are stubs: `export default function DashboardPage() { return <div>Dashboard</div> }`.

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: leave_management
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@admin.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

### .env.example

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leave_management

# JWT (change in production — never commit real secrets)
JWT_SECRET=change-me-in-production-min-32-chars
JWT_REFRESH_SECRET=change-me-in-production-different-from-jwt-secret

# Server
PORT=4000

# File storage: "local" (dev) or "r2" (production Cloudflare R2)
STORAGE_PROVIDER=local

# Email: "ethereal" (dev fake SMTP) or "resend" (production)
EMAIL_PROVIDER=ethereal

# --- Production only (leave commented in dev) ---
# RESEND_API_KEY=re_xxxx
# R2_ACCOUNT_ID=
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_BUCKET_NAME=
```

### Backend tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### @cantoo/pdf-lib Verification

Before installing `@cantoo/pdf-lib`, run `npm info @cantoo/pdf-lib`. If the package is unavailable or incompatible with Node 24 / ESM:
- Fall back to `pdf-lib` (original package)
- Add this comment at the top of `utils/pdf.ts`:
  ```ts
  // Using pdf-lib fallback: @cantoo/pdf-lib unavailable as of 2026-06-30 (verify and switch if available)
  ```
- Puppeteer is **explicitly excluded** from v1 per AD-13 — do not install it.

For this story, `utils/pdf.ts` is a stub regardless. Actual PDF implementation is Story 6.2.

---

## Environment Variable Rules (NFR-SEC-4)

- All secrets loaded exclusively via environment variables.
- No hardcoded values in source code for: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `STORAGE_PROVIDER`, API keys.
- Prisma 7 does NOT auto-load `.env` — `import 'dotenv/config'` must be the **first** import in `server.ts`.
- `.env` is gitignored; `.env.example` is committed.

---

## Definition of Done

- [ ] `docker compose up -d` starts Postgres 16 + pgAdmin with no errors
- [ ] `npx prisma migrate dev` creates all 9 tables (verified via psql or pgAdmin)
- [ ] Backend starts on port 4000 (`node src/server.js` or `tsx src/server.ts`) with no errors
- [ ] Frontend dev server starts successfully (no build/type errors)
- [ ] All 5 utils export without runtime errors when imported
- [ ] `AuthContext` initializes user and accessToken to `null`
- [ ] TailwindCSS v4 active via `@theme` in CSS; **no `tailwind.config.js` exists**
- [ ] React Router 7 routes render stub pages without errors
- [ ] `.env.example` documents all 6 required vars; no secrets in source
- [ ] `workingDays.ts` unit tests: ≥ 3 cases pass (no-holiday range, holiday-spanning range, single-day-holiday → 0)
- [ ] No Prisma calls outside `services/` directory
- [ ] No access token stored in localStorage, sessionStorage, or JS-readable cookie

---

## Next Story Preview

**Story 1.2 (User Login with JWT)** will use:
- `services/auth.ts` (new) — calls `prisma.user.findUnique`, bcrypt compare, JWT sign
- `middleware/auth.ts` (implement stub) — validate Bearer token, attach `req.user`
- `middleware/rbac.ts` (implement stub) — assert `req.user.role` against required roles
- `AuthContext.setAuth(user, token)` from 1.1's AuthContext
- `apiClient.ts` interceptor — attach `Authorization: Bearer <token>` from AuthContext state

Ensure stubs in 1.1 have the correct signatures so Story 1.2 can fill in the bodies without changing imports.

---

## Tasks / Subtasks

- [x] Task 1: Root project files
  - [x] Create docker-compose.yml (Postgres 16 + pgAdmin, healthcheck)
  - [x] Create .env.example with all 6 required vars documented
  - [x] Create README.md with setup instructions and seed credentials placeholder
  - [x] Create root .gitignore (.env, node_modules, dist, uploads/)

- [x] Task 2: Backend scaffolding (package.json, tsconfig.json, server.ts, app.ts)
  - [x] Create backend/package.json (type:module, all backend deps at correct versions)
  - [x] Create backend/tsconfig.json (ESM, Node 24, strict)
  - [x] Create backend/src/server.ts (import dotenv first, mount app, start cron)
  - [x] Create backend/src/app.ts (Express 5, middleware, routes)
  - [x] Create backend/uploads/.gitkeep (gitignored dir, keep entry)

- [x] Task 3: Prisma 7 setup (schema.prisma, prisma.config.ts, client.ts)
  - [x] Create backend/src/prisma/schema.prisma with all 9 tables and correct enums
  - [x] Create backend/prisma.config.ts (Prisma 7 defineConfig + adapter-pg; placed at backend root per CLI convention)
  - [x] Create backend/src/prisma/client.ts (singleton PrismaClient with adapter)
  - [x] Create backend/src/prisma/seed.ts stub (empty)

- [x] Task 4: Backend middleware
  - [x] Create backend/src/middleware/auth.ts stub (exports RequestHandler, calls next())
  - [x] Create backend/src/middleware/rbac.ts stub (factory returning RequestHandler, calls next())
  - [x] Create backend/src/middleware/upload.ts (Multer 2, PDF/JPG/PNG only, 5MB limit)
  - [x] Create backend/src/middleware/error.ts (AD-10 envelope error handler)

- [x] Task 5: Backend routes, services stubs
  - [x] Create backend/src/routes/index.ts stub (empty router)
  - [x] Create backend/src/services/leaveRequest.ts stub
  - [x] Create backend/src/services/leaveBalance.ts stub
  - [x] Create backend/src/services/audit.ts stub
  - [x] Create backend/src/services/notification.ts stub
  - [x] Create backend/src/controllers/.gitkeep (empty directory placeholder)

- [x] Task 6: Backend utils
  - [x] Create backend/src/utils/workingDays.ts (full implementation)
  - [x] Create backend/src/utils/storage.ts (local provider full, R2 stub)
  - [x] Create backend/src/utils/email.ts (Nodemailer fire-and-forget, AD-7)
  - [x] Create backend/src/utils/pdf.ts stub
  - [x] Create backend/src/utils/csv.ts stub

- [x] Task 7: workingDays unit tests (AC6)
  - [x] Create backend/src/utils/workingDays.test.ts with ≥3 required test cases (5 tests)
  - [x] Install backend dependencies and verify tests pass (5/5 pass)

- [x] Task 8: Backend jobs stub
  - [x] Create backend/src/jobs/resetBalances.ts (node-cron v4 createTask, no auto-start)

- [x] Task 9: Frontend scaffolding
  - [x] Create frontend/package.json (React 18, Router 7, TanStack Query 5, Tailwind 4)
  - [x] Create frontend/tsconfig.json
  - [x] Create frontend/vite.config.ts (react + @tailwindcss/vite plugins)
  - [x] Create frontend/index.html
  - [x] Create frontend/src/index.css (@import "tailwindcss"; @theme directive)
  - [x] Create frontend/src/main.tsx (createRoot, QueryClientProvider, BrowserRouter)

- [x] Task 10: Frontend App.tsx and AuthContext
  - [x] Create frontend/src/App.tsx (React Router 7 routes with RequireAuth + RequireRole)
  - [x] Create frontend/src/context/AuthContext.tsx (user + accessToken in React state only, never localStorage)

- [x] Task 11: Frontend lib
  - [x] Create frontend/src/lib/apiClient.ts stub (axios instance, 401 interceptor placeholder)
  - [x] Create frontend/src/lib/queryClient.ts (TanStack Query 5 QueryClient)
  - [x] Create frontend/src/lib/types.ts (TypeScript interfaces for all 9 entities)
  - [x] Create frontend/src/lib/constants.ts (Role enum, LeaveStatus enum, API_BASE_URL)

- [x] Task 12: Frontend features and pages stubs
  - [x] Create stub components for auth, leaves, employees, departments, leaveTypes, holidays, calendar, reports, audit, profile
  - [x] Create page stubs (DashboardPage renders role from AuthContext)

- [x] Task 13: Install frontend dependencies and verify dev server starts
  - [x] Frontend builds successfully (vite build: 100 modules transformed, 0 errors)

---

## Dev Agent Record

### Implementation Plan

Starting fresh implementation of story 1.1. Will follow the file structure in the story spec exactly, building backend then frontend. Red-green-refactor applied to workingDays.ts (write failing tests first, then implementation).

### Debug Log

1. **Prisma 7 schema.prisma breaking change**: `url = env("DATABASE_URL")` in datasource block is no longer supported. Removed from schema.prisma; URL now lives exclusively in `prisma.config.ts` (datasource.url field).
2. **prisma.config.ts location**: Prisma 7 CLI looks for `prisma.config.ts` next to `package.json` (backend root), not inside `src/prisma/`. Created at `backend/prisma.config.ts` with `schema: 'src/prisma/schema.prisma'` pointing to schema.
3. **node-cron v4 API change**: `{ scheduled: false }` option no longer exists in v4 `TaskOptions`. Used `createTask()` instead of `schedule()` — `createTask` creates a task without starting it, matching the story's intent.
4. **PrismaConfig has no adapter field**: In Prisma 7, adapter wiring is in `client.ts` constructor, not `prisma.config.ts`. Config file handles schema path + datasource URL for CLI migrations only.

### Completion Notes

- Implemented full monorepo scaffold: root config + backend (Express 5/Prisma 7/ESM) + frontend (React 18/Router 7/Tailwind 4)
- All 9 Prisma tables defined and schema validated (`prisma validate` passes)
- `workingDays.ts` fully implemented with timezone-safe YYYY-MM-DD comparison; 5 unit tests pass (3 required cases + 2 extra)
- `storage.ts`: local provider complete, R2 stub throws "not configured"
- `email.ts`: fire-and-forget Nodemailer wrapper, never re-throws (AD-7 compliant)
- `AuthContext.tsx`: user + accessToken stored in React useState only — no localStorage/sessionStorage/JS-readable cookie (AD-5 enforced)
- `upload.ts`: Multer 2 with PDF/JPEG/PNG filter and 5MB limit (NFR-SEC-2 compliant)
- All stub services/middleware have correct signatures for Story 1.2 to implement without changing imports
- Backend TypeScript: 0 errors. Frontend TypeScript: 0 errors. Frontend Vite build: 100 modules, 0 errors.
- AC3/AC4/AC5/AC6 fully verified. AC1/AC2 require Docker (database not available in build environment; all schema and config are correct for running migration)

---

## File List

Root:
- docker-compose.yml
- .env.example
- README.md
- .gitignore

Backend:
- backend/package.json
- backend/tsconfig.json
- backend/prisma.config.ts
- backend/uploads/.gitkeep
- backend/src/server.ts
- backend/src/app.ts
- backend/src/prisma/schema.prisma
- backend/src/prisma/client.ts
- backend/src/prisma/seed.ts
- backend/src/middleware/auth.ts
- backend/src/middleware/rbac.ts
- backend/src/middleware/upload.ts
- backend/src/middleware/error.ts
- backend/src/routes/index.ts
- backend/src/controllers/.gitkeep
- backend/src/services/leaveRequest.ts
- backend/src/services/leaveBalance.ts
- backend/src/services/audit.ts
- backend/src/services/notification.ts
- backend/src/utils/workingDays.ts
- backend/src/utils/workingDays.test.ts
- backend/src/utils/storage.ts
- backend/src/utils/email.ts
- backend/src/utils/pdf.ts
- backend/src/utils/csv.ts
- backend/src/jobs/resetBalances.ts

Frontend:
- frontend/package.json
- frontend/tsconfig.json
- frontend/vite.config.ts
- frontend/index.html
- frontend/src/index.css
- frontend/src/main.tsx
- frontend/src/App.tsx
- frontend/src/context/AuthContext.tsx
- frontend/src/lib/queryClient.ts
- frontend/src/lib/apiClient.ts
- frontend/src/lib/types.ts
- frontend/src/lib/constants.ts
- frontend/src/features/auth/index.tsx
- frontend/src/features/leaves/index.tsx
- frontend/src/features/employees/index.tsx
- frontend/src/features/departments/index.tsx
- frontend/src/features/leaveTypes/index.tsx
- frontend/src/features/holidays/index.tsx
- frontend/src/features/calendar/index.tsx
- frontend/src/features/reports/index.tsx
- frontend/src/features/audit/index.tsx
- frontend/src/features/profile/index.tsx
- frontend/src/pages/DashboardPage.tsx
- frontend/src/pages/ApprovalsPage.tsx

---

## Change Log

- 2026-06-30: Story status set to in-progress, implementation started
- 2026-06-30: All 13 tasks completed — monorepo scaffold, Docker, Prisma 7 schema (9 tables), backend middleware/services/utils/jobs, frontend React 18/Router 7/Tailwind 4 scaffold. 5/5 workingDays unit tests pass. Backend and frontend TypeScript compile clean. Prisma schema validated. Notable: prisma.config.ts placed at backend/ root (not src/prisma/) per Prisma 7 CLI convention; node-cron v4 uses createTask() instead of schedule()+{scheduled:false}; Prisma 7 schema.prisma datasource block has no url field.
