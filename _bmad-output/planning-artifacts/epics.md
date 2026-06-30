---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-epic-1
  - step-03-epic-2
  - step-03-epic-3
  - step-03-epic-4
  - step-03-epic-5
  - step-03-epic-6
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-employee-leave-management-system-2026-06-29/prd.md
  - _bmad-output/planning-artifacts/prds/prd-employee-leave-management-system-2026-06-29/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md
---

# Employee Leave Management System - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Employee Leave Management System, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-AUTH-1: Users log in with email and password; receive a JWT on success
FR-AUTH-2: JWT is validated on every protected API route; role enforced server-side
FR-AUTH-3: Passwords stored as bcrypt hashes; plaintext never persisted
FR-AUTH-4: Silent token refresh via refresh token stored in httpOnly cookie
FR-AUTH-5: Logout invalidates the refresh token

FR-EMP-1: Admin can create, read, update, and deactivate employee accounts
FR-EMP-2: Admin assigns role (Admin / Manager / Employee) per account
FR-EMP-3: Admin assigns employee to a department and sets their reporting manager
FR-EMP-4: Admin can override the default leave balance for any employee per leave type

FR-DEPT-1: Admin can create, rename, and deactivate departments
FR-DEPT-2: Admin assigns a manager to each department

FR-LT-1: System ships with five predefined leave types: Sick, Annual, Casual, Maternity/Paternity, Unpaid
FR-LT-2: Admin can add new leave types, rename existing ones, or deactivate them via a CRUD table
FR-LT-3: Each leave type carries: name, default annual quota (days), document-required flag, active status
FR-LT-4: Document-required flag is a simple checkbox per leave type; Sick leave defaults to required, Annual defaults to not required

FR-BAL-1: Default annual quota per leave type applies to all employees unless overridden
FR-BAL-2: Admin can set a per-employee override for any leave type
FR-BAL-3: All balances reset to their configured quota on January 1st; no carry-forward
FR-BAL-4: Balance is deducted when a leave request is approved; restored on rejection or cancellation
FR-BAL-5: Employee dashboard displays remaining balance per active leave type

FR-HOL-1: Admin can create, edit, and delete company holidays (date + name)
FR-HOL-2: Holidays are excluded when calculating working days for a leave request
FR-HOL-3: Holiday list is visible read-only to all authenticated users

FR-REQ-1: Employee submits a request specifying: leave type, start date, end date, reason (text), and optional document
FR-REQ-2: System calculates leave duration in working days (weekdays minus company holidays)
FR-REQ-3: If remaining balance is insufficient, system warns the employee but still allows submission
FR-REQ-4: If one or more team members have approved leave overlapping the requested dates, system shows a warning banner; submission is not blocked
FR-REQ-5: If the selected leave type has document-required = true, a file upload is mandatory before submission
FR-REQ-6: Employee can cancel their own request while it is in Pending status
FR-REQ-7: Employee can view their full leave history with status (Pending / Approved / Rejected / Cancelled)

FR-APPR-1: Manager sees all Pending requests from their direct reports
FR-APPR-2: Admin sees all Pending requests across the organization
FR-APPR-3: Approver can Approve or Reject a request; an optional comment is captured either way
FR-APPR-4: Approving a request immediately deducts the calculated days from the employee's balance
FR-APPR-5: Rejecting or the employee cancelling a previously approved request restores the balance
FR-APPR-6: Approver can view the attached document before deciding

FR-NOTIF-1: Email sent to the employee's manager when a new leave request is submitted
FR-NOTIF-2: Email sent to the employee when their request is approved or rejected
FR-NOTIF-3: Email sent to the employee when their approved request is cancelled by an admin
FR-NOTIF-4: In-app notification badge reflects unread notification count

FR-CAL-1: Month-view calendar showing approved leaves for all team members
FR-CAL-2: Leave entries colour-coded by leave type
FR-CAL-3: Company holidays marked on the calendar

FR-DASH-1: Employee dashboard: leave balance cards per type, recent requests list, upcoming approved leaves
FR-DASH-2: Manager dashboard: count of pending approvals, list of team members on leave today, team leave summary
FR-DASH-3: Admin dashboard: org-wide pending request count, department leave summary, total leaves taken this month

FR-SRCH-1: Leave request lists filterable by: status, date range, leave type, and employee name
FR-SRCH-2: Employee list searchable by name and filterable by department
FR-SRCH-3: All list views paginated server-side (default 20 rows per page)

FR-RPT-1: Admin can generate a leave report filtered by department, date range, and/or leave type
FR-RPT-2: Manager can generate a team leave report for their department
FR-RPT-3: Reports exportable as CSV
FR-RPT-4: Reports exportable as PDF
FR-RPT-5: Report generation is on-demand; no scheduled delivery

FR-AUDIT-1: Every leave state transition (Submit, Approve, Reject, Cancel) is logged with: actor, target employee, leave request ID, action, timestamp, and optional comment
FR-AUDIT-2: Audit log is visible to Admin only, with filter by date range and employee
FR-AUDIT-3: Audit log is read-only; no entry may be edited or deleted

FR-PROFILE-1: Employee can update their display name, contact email, phone number, and profile photo
FR-PROFILE-2: Employee cannot change their own role, department, or reporting manager

FR-SEED-1: Application ships with seeded accounts: admin@demo.com, manager@demo.com, employee@demo.com — all with known passwords documented in the project README
FR-SEED-2: Seed data includes at least two departments, five employees, and leave requests in every status (Pending, Approved, Rejected, Cancelled)

### NonFunctional Requirements

NFR-SEC-1: RBAC enforced at the API layer; UI-only restriction is insufficient
NFR-SEC-2: File uploads restricted to PDF, JPG, PNG; maximum 5 MB per file
NFR-SEC-3: JWT access token expires in 15 minutes; refresh token in 7 days
NFR-SEC-4: All secrets (DB URL, JWT secret, storage credentials) loaded via environment variables; no hardcoded values
NFR-PERF-1: API responses for list and detail endpoints return within 500 ms under normal load
NFR-UX-1: UI is responsive and usable on desktop and tablet; mobile is not a v1 requirement
NFR-DEPL-1: Application is publicly accessible via HTTPS at a stable URL
NFR-DEPL-2: Database schema managed via migrations; seed script is idempotent and re-runnable

### Additional Requirements

- No starter template — build from scratch using the structural seed defined in Architecture
- Monorepo: `frontend/` and `backend/` as top-level sibling directories; no cross-boundary runtime imports (AD-11)
- Development environment uses Docker Compose for PostgreSQL 16 + pgAdmin (Architecture Structural Seed)
- All balance mutations (approve/reject/cancel) must execute inside a single Prisma transaction; overlap SELECT in submit() also runs inside the same transaction (AD-4)
- File storage abstraction via `utils/storage.ts`; active provider toggled by `STORAGE_PROVIDER` env var (`local` | `r2`) — local disk for dev, Cloudflare R2 for prod (AD-6)
- Email is fire-and-forget: `utils/email.ts` catches its own errors and never re-throws; response is sent independently of email delivery (AD-7)
- Audit log is append-only; `services/audit` exposes only `append()`; no UPDATE or DELETE ever issued against `audit_logs` table (AD-8)
- Working-day calculation is server-side only via `utils/workingDays.ts`; frontend renders the server-returned `duration_days` field (AD-9)
- Unified API response envelope: `{ success: boolean, data?: T, error?: string, meta?: { page, limit, total } }` on every response (AD-10)
- Annual leave balance reset runs as a `node-cron` job on January 1st; no HTTP endpoint for triggering it (AD-12)
- PDF reports generated via `@cantoo/pdf-lib` (active fork of abandoned pdf-lib); Puppeteer explicitly excluded from v1 (AD-13). **Verify `@cantoo/pdf-lib` package availability and API compatibility before building the PDF module; fall back to `pdf-lib` if the package is unavailable or incompatible.**
- Notification recipients are fixed by event type: SUBMITTED → employee's manager; APPROVED/REJECTED/ADMIN_CANCELLED → submitting employee (AD-14)
- `leave_balances` rows provisioned eagerly on user creation (one row per active leave type); also when a new leave type is added, rows are created for all existing employees (AD-15)
- Every notifiable event writes an in-app `notifications` row AND calls `email.send()`; neither path is optional (AD-16)
- Prisma 7: datasource config in `prisma.config.ts`; driver adapter `@prisma/adapter-pg` required; ESM-only; env vars not auto-loaded (Stack)
- TailwindCSS v4: CSS-first config via `@theme` directive in root CSS; no `tailwind.config.js` (Stack)
- Access token stored in React `AuthContext` state only (never localStorage, sessionStorage, or JS-readable cookie); refresh token in `HttpOnly; SameSite=Strict` cookie (AD-5)
- In-app notification polling interval vs WebSocket upgrade deferred; implement simple polling for v1 (Architecture Deferred)

### UX Design Requirements

No UX Design document was found for this project. UX requirements are covered via NFR-UX-1 (responsive desktop + tablet) and role-specific dashboard layouts defined in FR-DASH.

### FR Coverage Map

| FR | Epic |
|---|---|
| FR-AUTH-1 through FR-AUTH-5 | Epic 1 — Login, JWT, refresh, logout |
| FR-SEED-1, FR-SEED-2 | Epic 1 — Demo seed accounts + data |
| FR-DEPT-1, FR-DEPT-2 | Epic 2 — Department CRUD |
| FR-LT-1 through FR-LT-4 | Epic 2 — Leave type CRUD + doc-required flag |
| FR-HOL-1 through FR-HOL-3 | Epic 2 — Holiday management + working-day wiring |
| FR-EMP-1 through FR-EMP-4 | Epic 3 — Employee CRUD + role/dept/manager assignment |
| FR-BAL-1, FR-BAL-2, FR-BAL-3 | Epic 3 — Default quotas, per-employee override, Jan 1 reset |
| FR-SRCH-2, FR-SRCH-3 | Epic 3 — Employee list search/filter + server-side pagination contract |
| FR-REQ-1 through FR-REQ-7 | Epic 4 — Leave submission, calc, warnings, doc upload, history, cancel |
| FR-APPR-1 through FR-APPR-6 | Epic 4 — Approval queue, approve/reject/comment, doc view |
| FR-BAL-4 | Epic 4 — Balance deduction/restore on approve/reject/cancel |
| FR-NOTIF-1 through FR-NOTIF-4 | Epic 4 — Email + in-app notifications |
| FR-AUDIT-1 | Epic 4 — Audit log write on every state transition |
| FR-SRCH-1 | Epic 4 — Leave list filter by status/date/type/employee |
| FR-DASH-1 through FR-DASH-3 | Epic 5 — Role-specific dashboards |
| FR-CAL-1 through FR-CAL-3 | Epic 5 — Department leave calendar |
| FR-BAL-5 | Epic 5 — Balance display on employee dashboard |
| FR-RPT-1 through FR-RPT-5 | Epic 6 — Reports + CSV + PDF export |
| FR-AUDIT-2, FR-AUDIT-3 | Epic 6 — Audit log admin view (read-only, filtered) |
| FR-PROFILE-1, FR-PROFILE-2 | Epic 6 — Employee self-service profile edit |

## Epic List

### Epic 1: Foundation, Authentication & Project Scaffold
Users can log in with their role-appropriate credentials, receive a JWT, silently refresh their session, and log out. The monorepo skeleton, database schema, and all shared infrastructure (middleware, API envelope, file storage abstraction, email utility, balance reset job) are in place. Demo seed data is ready so any of the three role accounts works immediately.
**FRs covered:** FR-AUTH-1, FR-AUTH-2, FR-AUTH-3, FR-AUTH-4, FR-AUTH-5, FR-SEED-1, FR-SEED-2
**NFRs addressed:** NFR-SEC-1, NFR-SEC-2, NFR-SEC-3, NFR-SEC-4, NFR-DEPL-1, NFR-DEPL-2
**ADs addressed:** AD-1, AD-3, AD-5, AD-6, AD-7, AD-10, AD-11, AD-12, AD-15, AD-16

### Epic 2: Admin System Configuration — Departments, Leave Types & Holidays
An admin can fully configure the organisational structure: create and manage departments, define leave types (including which require document upload), set default annual quotas, and manage the company holiday calendar. All authenticated users can view the holiday list read-only. The working-day calculation utility is wired to the holiday table.
**FRs covered:** FR-DEPT-1, FR-DEPT-2, FR-LT-1, FR-LT-2, FR-LT-3, FR-LT-4, FR-HOL-1, FR-HOL-2, FR-HOL-3

### Epic 3: Employee Management & Leave Balances
An admin can create, update, deactivate, search, and filter employees; assign roles, departments, and reporting managers; and override individual leave balances per type. Leave balance rows are provisioned eagerly on employee creation and when new leave types are added. Server-side pagination is established for all list endpoints.
**FRs covered:** FR-EMP-1, FR-EMP-2, FR-EMP-3, FR-EMP-4, FR-BAL-1, FR-BAL-2, FR-BAL-3, FR-SRCH-2, FR-SRCH-3
**ADs addressed:** AD-2, AD-4, AD-15

### Epic 4: Leave Request Lifecycle
An employee can submit a leave request (with working-day calculation, balance warning, overlap warning, and mandatory document upload when required), view their leave history, and cancel pending requests. Managers see and action requests from their direct reports; admins see all pending requests org-wide. Approving/rejecting triggers balance deduction or restore in a single transaction, appends an audit log entry, and fires email + in-app notifications (fire-and-forget). Leave lists are filterable by status, date range, leave type, and employee name.
**FRs covered:** FR-REQ-1, FR-REQ-2, FR-REQ-3, FR-REQ-4, FR-REQ-5, FR-REQ-6, FR-REQ-7, FR-APPR-1, FR-APPR-2, FR-APPR-3, FR-APPR-4, FR-APPR-5, FR-APPR-6, FR-BAL-4, FR-NOTIF-1, FR-NOTIF-2, FR-NOTIF-3, FR-NOTIF-4, FR-AUDIT-1, FR-SRCH-1
**ADs addressed:** AD-2, AD-4, AD-7, AD-8, AD-9, AD-14, AD-16

### Epic 5: Role Dashboards & Department Leave Calendar
Each role sees a tailored dashboard on login: employees see balance cards, recent requests, and upcoming approved leaves; managers see pending approval counts, team members on leave today, and a team summary; admins see org-wide pending counts, a department summary, and monthly totals. Managers also get a month-view department leave calendar with leave entries colour-coded by type and company holidays marked.
**FRs covered:** FR-DASH-1, FR-DASH-2, FR-DASH-3, FR-CAL-1, FR-CAL-2, FR-CAL-3, FR-BAL-5

### Epic 6: Reports, Audit Log View & Employee Profile
Admins and managers can generate and export leave reports (CSV and PDF) filtered by department, date range, and leave type. Admins can view the full read-only audit log filtered by date and employee. Employees can update their own profile (name, contact, photo) but cannot change their role, department, or manager. PDF story includes @cantoo/pdf-lib verification; falls back to pdf-lib if unavailable.
**FRs covered:** FR-RPT-1, FR-RPT-2, FR-RPT-3, FR-RPT-4, FR-RPT-5, FR-AUDIT-2, FR-AUDIT-3, FR-PROFILE-1, FR-PROFILE-2
**ADs addressed:** AD-8, AD-13

---

## Epic 1: Foundation, Authentication & Project Scaffold

Users can log in with their role-appropriate credentials, receive a JWT, silently refresh their session, and log out. The monorepo skeleton, database schema, and all shared infrastructure are in place. Demo seed data is ready so any of the three role accounts works immediately.

### Story 1.1: Monorepo Scaffold, Docker & Database Schema

As a developer,
I want the monorepo skeleton, Docker Compose environment, complete Prisma schema, and all shared backend/frontend scaffolding in place,
So that every subsequent story has a runnable, consistent foundation with no structural rework.

**Acceptance Criteria:**

**Given** the repository is freshly cloned
**When** `docker compose up -d` is run followed by backend and frontend dev start commands
**Then** the backend starts on port 4000 with no errors and the frontend dev server starts successfully

**Given** the Prisma schema
**When** `npx prisma migrate dev` is run
**Then** all nine tables exist: `users`, `departments`, `leave_types`, `leave_balances`, `leave_requests`, `audit_logs`, `company_holidays`, `refresh_tokens`, `notifications`

**Given** the backend utility modules
**When** they are imported
**Then** `utils/workingDays.ts`, `utils/storage.ts` (local provider), `utils/email.ts`, `utils/pdf.ts`, and `utils/csv.ts` export their interfaces without runtime errors

**Given** the frontend scaffold
**When** the app loads in a browser
**Then** React Router 7 is wired with route stubs per role; TanStack Query client is initialized; TailwindCSS v4 uses `@theme` directive in root CSS with no `tailwind.config.js`; `AuthContext` provides user state initialized to `null`

**Given** `.env.example`
**When** inspected
**Then** all required vars are documented (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `STORAGE_PROVIDER`, `PORT`, `EMAIL_PROVIDER`); no secrets are hardcoded anywhere in source

### Story 1.2: User Login with JWT

As an employee, manager, or admin,
I want to log in with my email and password and receive a JWT session,
So that I can access my role-appropriate features without re-entering credentials on each request.

**Acceptance Criteria:**

**Given** a user with valid credentials exists
**When** `POST /auth/login` is called with correct email and password
**Then** a 200 response returns `{ success: true, data: { accessToken, user: { id, email, role, name } } }` and a `HttpOnly; SameSite=Strict` refresh token cookie is set

**Given** `POST /auth/login` is called
**When** the access token is generated
**Then** it expires in 15 minutes and carries `{ userId, role }` in its payload; the password is verified via bcrypt compare against the stored hash; plaintext is never logged or returned

**Given** `POST /auth/login` is called with an incorrect password or unknown email
**When** the request is processed
**Then** a 401 response returns `{ success: false, error: "Invalid credentials" }` with no distinguishable timing difference between the two failure cases

**Given** the login page on the frontend
**When** a user submits valid credentials
**Then** the access token and user object are stored only in `AuthContext` React state (never in localStorage, sessionStorage, or a JS-readable cookie); the user is redirected to their role-specific route stub

**Given** the login page
**When** login fails
**Then** an inline error message is displayed beneath the form without a page reload

### Story 1.3: Silent Token Refresh & Logout

As a logged-in user,
I want my session to automatically renew before my access token expires, and to be able to log out securely,
So that I stay authenticated throughout normal use and can cleanly end my session.

**Acceptance Criteria:**

**Given** a valid httpOnly refresh token cookie exists
**When** `POST /auth/refresh` is called
**Then** a 200 response returns a new access token; an expired or absent refresh token returns 401 and clears the cookie

**Given** `apiClient.ts`
**When** any API call returns 401 (expired access token)
**Then** the client automatically calls `POST /auth/refresh`, stores the new access token in `AuthContext`, and retries the original request exactly once; if the refresh call also fails, the user is redirected to the login page

**Given** a logged-in user clicks Logout
**When** `POST /auth/logout` is called
**Then** the refresh token row is deleted from `refresh_tokens`; the httpOnly cookie is cleared in the response; `AuthContext` is reset to `null`; the user lands on the login page

**Given** any protected API route
**When** a request arrives without a valid `Authorization: Bearer <token>` header
**Then** `middleware/auth` returns 401 with `{ success: false, error: "Unauthorized" }` and `middleware/rbac` is never reached
**And** when the JWT is valid but the role does not satisfy the required role, `middleware/rbac` returns 403 with `{ success: false, error: "Forbidden" }`

### Story 1.4: Demo Seed Data

As a portfolio reviewer,
I want to log in immediately as admin, manager, or employee using documented demo credentials,
So that I can explore all three role experiences without any account setup.

**Acceptance Criteria:**

**Given** `prisma/seed.ts` is run via `npx prisma db seed`
**When** executed against an empty or already-seeded database
**Then** the script completes without errors and is fully idempotent (safe to re-run without creating duplicates)

**Given** the seeded database
**When** logging in with demo credentials
**Then** `admin@demo.com` (role: ADMIN), `manager@demo.com` (role: MANAGER), and `employee@demo.com` (role: EMPLOYEE) all authenticate successfully with passwords documented in `README.md`

**Given** the seeded database
**When** inspected
**Then** at least 2 departments exist; at least 5 employees are distributed across those departments; 5 leave types exist (Sick, Annual, Casual, Maternity/Paternity, Unpaid); leave requests exist in all four statuses (Pending, Approved, Rejected, Cancelled); every seeded user has one `leave_balances` row per active leave type

**Given** `README.md`
**When** a reviewer reads it
**Then** all three demo credentials and their passwords are clearly documented alongside instructions for running the seed

---

## Epic 2: Admin System Configuration — Departments, Leave Types & Holidays

An admin can fully configure the organisational structure: create and manage departments, define leave types (including which require document upload), set default annual quotas, and manage the company holiday calendar. All authenticated users can view the holiday list read-only. The working-day calculation utility is wired to the holiday table.

### Story 2.1: Department Management

As an admin,
I want to create, rename, and deactivate departments, and assign a manager to each,
So that the organisational structure is in place before employees are added.

**Acceptance Criteria:**

**Given** an admin is authenticated
**When** `POST /departments` is called with a department name
**Then** a 201 response returns the new department; a duplicate name returns 409 `{ success: false, error: "Department name already exists" }`

**Given** an existing department
**When** `PATCH /departments/:id` is called with a new name or `active: false`
**Then** a 200 response reflects the update; deactivating a department does not delete it or affect its employees

**Given** an existing department
**When** `PATCH /departments/:id` is called with a `managerId` that belongs to a MANAGER-role user
**Then** that user is set as the department manager; a non-MANAGER userId returns 400

**Given** `GET /departments`
**When** called by any authenticated user
**Then** a paginated list `{ success, data: [...], meta: { page, limit, total } }` is returned per AD-3; admins see all departments; managers and employees see only active departments

**Given** the admin UI
**When** the Departments page is visited
**Then** a table lists all departments with columns: name, manager, status, and action buttons (Edit, Deactivate); an Add Department modal allows creating a new department with name and manager selection

### Story 2.2: Leave Type Management

As an admin,
I want to add, rename, and deactivate leave types with configurable annual quotas and document-required flags,
So that the system reflects exactly which categories of leave employees can request and what documentation each requires.

**Acceptance Criteria:**

**Given** the seeded database from Story 1.4
**When** `GET /leave-types` is called
**Then** the five predefined types are returned: Sick (document_required: true), Annual (document_required: false), Casual, Maternity/Paternity, Unpaid

**Given** an admin is authenticated
**When** `POST /leave-types` is called with `{ name, default_quota, document_required }`
**Then** a 201 response returns the new leave type; a `leave_balances` row at the new default_quota is created for every existing active employee (AD-15); duplicate name returns 409

**Given** an existing leave type
**When** `PATCH /leave-types/:id` is called to update name, quota, or `document_required`
**Then** a 200 response reflects the update; changing `document_required` does not retroactively affect existing leave requests

**Given** an existing leave type
**When** `PATCH /leave-types/:id` is called with `active: false`
**Then** the leave type is deactivated; it no longer appears in the employee leave-request form; existing approved requests of this type are unaffected

**Given** the admin UI
**When** the Leave Types page is visited
**Then** a CRUD table lists all leave types with columns: name, default quota (days), document required (checkbox), status; inline Edit and Deactivate actions are available; an Add Leave Type form collects name, quota, and document-required flag

### Story 2.3: Company Holiday Management & Working-Day Calculation

As an admin,
I want to create, edit, and delete company holidays,
So that leave duration calculations correctly exclude public holidays, and all users can see upcoming holidays.

**Acceptance Criteria:**

**Given** an admin is authenticated
**When** `POST /company-holidays` is called with `{ date: "YYYY-MM-DD", name }`
**Then** a 201 response returns the new holiday; a duplicate date returns 409

**Given** an existing holiday
**When** `PATCH /company-holidays/:id` is called with a new date or name
**Then** a 200 response reflects the update

**Given** an existing holiday
**When** `DELETE /company-holidays/:id` is called by an admin
**Then** a 200 response confirms deletion; the holiday no longer appears in any list or working-day calculation

**Given** any authenticated user
**When** `GET /company-holidays` is called
**Then** all holidays are returned in ascending date order (paginated per AD-3); no role restriction on reads

**Given** `utils/workingDays.ts`
**When** called with a start date, end date, and the current holidays list
**Then** it returns the count of weekdays (Mon–Fri) in that inclusive range that do not fall on any company holiday; unit tests verify at least three cases: a range with no holidays, a range spanning a holiday, and a single-day holiday request

**Given** the admin UI
**When** the Company Holidays page is visited
**Then** a table lists all holidays with date and name columns; Add, Edit, and Delete actions are available; the date picker enforces `YYYY-MM-DD` format

---

## Epic 3: Employee Management & Leave Balances

An admin can create, update, deactivate, search, and filter employees; assign roles, departments, and reporting managers; and override individual leave balances per type. Leave balance rows are provisioned eagerly on employee creation. Server-side pagination is established for all list endpoints.

### Story 3.1: Employee Account Management

As an admin,
I want to create, update, deactivate, and assign roles, departments, and reporting managers to employee accounts,
So that the full workforce is represented in the system with correct access levels.

**Acceptance Criteria:**

**Given** an admin is authenticated
**When** `POST /employees` is called with `{ email, name, role, departmentId, managerId, password }`
**Then** a 201 response returns the new employee (password excluded from response); password is bcrypt-hashed before storage; a `leave_balances` row at `default_quota` is created for every active leave type (AD-15); duplicate email returns 409

**Given** an existing employee
**When** `PATCH /employees/:id` is called with updated name, role, departmentId, or managerId
**Then** a 200 response reflects the changes; role, department, and manager can each be updated independently

**Given** an existing employee
**When** `PATCH /employees/:id` is called with `active: false`
**Then** the account is deactivated; the employee can no longer log in; their historical records (leave requests, audit logs, balances) are preserved

**Given** `GET /employees/:id`
**When** called by an admin
**Then** returns the employee's full profile: name, email, role, department, manager, active status

**Given** the admin UI Employee Management page
**When** Add Employee is clicked
**Then** a modal opens with fields for name, email, temporary password, role, department, and manager; submitting creates the account and refreshes the list

**Given** the admin UI employee table
**When** an employee row's Edit action is clicked
**Then** a modal pre-fills current values for name, role, department, and manager; saving calls `PATCH /employees/:id`

### Story 3.2: Employee List Search, Filter & Pagination

As an admin,
I want to search employees by name or email and filter by department, with server-side paginated results,
So that I can efficiently locate any employee in organisations with many staff.

**Acceptance Criteria:**

**Given** `GET /employees` with no query parameters
**When** called by an admin
**Then** returns `{ success, data: [...], meta: { page, limit, total } }` with default `limit=20`; this pagination contract (AD-3) is consistent with all other list endpoints in the system

**Given** `GET /employees?search=alice`
**When** processed by the server
**Then** only employees whose name or email contains "alice" (case-insensitive) are returned

**Given** `GET /employees?departmentId=<uuid>`
**When** processed by the server
**Then** only employees belonging to that department are returned; search and department filter can be combined in a single request

**Given** `GET /employees?page=2&limit=10`
**When** processed by the server
**Then** the correct slice of results is returned with accurate `meta.total` reflecting the full filtered count

**Given** the admin UI employee table
**When** the page loads
**Then** a search input and a department filter dropdown appear above the table; changing either field re-fetches results; pagination controls (Previous / Next / page indicator) appear below the table

### Story 3.3: Leave Balance Management & Annual Reset

As an admin,
I want to view and manually adjust individual employee leave balances per leave type, with automatic reset to default quotas every January 1st,
So that special accommodations can be made and all balances stay accurate year over year.

**Acceptance Criteria:**

**Given** `GET /employees/:id/balances`
**When** called by an admin
**Then** returns all `leave_balances` rows for that employee: `{ leaveTypeId, leaveTypeName, balance, default_quota }`

**Given** `PATCH /employees/:id/balances/:leaveTypeId` is called with `{ balance: <integer> }`
**When** processed by the server
**Then** the `leave_balances` row is updated to the specified value; balance must be ≥ 0 (400 otherwise); the write goes through `services/leaveBalance` — no direct Prisma call from the controller (AD-2)

**Given** `jobs/resetBalances.ts` is wired into `server.ts` via `node-cron`
**When** January 1st 00:00 server time arrives
**Then** every `leave_balances` row is set to its leave type's `default_quota`; the job logs start and completion; no HTTP endpoint exists that can trigger the reset (AD-12)

**Given** the admin UI employee detail page
**When** the Balances section is viewed
**Then** a table shows each active leave type with current balance and default quota; an inline edit control lets the admin enter a new balance value and save it per leave type

**Given** a non-admin user
**When** `GET` or `PATCH /employees/:id/balances` is called
**Then** a 403 response is returned; balance management is admin-only

---

## Epic 4: Leave Request Lifecycle

An employee can submit a leave request, view history, and cancel pending requests. Managers and admins review, approve, or reject requests with optional comments. Approval/rejection triggers atomic balance changes, audit logging, and fire-and-forget notifications. Leave lists are filterable.

### Story 4.1: Leave Request Submission

As an employee,
I want to submit a leave request specifying type, dates, reason, and an optional or required document,
So that my manager is notified and my request enters the approval workflow.

**Acceptance Criteria:**

**Given** an authenticated employee
**When** `POST /leave-requests` is called with `{ leaveTypeId, startDate, endDate, reason, document? }`
**Then** a 201 response returns the new request including `duration_days` calculated server-side by `utils/workingDays.ts` (AD-9); status is PENDING

**Given** the selected leave type has `document_required: true`
**When** `POST /leave-requests` is called without a file
**Then** a 400 response returns `{ success: false, error: "Document is required for this leave type" }`

**Given** a file is attached
**When** `upload.ts` middleware processes it
**Then** only PDF, JPG, PNG files ≤ 5 MB are accepted (NFR-SEC-2); the file is saved via `utils/storage.ts` and the path stored in `leave_requests.document_path`; rejected file type or size returns 400

**Given** the employee's remaining balance is less than `duration_days`
**When** `POST /leave-requests` is processed
**Then** the request is created (not blocked); the response includes `{ balanceWarning: true }`; the frontend displays a visible warning to the employee

**Given** one or more team members have an approved leave overlapping the requested dates
**When** `POST /leave-requests` is processed
**Then** the request is created (not blocked); the response includes `{ overlapWarning: true, overlappingLeaves: [...] }`; the frontend shows a warning banner

**Given** the leave request submission form
**When** an employee selects a leave type with `document_required: true`
**Then** the file upload field is mandatory; the form cannot be submitted without it

**Given** the submit transaction (AD-4)
**When** `POST /leave-requests` executes
**Then** the overlap availability SELECT and the INSERT into `leave_requests` run inside a single Prisma transaction; balance is NOT deducted at submission time

**Given** a leave request is successfully created
**When** the transaction commits
**Then** `services/audit.append({ action: 'SUBMITTED', actorId: employee.id, leaveRequestId, timestamp })` is called and an `audit_logs` entry exists for this submission (FR-AUDIT-1)

### Story 4.2: Employee Leave History & Cancel

As an employee,
I want to view my full leave request history with status and cancel requests that are still pending,
So that I can track my leave and withdraw requests I no longer need.

**Acceptance Criteria:**

**Given** an authenticated employee
**When** `GET /leave-requests` is called
**Then** returns only that employee's own leave requests (paginated, default limit=20); each record includes: leave type name, start date, end date, duration days, status, reason, submission date

**Given** a leave request in PENDING status owned by the authenticated employee
**When** `PATCH /leave-requests/:id/cancel` is called
**Then** status is set to CANCELLED; no balance change occurs (balance is only deducted on approval per FR-BAL-4); a 200 response confirms cancellation

**Given** a leave request in APPROVED or REJECTED status
**When** the employee attempts to cancel it
**Then** a 400 response returns `{ success: false, error: "Only pending requests can be cancelled by the employee" }`

**Given** an employee attempts to cancel a request belonging to another employee
**When** the request is processed
**Then** a 403 response is returned

**Given** a leave request in PENDING status owned by the authenticated employee is successfully cancelled
**When** `PATCH /leave-requests/:id/cancel` completes
**Then** `services/audit.append({ action: 'CANCELLED', actorId: employee.id, leaveRequestId, timestamp })` is called and an `audit_logs` entry exists for this cancellation (FR-AUDIT-1)

**Given** the employee UI Leave History page
**When** loaded
**Then** a table lists all requests with columns: leave type, dates, duration, status (colour-coded badge), and a Cancel button visible only on PENDING rows; clicking Cancel shows a confirmation dialog before calling the API

### Story 4.3: Approval Queue, Approve/Reject & Audit

As a manager or admin,
I want to review pending leave requests, approve or reject them with an optional comment, view attached documents, and have every decision logged to the audit trail,
So that the leave lifecycle is governed and every action is permanently traceable.

**Acceptance Criteria:**

**Given** an authenticated manager
**When** `GET /leave-requests?status=PENDING` is called
**Then** only PENDING requests from the manager's direct reports are returned (scoped by `users.manager_id`); paginated per AD-3

**Given** an authenticated admin
**When** `GET /leave-requests?status=PENDING` is called
**Then** PENDING requests from all employees org-wide are returned; paginated per AD-3

**Given** `POST /leave-requests/:id/approve` is called with optional `{ comment }`
**When** processed
**Then** inside a single Prisma transaction (AD-4): status → APPROVED, `duration_days` deducted from `leave_balances` via `services/leaveBalance`, an `audit_logs` entry appended via `services/audit.append()` with actor, target employee, leave request ID, action=APPROVED, timestamp, and comment

**Given** `POST /leave-requests/:id/reject` is called with optional `{ comment }`
**When** processed
**Then** inside a single Prisma transaction: status → REJECTED; balance unchanged (no deduction occurred at submission); audit entry appended with action=REJECTED

**Given** an admin calls `POST /leave-requests/:id/cancel` on an APPROVED request
**When** processed
**Then** inside a single Prisma transaction: status → CANCELLED; exactly `leave_requests.duration_days` is restored to the employee's balance (no re-computation, per AD-4); audit entry appended with action=CANCELLED

**Given** a leave request has `document_path` set
**When** `GET /leave-requests/:id/document` is called by an approver
**Then** a URL is returned via `utils/storage.getSignedUrl()`; managers may only access documents for their own direct reports; admins may access any

**Given** a manager attempts to approve a request from outside their direct reports
**When** the request is processed
**Then** a 403 response is returned

**Given** `services/audit`
**When** any method other than `append()` is attempted
**Then** no such method exists on the service; the `audit_logs` table is never targeted by UPDATE or DELETE (AD-8)

> **Developer note:** The `services/notification.trigger()` calls inside `approve()`, `reject()`, and admin `cancel()` should be left as a no-op stub in this story (e.g., `// TODO: wired in Story 4.4`) and fully implemented in Story 4.4. This story's ACs cover the transaction, balance change, and audit trail only.

**Given** the approval queue UI
**When** visited by a manager or admin
**Then** a table lists pending requests with: employee name, leave type, dates, duration, reason, and a document link if present; Approve and Reject buttons open a modal with an optional comment field

### Story 4.4: Email & In-App Notifications

As an employee or manager,
I want to receive email and in-app notifications at each stage of the leave lifecycle,
So that I am informed about requests I submitted or need to action without polling the system.

**Acceptance Criteria:**

**Given** a new leave request is submitted
**When** `services/notification.trigger(SUBMITTED, managerId)` is called after the DB transaction commits
**Then** a `notifications` row is inserted for the manager; `utils/email.send()` fires to the manager's email; email errors are caught, logged, and never re-thrown; the HTTP response is independent of email delivery (AD-7, AD-16)

**Given** a leave request is approved or rejected
**When** `services/notification.trigger(APPROVED | REJECTED, employeeId)` is called after the transaction commits
**Then** a `notifications` row is inserted for the employee; `utils/email.send()` fires to the employee's email; failures are fire-and-forget

**Given** an admin cancels an approved leave request
**When** `services/notification.trigger(ADMIN_CANCELLED, employeeId)` is called
**Then** a `notifications` row is inserted for the submitting employee; email fires to the employee only (AD-14: no other recipients)

**Given** `GET /notifications` is called by an authenticated user
**When** processed
**Then** returns that user's notifications in reverse chronological order (paginated); each item includes: message, read status, timestamp

**Given** `PATCH /notifications/:id/read` is called
**When** processed
**Then** the notification's `read` flag is set to `true`; a 200 response confirms the update

**Given** the frontend navigation bar
**When** the user is logged in
**Then** a notification bell icon shows the count of unread notifications (from `GET /notifications?read=false`); clicking the bell opens a dropdown of recent notifications; clicking a notification marks it read via the API

### Story 4.5: Leave List Filtering

As a manager or admin,
I want to filter the leave request list by status, date range, leave type, and employee name,
So that I can locate specific requests without scrolling through an unfiltered list.

**Acceptance Criteria:**

**Given** `GET /leave-requests?status=APPROVED`
**When** processed
**Then** only APPROVED requests are returned; valid statuses are PENDING, APPROVED, REJECTED, CANCELLED; an invalid value returns 400

**Given** `GET /leave-requests?startDate=2026-01-01&endDate=2026-01-31`
**When** processed
**Then** only requests where the leave period overlaps the given date range are returned

**Given** `GET /leave-requests?leaveTypeId=<uuid>`
**When** processed
**Then** only requests of that leave type are returned

**Given** `GET /leave-requests?search=alice` called by a manager or admin
**When** processed
**Then** only requests where the submitting employee's name contains "alice" (case-insensitive) are returned; employees calling this endpoint only see their own requests regardless of search term

**Given** multiple filters are combined
**When** processed
**Then** all filters are applied with AND logic; paginated results include accurate `meta.total`

**Given** the leave list UI (manager approval queue and admin view)
**When** the page loads
**Then** filter controls appear: status dropdown, start/end date pickers, leave type dropdown, employee name search; changing any filter re-fetches results; active filters are reflected in the URL query string

---

## Epic 5: Role Dashboards & Department Leave Calendar

Each role sees a tailored dashboard on login. Managers also access a month-view department leave calendar with colour-coded leave entries and company holidays marked.

### Story 5.1: Employee Dashboard

As an employee,
I want a personalised dashboard showing my leave balances, recent requests, and upcoming approved leaves,
So that I have an at-a-glance overview of my leave situation without navigating to separate pages.

**Acceptance Criteria:**

**Given** an authenticated employee lands on `/dashboard`
**When** the page loads
**Then** the dashboard composes data from existing endpoints to display: leave balances per active type, the 5 most recent leave requests, and the next 3 upcoming approved leaves (start_date ≥ today)

**Given** the leave balance section
**When** rendered
**Then** one card per active leave type shows: leave type name, remaining balance (days), and default quota; cards reflect real-time data from `services/leaveBalance` (FR-BAL-5)

**Given** the recent requests section
**When** rendered
**Then** a compact list shows leave type, date range, and a colour-coded status badge for each of the last 5 requests

**Given** the upcoming approved leaves section
**When** no upcoming approved leaves exist
**Then** an empty state message is shown

**Given** an employee with no leave requests yet
**When** the dashboard loads
**Then** balance cards display full quota values; recent requests and upcoming sections show empty states; no errors occur

### Story 5.2: Manager Dashboard

As a manager,
I want a dashboard showing my pending approval count, which team members are on leave today, and a team leave summary,
So that I can prioritise approval work and track team availability at a glance.

**Acceptance Criteria:**

**Given** an authenticated manager lands on `/dashboard`
**When** the page loads
**Then** the dashboard returns: count of PENDING requests from direct reports, list of direct reports with APPROVED leave covering today's date, and a team leave summary for the current calendar month

**Given** the pending approvals section
**When** rendered
**Then** the count of PENDING requests from direct reports is prominently displayed; clicking it navigates to the filtered approval queue (status=PENDING)

**Given** the team on leave today section
**When** rendered
**Then** each direct report with an APPROVED leave where today falls within [start_date, end_date] is listed with name and leave type; empty state shown when no one is on leave today

**Given** the team leave summary section
**When** rendered
**Then** shows approved leave days taken per leave type by the manager's direct reports during the current calendar month

**Given** a manager with no direct reports
**When** the dashboard loads
**Then** all three sections render with empty states and zero counts; no errors occur

### Story 5.3: Admin Dashboard

As an admin,
I want an org-wide dashboard showing total pending requests, a per-department leave summary, and monthly leave totals,
So that I have visibility into leave activity across the entire organisation.

**Acceptance Criteria:**

**Given** an authenticated admin lands on `/dashboard`
**When** the page loads
**Then** the dashboard returns: org-wide count of PENDING requests, per-department count of employees on approved leave today, and total approved leave days for the current calendar month

**Given** the pending requests section
**When** rendered
**Then** the total PENDING count org-wide is prominently displayed; clicking it navigates to the admin approval queue filtered by status=PENDING

**Given** the department leave summary section
**When** rendered
**Then** each department is listed with a count of employees currently on approved leave (covering today); departments with zero are shown with a count of 0

**Given** the monthly totals section
**When** rendered
**Then** total approved leave days for the current calendar month are shown, broken down by leave type

**Given** no leave requests exist in the system
**When** the admin dashboard loads
**Then** all sections render with zero counts; no errors occur

### Story 5.4: Manager Department Leave Calendar

As a manager,
I want a month-view calendar showing my team's approved leaves colour-coded by leave type, with company holidays marked,
So that I can visualise team availability when planning or reviewing new leave requests.

**Acceptance Criteria:**

**Given** an authenticated manager visits the Calendar page
**When** `GET /calendar/team?month=YYYY-MM` is called
**Then** returns all APPROVED leave requests for the manager's direct reports overlapping that month; each entry includes: employee name, leave type name, leave type ID (for colour coding), start date, end date

**Given** the calendar response
**When** rendered
**Then** a month grid is displayed; each approved leave spans its date range as a coloured bar; colour is consistent per leave type across the month; employee name is visible on the bar

**Given** company holidays data from `GET /company-holidays`
**When** the calendar renders
**Then** days with company holidays are visually distinguished (e.g., highlighted background or label); holidays are fetched once per month load and overlaid on the grid

**Given** the month navigation controls
**When** Previous or Next month is clicked
**Then** the URL updates with the new `month` parameter; the calendar re-fetches and re-renders for that month

**Given** a manager with no direct reports or a month with no approved leaves
**When** the calendar renders
**Then** the month grid displays correctly with no leave bars and an informational empty state note

**Given** a non-manager role visits the calendar route
**When** `GET /calendar/team` is called
**Then** a 403 is returned from the API; the frontend redirects the user to their own dashboard

---

## Epic 6: Reports, Audit Log View & Employee Profile

Admins and managers generate and export leave reports (CSV and PDF). Admins view the read-only audit log. Employees self-service their profile. PDF export verifies @cantoo/pdf-lib before use, falling back to pdf-lib if needed.

### Story 6.1: Leave Report Generation & CSV Export

As an admin or manager,
I want to generate a leave report filtered by department, date range, and leave type, and download it as a CSV,
So that I can analyse leave patterns and share structured data outside the system.

**Acceptance Criteria:**

**Given** an authenticated admin
**When** `GET /reports/leave?departmentId=&startDate=&endDate=&leaveTypeId=&page=&limit=` is called
**Then** returns paginated leave records matching the filters; each record includes: employee name, department, leave type, start date, end date, duration days, status

**Given** an authenticated manager
**When** `GET /reports/leave` is called with any departmentId
**Then** results are always scoped to the manager's own department regardless of the `departmentId` param; a manager cannot access other departments' data

**Given** `GET /reports/leave/export/csv` is called with the same filter params
**When** processed
**Then** a CSV file is returned with `Content-Disposition: attachment; filename="leave-report.csv"` and `Content-Type: text/csv`; rows generated via `utils/csv.ts` using `csv-stringify`; first row is a header; generation is on-demand only (FR-RPT-5)

**Given** no records match the applied filters
**When** CSV export is requested
**Then** a CSV file with only the header row is returned (not an error)

**Given** the reports UI
**When** visited by an admin or manager
**Then** filter controls appear: department dropdown (admin sees all; manager sees only their department pre-selected), date range pickers, leave type dropdown; Generate Report button fetches and displays results in a table; Download CSV button triggers export with current filters

### Story 6.2: PDF Report Export

As an admin or manager,
I want to download the filtered leave report as a formatted PDF,
So that I have a printable document suitable for sharing or filing.

**Acceptance Criteria:**

**Given** the PDF utility is being implemented
**When** `@cantoo/pdf-lib` is evaluated
**Then** its npm availability and API compatibility with the project's Node.js 24 / ESM environment are verified before use; if unavailable or incompatible, `pdf-lib` is used as the fallback and this decision is documented in a comment in `utils/pdf.ts`

**Given** `GET /reports/leave/export/pdf` is called with the same filter params as CSV
**When** processed by `utils/pdf.ts`
**Then** a PDF is returned with `Content-Disposition: attachment; filename="leave-report.pdf"` and `Content-Type: application/pdf`

**Given** the generated PDF
**When** opened
**Then** it contains: a title ("Leave Report"), the filter parameters used, a table with the same columns as the CSV export, and a page-number footer; all rows match the filtered dataset

**Given** no records match the filters
**When** PDF export is requested
**Then** a PDF with the header and an empty table body is returned (not an error)

**Given** the reports UI
**When** results are displayed
**Then** a Download PDF button appears alongside the existing Download CSV button and triggers the PDF export with current filters

### Story 6.3: Audit Log Admin View

As an admin,
I want to view the complete, read-only audit log filtered by date range and employee,
So that I can trace every leave action in the system for accountability and compliance.

**Acceptance Criteria:**

**Given** an authenticated admin
**When** `GET /audit-logs?startDate=&endDate=&userId=&page=&limit=` is called
**Then** returns paginated audit log entries sorted newest-first; each entry includes: actor name, target employee name, leave request ID, action (SUBMITTED/APPROVED/REJECTED/CANCELLED), timestamp, and optional comment

**Given** `GET /audit-logs?startDate=2026-01-01&endDate=2026-01-31`
**When** processed
**Then** only entries where `audit_logs.created_at` falls within the given range are returned

**Given** `GET /audit-logs?userId=<uuid>`
**When** processed
**Then** only entries targeting that employee are returned; date and user filters can be combined

**Given** a non-admin calls `GET /audit-logs`
**When** processed
**Then** a 403 response is returned; audit log is admin-only (FR-AUDIT-2)

**Given** the audit log service
**When** any operation is attempted
**Then** only `append()` exists on `services/audit`; no HTTP endpoint, service method, or Prisma call issues UPDATE or DELETE against `audit_logs` (AD-8, FR-AUDIT-3)

**Given** the admin UI Audit Log page
**When** visited
**Then** a table lists entries with columns: timestamp, actor, target employee, action, leave request ID, comment; date range pickers and an employee search dropdown appear as filters; pagination controls appear below; no edit or delete controls exist anywhere on the page

### Story 6.4: Employee Self-Service Profile

As an employee,
I want to update my display name, contact email, phone number, and profile photo,
So that my personal information stays current without requiring admin intervention.

**Acceptance Criteria:**

**Given** an authenticated employee calls `PATCH /me/profile` with `{ name?, contactEmail?, phone?, photo? }`
**When** processed
**Then** only the provided fields are updated; a 200 response returns the updated profile; password, role, department, and manager are not updateable via this endpoint

**Given** `PATCH /me/profile` is called with any of `{ role, departmentId, managerId }`
**When** processed
**Then** a 400 response returns `{ success: false, error: "Role, department, and manager cannot be changed via profile update" }` (FR-PROFILE-2)

**Given** a photo file is included in the request
**When** `upload.ts` processes it
**Then** only PDF, JPG, PNG files ≤ 5 MB are accepted (NFR-SEC-2); the file is saved via `utils/storage.ts`; the returned path is stored on the user record

**Given** `GET /me`
**When** called by any authenticated user
**Then** returns the current user's profile: name, email, contactEmail, phone, role, department, manager, and profile photo URL

**Given** the Profile page UI
**When** visited
**Then** a form pre-fills: name, contact email, phone, and current profile photo thumbnail; a file picker allows selecting a new photo; Save calls `PATCH /me/profile`; a success toast confirms the update
