---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
filesIncluded:
  prd:
    - _bmad-output/planning-artifacts/prds/prd-employee-leave-management-system-2026-06-29/prd.md
    - _bmad-output/planning-artifacts/prds/prd-employee-leave-management-system-2026-06-29/addendum.md
  architecture:
    - _bmad-output/planning-artifacts/architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md
  epics:
    - _bmad-output/planning-artifacts/epics.md
  ux: null
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-30
**Project:** employee-leave-management-system

---

## Document Inventory

| Document Type | File(s) | Status |
|---|---|---|
| PRD | `prds/prd-employee-leave-management-system-2026-06-29/prd.md` + `addendum.md` | ✅ Found |
| Architecture | `architecture/architecture-employee-leave-management-system-2026-06-29/ARCHITECTURE-SPINE.md` | ✅ Found |
| Epics & Stories | `epics.md` | ✅ Found |
| UX Design | *(none)* | ⚠️ Missing |

---

## PRD Analysis

### Functional Requirements

**FR-AUTH — Authentication & Authorization**
- FR-AUTH-1: Users log in with email and password; receive a JWT on success
- FR-AUTH-2: JWT is validated on every protected API route; role enforced server-side
- FR-AUTH-3: Passwords stored as bcrypt hashes; plaintext never persisted
- FR-AUTH-4: Silent token refresh via refresh token stored in httpOnly cookie `[ASSUMPTION]`
- FR-AUTH-5: Logout invalidates the refresh token

**FR-EMP — Employee Management (Admin)**
- FR-EMP-1: Admin can create, read, update, and deactivate employee accounts
- FR-EMP-2: Admin assigns role (Admin / Manager / Employee) per account
- FR-EMP-3: Admin assigns employee to a department and sets their reporting manager
- FR-EMP-4: Admin can override the default leave balance for any employee per leave type

**FR-DEPT — Department Management (Admin)**
- FR-DEPT-1: Admin can create, rename, and deactivate departments
- FR-DEPT-2: Admin assigns a manager to each department

**FR-LT — Leave Type Management (Admin)**
- FR-LT-1: System ships with five predefined leave types: Sick, Annual, Casual, Maternity/Paternity, Unpaid
- FR-LT-2: Admin can add new leave types, rename existing ones, or deactivate them via a CRUD table
- FR-LT-3: Each leave type carries: name, default annual quota (days), document-required flag, active status
- FR-LT-4: Document-required flag is a simple checkbox per leave type; Sick leave defaults to required, Annual defaults to not required

**FR-BAL — Leave Balance Tracking**
- FR-BAL-1: Default annual quota per leave type applies to all employees unless overridden
- FR-BAL-2: Admin can set a per-employee override for any leave type
- FR-BAL-3: All balances reset to their configured quota on January 1st; no carry-forward
- FR-BAL-4: Balance is deducted when a leave request is approved; restored on rejection or cancellation
- FR-BAL-5: Employee dashboard displays remaining balance per active leave type

**FR-HOL — Holiday Management (Admin)**
- FR-HOL-1: Admin can create, edit, and delete company holidays (date + name)
- FR-HOL-2: Holidays are excluded when calculating working days for a leave request
- FR-HOL-3: Holiday list is visible read-only to all authenticated users

**FR-REQ — Leave Request Workflow (Employee)**
- FR-REQ-1: Employee submits a request specifying: leave type, start date, end date, reason (text), and optional document
- FR-REQ-2: System calculates leave duration in working days (weekdays minus company holidays)
- FR-REQ-3: If remaining balance is insufficient, system warns the employee but still allows submission
- FR-REQ-4: If one or more team members have approved leave overlapping the requested dates, system shows a warning banner; submission is not blocked
- FR-REQ-5: If the selected leave type has document-required = true, a file upload is mandatory before submission
- FR-REQ-6: Employee can cancel their own request while it is in Pending status
- FR-REQ-7: Employee can view their full leave history with status (Pending / Approved / Rejected / Cancelled)

**FR-APPR — Approval & Rejection Process (Manager, Admin)**
- FR-APPR-1: Manager sees all Pending requests from their direct reports
- FR-APPR-2: Admin sees all Pending requests across the organization
- FR-APPR-3: Approver can Approve or Reject a request; an optional comment is captured either way
- FR-APPR-4: Approving a request immediately deducts the calculated days from the employee's balance
- FR-APPR-5: Rejecting or the employee cancelling a previously approved request restores the balance
- FR-APPR-6: Approver can view the attached document before deciding

**FR-NOTIF — Notifications**
- FR-NOTIF-1: Email sent to the employee's manager when a new leave request is submitted
- FR-NOTIF-2: Email sent to the employee when their request is approved or rejected
- FR-NOTIF-3: Email sent to the employee when their approved request is cancelled by an admin
- FR-NOTIF-4: In-app notification badge reflects unread notification count `[ASSUMPTION]`

**FR-CAL — Department Leave Calendar (Manager)**
- FR-CAL-1: Month-view calendar showing approved leaves for all team members
- FR-CAL-2: Leave entries colour-coded by leave type
- FR-CAL-3: Company holidays marked on the calendar

**FR-DASH — Dashboard Analytics**
- FR-DASH-1: Employee dashboard: leave balance cards per type, recent requests list, upcoming approved leaves
- FR-DASH-2: Manager dashboard: count of pending approvals, list of team members on leave today, team leave summary
- FR-DASH-3: Admin dashboard: org-wide pending request count, department leave summary, total leaves taken this month

**FR-SRCH — Search, Filtering & Pagination**
- FR-SRCH-1: Leave request lists filterable by: status, date range, leave type, and employee name
- FR-SRCH-2: Employee list searchable by name and filterable by department
- FR-SRCH-3: All list views paginated server-side (default 20 rows per page)

**FR-RPT — Reports & Export**
- FR-RPT-1: Admin can generate a leave report filtered by department, date range, and/or leave type
- FR-RPT-2: Manager can generate a team leave report for their department
- FR-RPT-3: Reports exportable as CSV
- FR-RPT-4: Reports exportable as PDF
- FR-RPT-5: Report generation is on-demand; no scheduled delivery `[ASSUMPTION]`

**FR-AUDIT — Audit Log**
- FR-AUDIT-1: Every leave state transition (Submit, Approve, Reject, Cancel) is logged with: actor, target employee, leave request ID, action, timestamp, and optional comment
- FR-AUDIT-2: Audit log is visible to Admin only, with filter by date range and employee
- FR-AUDIT-3: Audit log is read-only; no entry may be edited or deleted

**FR-PROFILE — Employee Profile**
- FR-PROFILE-1: Employee can update their display name, contact email, phone number, and profile photo
- FR-PROFILE-2: Employee cannot change their own role, department, or reporting manager

**FR-SEED — Demo Seed Data**
- FR-SEED-1: Application ships with seeded accounts: admin@demo.com, manager@demo.com, employee@demo.com — all with known passwords documented in the project README
- FR-SEED-2: Seed data includes at least two departments, five employees, and leave requests in every status (Pending, Approved, Rejected, Cancelled)

**Total FRs: 61** (across 16 categories)

---

### Non-Functional Requirements

- NFR-SEC-1: RBAC enforced at the API layer; UI-only restriction is insufficient
- NFR-SEC-2: File uploads restricted to PDF, JPG, PNG; maximum 5 MB per file
- NFR-SEC-3: JWT access token expires in 15 minutes; refresh token in 7 days `[ASSUMPTION]`
- NFR-SEC-4: All secrets (DB URL, JWT secret, storage credentials) loaded via environment variables; no hardcoded values
- NFR-PERF-1: API responses for list and detail endpoints return within 500 ms under normal load
- NFR-UX-1: UI is responsive and usable on desktop and tablet; mobile is not a v1 requirement
- NFR-DEPL-1: Application is publicly accessible via HTTPS at a stable URL
- NFR-DEPL-2: Database schema managed via migrations; seed script is idempotent and re-runnable

**Total NFRs: 8**

---

### Additional Requirements

**Leave Policy Rules (Business Constraints):**
- Working day: Any weekday (Mon–Fri) that does not fall on a company holiday
- Leave duration: Count of working days from start date to end date, inclusive
- Balance check: Performed at submission time for user feedback; deduction occurs at approval time
- Overlap warning threshold: One or more approved leaves for any team member on any day within the requested range triggers the overlap warning banner
- Balance reset: Runs as a scheduled job on January 1st; sets each employee's balance to the configured quota for each leave type

**Tech Stack Constraints (from Addendum):**
- Frontend: React + TailwindCSS + React Query
- Backend: Node.js + Express + Prisma ORM
- Database: PostgreSQL (Docker local / Supabase/Railway production)
- Auth: JWT (15-min access tokens) + bcrypt + httpOnly refresh cookies
- File Storage: Multer + local disk (dev) → Cloudflare R2 (production)
- Email: Nodemailer + Ethereal (dev) / Resend (production), toggled via EMAIL_PROVIDER env var
- Reports: csv-stringify (CSV), pdf-lib or Puppeteer (PDF — decision deferred)

**Out-of-Scope (v1):** Mobile app, multi-tenancy, payroll integration, SSO/OAuth, biometric attendance, leave accrual/pro-ration, carry-forward, shift management, localization

---

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement (summary) | Epic / Story | Status |
|---|---|---|---|
| FR-AUTH-1 | Login with email/password → JWT | Epic 1 / Story 1.2 | ✅ Covered |
| FR-AUTH-2 | JWT validated on every protected route, role enforced server-side | Epic 1 / Story 1.3 | ✅ Covered |
| FR-AUTH-3 | Passwords stored as bcrypt hashes | Epic 1 / Story 1.2 | ✅ Covered |
| FR-AUTH-4 | Silent token refresh via httpOnly cookie | Epic 1 / Story 1.3 | ✅ Covered |
| FR-AUTH-5 | Logout invalidates refresh token | Epic 1 / Story 1.3 | ✅ Covered |
| FR-SEED-1 | Seeded demo accounts with documented passwords | Epic 1 / Story 1.4 | ✅ Covered |
| FR-SEED-2 | Seed data: 2 depts, 5 employees, all statuses | Epic 1 / Story 1.4 | ✅ Covered |
| FR-DEPT-1 | Admin creates, renames, deactivates departments | Epic 2 / Story 2.1 | ✅ Covered |
| FR-DEPT-2 | Admin assigns manager to department | Epic 2 / Story 2.1 | ✅ Covered |
| FR-LT-1 | 5 predefined leave types seeded | Epic 2 / Story 2.2 | ✅ Covered |
| FR-LT-2 | Admin CRUD on leave types | Epic 2 / Story 2.2 | ✅ Covered |
| FR-LT-3 | Leave type carries name, quota, doc-required, active | Epic 2 / Story 2.2 | ✅ Covered |
| FR-LT-4 | Document-required flag; Sick=required, Annual=not | Epic 2 / Story 2.2 | ✅ Covered |
| FR-HOL-1 | Admin CRUD on company holidays | Epic 2 / Story 2.3 | ✅ Covered |
| FR-HOL-2 | Holidays excluded from working-day calc | Epic 2 / Story 2.3 | ✅ Covered |
| FR-HOL-3 | Holiday list read-only for all authenticated users | Epic 2 / Story 2.3 | ✅ Covered |
| FR-EMP-1 | Admin CRUD on employee accounts | Epic 3 / Story 3.1 | ✅ Covered |
| FR-EMP-2 | Admin assigns role per account | Epic 3 / Story 3.1 | ✅ Covered |
| FR-EMP-3 | Admin assigns dept and reporting manager | Epic 3 / Story 3.1 | ✅ Covered |
| FR-EMP-4 | Admin overrides leave balance per employee per type | Epic 3 / Story 3.3 | ✅ Covered |
| FR-BAL-1 | Default annual quota applies unless overridden | Epic 3 / Story 3.3 | ✅ Covered |
| FR-BAL-2 | Admin sets per-employee override | Epic 3 / Story 3.3 | ✅ Covered |
| FR-BAL-3 | Balances reset Jan 1 via cron job | Epic 3 / Story 3.3 | ✅ Covered |
| FR-BAL-4 | Balance deducted on approval; restored on reject/cancel | Epic 4 / Story 4.3 | ✅ Covered |
| FR-BAL-5 | Employee dashboard shows remaining balance per type | Epic 5 / Story 5.1 | ✅ Covered |
| FR-SRCH-1 | Leave list filterable by status/date/type/employee | Epic 4 / Story 4.5 | ✅ Covered |
| FR-SRCH-2 | Employee list searchable by name, filterable by dept | Epic 3 / Story 3.2 | ✅ Covered |
| FR-SRCH-3 | All lists paginated server-side, default 20 rows | Epic 3 / Story 3.2 | ✅ Covered |
| FR-REQ-1 | Employee submits request with type/dates/reason/doc | Epic 4 / Story 4.1 | ✅ Covered |
| FR-REQ-2 | System calculates duration in working days | Epic 4 / Story 4.1 | ✅ Covered |
| FR-REQ-3 | Insufficient balance warns but doesn't block | Epic 4 / Story 4.1 | ✅ Covered |
| FR-REQ-4 | Team overlap warns but doesn't block | Epic 4 / Story 4.1 | ✅ Covered |
| FR-REQ-5 | doc-required=true forces file upload | Epic 4 / Story 4.1 | ✅ Covered |
| FR-REQ-6 | Employee cancels own PENDING requests | Epic 4 / Story 4.2 | ✅ Covered |
| FR-REQ-7 | Employee views full leave history with status | Epic 4 / Story 4.2 | ✅ Covered |
| FR-APPR-1 | Manager sees PENDING from direct reports | Epic 4 / Story 4.3 | ✅ Covered |
| FR-APPR-2 | Admin sees all PENDING org-wide | Epic 4 / Story 4.3 | ✅ Covered |
| FR-APPR-3 | Approver approves/rejects with optional comment | Epic 4 / Story 4.3 | ✅ Covered |
| FR-APPR-4 | Approval deducts balance | Epic 4 / Story 4.3 | ✅ Covered |
| FR-APPR-5 | Balance restored on rejection or cancellation of approved | Epic 4 / Story 4.3 | ⚠️ Partial — see gap #3 |
| FR-APPR-6 | Approver can view attached document | Epic 4 / Story 4.3 | ✅ Covered |
| FR-NOTIF-1 | Email to manager on new submission | Epic 4 / Story 4.4 | ✅ Covered |
| FR-NOTIF-2 | Email to employee on approve/reject | Epic 4 / Story 4.4 | ✅ Covered |
| FR-NOTIF-3 | Email to employee when admin cancels approved request | Epic 4 / Story 4.4 | ✅ Covered |
| FR-NOTIF-4 | In-app notification badge with unread count | Epic 4 / Story 4.4 | ✅ Covered |
| FR-AUDIT-1 | All state transitions logged (Submit/Approve/Reject/Cancel) | Epic 4 / Story 4.3 | ⚠️ Partial — see gaps #1 and #2 |
| FR-AUDIT-2 | Audit log visible to Admin only, filterable | Epic 6 / Story 6.3 | ✅ Covered |
| FR-AUDIT-3 | Audit log read-only | Epic 6 / Story 6.3 | ✅ Covered |
| FR-CAL-1 | Month-view calendar for manager's team approved leaves | Epic 5 / Story 5.4 | ✅ Covered |
| FR-CAL-2 | Leave entries colour-coded by type | Epic 5 / Story 5.4 | ✅ Covered |
| FR-CAL-3 | Company holidays marked on calendar | Epic 5 / Story 5.4 | ✅ Covered |
| FR-DASH-1 | Employee dashboard: balance cards, recent requests, upcoming | Epic 5 / Story 5.1 | ✅ Covered |
| FR-DASH-2 | Manager dashboard: pending count, on leave today, team summary | Epic 5 / Story 5.2 | ✅ Covered |
| FR-DASH-3 | Admin dashboard: org-wide pending, dept summary, monthly totals | Epic 5 / Story 5.3 | ✅ Covered |
| FR-RPT-1 | Admin generates leave report (dept/date/type filters) | Epic 6 / Story 6.1 | ✅ Covered |
| FR-RPT-2 | Manager generates team leave report | Epic 6 / Story 6.1 | ✅ Covered |
| FR-RPT-3 | Reports exportable as CSV | Epic 6 / Story 6.1 | ✅ Covered |
| FR-RPT-4 | Reports exportable as PDF | Epic 6 / Story 6.2 | ✅ Covered |
| FR-RPT-5 | Report generation on-demand only | Epic 6 / Story 6.1 | ✅ Covered |
| FR-PROFILE-1 | Employee updates name/contact/phone/photo | Epic 6 / Story 6.4 | ✅ Covered |
| FR-PROFILE-2 | Employee cannot change role/dept/manager | Epic 6 / Story 6.4 | ✅ Covered |

### Missing / Partial Requirements

#### Gap #1 — CRITICAL: Audit Log Entry for SUBMIT Transition Missing (FR-AUDIT-1)

**FR-AUDIT-1** requires ALL state transitions to be logged: Submit, Approve, Reject, Cancel.

Story 4.3 has explicit ACs for APPROVED, REJECTED, and ADMIN_CANCELLED audit entries. Story 4.4 handles the SUBMITTED notification. However, **Story 4.1 (Leave Request Submission) has no acceptance criterion for appending a SUBMITTED audit log entry** via `services/audit.append()`.

- Impact: The audit trail will be silent on request submission — admins cannot trace when a request entered the system.
- Recommendation: Add an AC to Story 4.1 requiring `services/audit.append({ action: 'SUBMITTED', ... })` after the insert transaction commits.

#### Gap #2 — CRITICAL: Audit Log Entry for Employee CANCEL Transition Missing (FR-AUDIT-1)

**Story 4.2** (Employee cancels PENDING request) has no AC for appending a CANCELLED audit log entry. Only Story 4.3 (admin cancel of approved) explicitly logs the cancel action.

- Impact: Audit trail misses the cancel-by-employee transition, violating FR-AUDIT-1's "every state transition" requirement.
- Recommendation: Add an AC to Story 4.2 requiring `services/audit.append({ action: 'CANCELLED', actor: employee, ... })` on successful cancel.

#### Gap #3 — HIGH: FR-APPR-5 Conflict with FR-REQ-6 / Story 4.2

**FR-APPR-5** states: "Rejecting or **the employee cancelling a previously approved** request restores the balance."

This implies employees can cancel approved requests. However:
- FR-REQ-6 restricts employee cancellation to **Pending** status only.
- Story 4.2 explicitly returns 400 when an employee tries to cancel an APPROVED or REJECTED request.
- Story 4.3 allows **admin**-only cancel of approved requests with balance restoration.

- Impact: FR-APPR-5 as written is partially unimplemented (employee-cancel of approved). The stories have correctly resolved this by making it admin-only, but the PRD contains an ambiguous/contradictory requirement.
- Recommendation: Update FR-APPR-5 in the PRD to read "Rejecting a pending request (no balance change needed) or an admin/manager cancelling a previously approved request restores the balance." This aligns with the actual story design.

#### Gap #4 — MODERATE: NFR-DEPL-1 (HTTPS at Stable URL) Not Covered by Any Story

No story has an AC verifying the application is reachable via HTTPS at a stable public URL. This is a deployment concern but it affects the portfolio-reviewer experience (PRD Goal #6: "Zero-friction demo").

- Recommendation: Add a deployment story (or extend Story 1.1 or a new Story 6.5) with ACs for: CI/CD pipeline to Supabase/Railway, HTTPS termination, and stable URL documented in README.

#### Gap #5 — MODERATE: NFR-PERF-1 (500ms Response Time) Not Tested in Any Story

No story has an acceptance criterion verifying API response times remain under 500ms. This NFR is acknowledged in Epic 1's header but never tested.

- Recommendation: Add a note in Story 1.1 or Story 3.2 (largest list endpoints) to include basic load testing or at least database query index verification as a done criterion.

#### Gap #6 — MINOR: NFR-UX-1 (Responsive Desktop + Tablet) Not Explicitly Addressed

No story has an AC requiring responsive layout verification on desktop and tablet viewports.

- Recommendation: Add a cross-cutting AC to at least one story per epic (or a global done-condition in Epic 1's scaffold story): "All pages render without horizontal scroll and remain usable at 768px (tablet) and 1280px (desktop) viewport widths."

#### Gap #7 — MINOR: In-App Notification Polling Strategy Undefined

Architecture defers "polling vs WebSocket" to v1 and says "implement simple polling." Story 4.4 references `GET /notifications?read=false` for the bell count but no AC specifies the polling interval, implementation hook, or how to avoid excessive requests.

- Recommendation: Add one AC to Story 4.4: "The unread notification count refreshes via polling on a fixed interval (e.g., every 30 seconds); the interval is configurable via a constant."

---

### Coverage Statistics

- Total PRD FRs: **61**
- FRs fully covered in epics + stories: **59**
- FRs partially covered (gaps noted): **2** (FR-AUDIT-1, FR-APPR-5)
- FRs not covered: **0**
- **Coverage: 97% (with 2 partial gaps requiring story AC additions)**

- Total PRD NFRs: **8**
- NFRs addressed in stories: **5** (SEC-1, SEC-2, SEC-3, SEC-4, DEPL-2)
- NFRs not explicitly story-tested: **3** (PERF-1, UX-1, DEPL-1)
- **NFR Coverage: 63% at story-AC level**

---

## UX Alignment Assessment

### UX Document Status

**Not Found.** No UX design document exists under `planning-artifacts/`. The epics document acknowledges this: "No UX Design document was found for this project. UX requirements are covered via NFR-UX-1 and role-specific dashboard layouts defined in FR-DASH."

### Is UX Implied?

**Yes — strongly.** This is a user-facing web application with:
- Three distinct role dashboards (Employee, Manager, Admin)
- A leave request form with dynamic conditional validation (doc upload mandatory when required by leave type)
- A month-view calendar with colour-coded leave entries
- Approval queues, modal dialogs, and filter controls
- File upload with document preview
- In-app notification bell with dropdown
- CSV/PDF export workflows

All UI is defined only through story acceptance criteria (functional descriptions). No visual design, wireframes, component library, or colour scheme is specified.

### Alignment Issues

#### UX-ARCH-1 — NFR-UX-1 Not Bound by Architecture

The Architecture Spine's `binds` frontmatter lists NFR-SEC-1 through NFR-SEC-4, NFR-PERF-1, NFR-DEPL-1, and NFR-DEPL-2 — but **NFR-UX-1 (responsive desktop + tablet) is missing from the architecture binds list**. No architectural decision references responsive layout strategy.

- Impact: No builder will know that responsive layout is a hard requirement unless they read the PRD separately. The architecture does not guide implementation of NFR-UX-1.
- Recommendation: Add NFR-UX-1 to the architecture `binds` frontmatter and add a convention row: "All pages must render without horizontal scroll at 768px (tablet) and 1280px (desktop) viewport widths; TailwindCSS responsive prefixes (`md:`, `lg:`) are the mechanism."

#### UX-ARCH-2 — No UI Component Library or Design System Specified

The architecture lists `components/` as containing "Shared UI (Table, Modal, Badge, Pagination, etc.)" but specifies no component library. The React form library is also deferred ("per-feature decision"). This leaves builders to make independent choices that may produce inconsistent UI.

- Particular risk: The calendar view (FR-CAL), modal dialogs (approval, employee edit), and notification dropdown all require non-trivial interactive components.
- Recommendation: Specify a base component library (e.g., shadcn/ui + Radix UI primitives, or Headless UI) and a form strategy (e.g., React Hook Form + Zod) as an architectural convention so all feature slices share the same building blocks.

#### UX-ARCH-3 — Calendar Colour Scheme for Leave Types Undefined

FR-CAL-2 requires leave entries to be "colour-coded by leave type," but neither the PRD nor the architecture defines the colour mapping. With 5+ leave types and potential for admin-created custom types, how colours are assigned is unspecified.

- Risk: Each developer building the calendar may choose different colours, or colours may clash on re-renders when leave types are admin-configurable.
- Recommendation: Define a colour strategy — either a fixed palette assigned by leave type index, or a `color` field on the `leave_types` table. This requires either a PRD addendum or an architecture convention.

#### UX-ARCH-4 — No Accessibility Requirements Defined

Neither the PRD nor the architecture specifies any accessibility target (WCAG 2.1 level, keyboard navigation, screen reader support). For a portfolio-reviewed application, basic keyboard accessibility and ARIA labels on modals/forms would signal quality.

- Recommendation: Add a minimum target to NFR-UX-1 or a new NFR-ACC-1: "Interactive controls are keyboard-navigable; modals trap focus and have appropriate ARIA roles."

#### UX-ARCH-5 — Form Validation Strategy Undefined for Complex Form (Leave Request)

The leave request form (Story 4.1) has complex dynamic validation: file upload becomes mandatory when the selected leave type has `document_required: true`. No validation library or pattern is specified.

- Recommendation: As part of resolving UX-ARCH-2, specify React Hook Form + Zod, and add an AC to Story 4.1: "Form validation runs client-side via [library]; the file upload field's required state updates reactively when the leave type selection changes."

### Warnings

⚠️ **Missing UX Document for a UI-Heavy Application**: All UI design is described only through story ACs, with no wireframes, visual design, or component specification. While this is workable for a solo portfolio build with a consistent developer, it introduces risk of:
- Inconsistent UI between features built at different times
- Rework if the reviewer/interviewer expects a polished visual design
- No reference for the calendar, dashboard cards, or modal layouts

**Recommended action:** Create at minimum a lightweight UX artifact documenting: colour palette, component choices, and breakpoints. The `bmad-ux` skill is available in this project to generate this.

---

## Epic Quality Review

### Best Practices Compliance Summary

| Epic | User Value? | Independent? | Story Sizing? | No Fwd Deps? | AC Quality? |
|---|---|---|---|---|---|
| Epic 1: Foundation, Auth & Scaffold | ⚠️ Partial | ✅ | ⚠️ Story 1.1 large | ✅ | ✅ |
| Epic 2: Admin Config | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 3: Employee Mgmt & Balances | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 4: Leave Request Lifecycle | ✅ | ✅ | ⚠️ Story 4.3 large | ⚠️ Implicit | ✅ |
| Epic 5: Dashboards & Calendar | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 6: Reports, Audit & Profile | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 🔴 Critical Violations

#### QUAL-C1 — Story 1.1 Creates All 9 Tables Upfront (Schema Front-Loading)

Story 1.1 provisions the complete Prisma schema for all 9 tables (`users`, `departments`, `leave_types`, `leave_balances`, `leave_requests`, `audit_logs`, `company_holidays`, `refresh_tokens`, `notifications`) in the very first story, well before the features that use most of these tables are built (Epics 4–6).

The best practice is: each story creates the database entities it needs. Front-loading the entire schema means:
- Story 1.1 silently carries hidden requirements from Epics 4–6
- A developer reading Story 1.1 must understand the full data model of a system they haven't built yet
- Schema migrations cannot be progressively validated (all tables exist but most are untouched until much later)

**Severity:** Flagged as critical by best-practice standards, though pragmatically this is a common and defensible approach for a greenfield monorepo where the full schema is well-understood at design time.

**Recommendation:** Accept as-is with a note in the story: "Full schema is front-loaded by design because all entities are known and stable; migrations are additive from this baseline." Alternatively, split the schema into two migrations: (a) auth/seed tables in Story 1.1, (b) remaining tables deferred to the epic that first uses them. Decision: document the trade-off explicitly.

#### QUAL-C2 — Story 1.1 Has No End-User Value ("As a developer" role)

Story 1.1's user role is "As a developer" — it delivers zero direct end-user value. It is a technical infrastructure story. Best practices prohibit pure technical milestones as stories.

**Severity:** Technically a violation, but every greenfield project requires a scaffold story. Epic 1 as a whole delivers user value through Stories 1.2, 1.3, and 1.4.

**Recommendation:** Acceptable as-is given greenfield context. Consider retitling to make the user-value connection clear: "As a developer setting up the project so that all subsequent user-facing stories can be built and tested on a stable foundation..." or simply acknowledge it as a technical prerequisite story.

---

### 🟠 Major Issues

#### QUAL-M1 — Epic 1 Title Is Partly Technical ("Foundation & Project Scaffold")

The title "Foundation, Authentication & Project Scaffold" contains two technical terms ("Foundation", "Project Scaffold") alongside the user-value term ("Authentication"). While the epic delivers real user value through authentication and seed data, its primary framing as "foundation/scaffold" suggests infrastructure build, not user outcome.

**Recommendation:** Rename to "Authentication & Demo-Ready Project Setup" to lead with user value.

#### QUAL-M2 — Story 4.3 Has an Implicit Implementation Dependency on Story 4.4 (Notification Service)

Story 4.3 (Approve/Reject/Audit) and Story 4.4 (Notifications) are sequenced such that 4.3 must be built first. However, the real implementation of `services/leaveRequest.approve()` will call `services/notification.trigger()` — a service that doesn't exist until Story 4.4.

At the AC level, the stories are correctly decoupled: Story 4.3 ACs test the transaction and audit log, Story 4.4 ACs test notifications separately. However, a developer building Story 4.3 to completion will encounter a missing notification service call that they either need to stub or must treat as deferred, which can cause confusion.

**Recommendation:** Add a developer note to Story 4.3: "The `services/notification.trigger()` call inside `approve()`/`reject()`/`cancel()` should be added as a stub (no-op) in this story and wired up fully in Story 4.4. This story's ACs test the transaction and audit trail only."

#### QUAL-M3 — Story 4.3 Is Oversized (4 Distinct User Journeys)

Story 4.3 bundles four distinct user journeys into one story:
1. Manager approves a pending request (+ balance deduction + audit)
2. Manager rejects a pending request (+ audit)
3. Admin cancels an already-approved request (+ balance restore + audit)
4. Approver views attached document before deciding

These are related but independently implementable. The combined scope is larger than typical story sizing, increasing the risk of partial completion or integration errors.

**Recommendation:** Consider splitting into Story 4.3a (Approve/Reject) and Story 4.3b (Admin Cancel + Document View), or accept the current grouping with explicit developer awareness of the scope. The grouping is understandable given the shared transaction infrastructure.

---

### 🟡 Minor Concerns

#### QUAL-N1 — Story 1.1 Creates Stubs for Epic 6 Utilities (`utils/pdf.ts`, `utils/csv.ts`)

Story 1.1 requires `utils/pdf.ts` and `utils/csv.ts` to "export their interfaces without runtime errors." These utilities aren't used until Epic 6 (Stories 6.1, 6.2). Creating stubs in Story 1.1 is technically clean (validates imports early) but adds scope to the scaffold story.

**Assessment:** Acceptable as a consistency check. No change needed.

#### QUAL-N2 — Story 2.2 AC References "Story 1.4" by Name

One AC in Story 2.2 says "Given the seeded database from Story 1.4..." — naming a prior story directly. This is a minor style issue; ACs should ideally describe state, not reference other stories.

**Recommendation:** Rewrite as "Given the five predefined leave types exist in the database (seeded: Sick, Annual, Casual, Maternity/Paternity, Unpaid)..." This is self-contained and testable independently.

#### QUAL-N3 — Story 4.2 Combines Two Distinct User Journeys

Story 4.2 combines "view leave history" and "cancel a pending request" into a single story. While related, they're used at different moments and could be validated independently.

**Assessment:** The stories are small enough that combining is acceptable. No change required.

#### QUAL-N4 — No End-to-End Smoke Test or "Definition of Done" Story

After Epic 6, there is no integration story to verify the complete leave lifecycle works end-to-end across all six epics. Portfolio reviewers will navigate across all three roles — a single end-to-end AC verifying the full journey (submit → approve → notify → deduct → report → audit) in a deployed environment is missing.

**Recommendation:** Add an optional Story 6.5 or a deployment checklist in the README that covers: deploy to production → run seed → log in as all 3 roles → complete a leave request lifecycle → verify CSV/PDF export. This is especially important given the PRD's "Zero-friction demo" goal (FR-SEED-1/2).

#### QUAL-N5 — No Explicit Ordering Constraint Between Stories 4.3 and 4.4 for Story Creators

The epics document does not state that Story 4.4 must be built after Story 4.3. A developer picking up Story 4.4 first could build a notification service that calls a non-existent approve flow. The implicit ordering is correct (4.1 → 4.2 → 4.3 → 4.4 → 4.5) but is not documented.

**Recommendation:** Add a short "Prerequisite stories" note at the top of each Epic 4 story (as is done for Story 2.2 with its Story 1.4 reference).

---

## Summary and Recommendations

### Overall Readiness Status

## 🟠 NEEDS WORK

The project has a strong, well-structured foundation: the PRD is thorough, the architecture is detailed with explicit decision records, and the epics cover 97% of all 61 functional requirements with high-quality BDD acceptance criteria. However, **two critical audit trail gaps** and **one requirement conflict** must be resolved before implementation begins, or they will result in a non-compliant audit log that is expensive to retrofit.

---

### Critical Issues Requiring Immediate Action

| # | Issue | Location | Impact |
|---|---|---|---|
| 1 | **Audit log SUBMIT transition never logged** (Gap #1) | Story 4.1 | FR-AUDIT-1 violation — audit trail is incomplete |
| 2 | **Audit log Employee-CANCEL transition never logged** (Gap #2) | Story 4.2 | FR-AUDIT-1 violation — cancel-by-employee untraceable |
| 3 | **FR-APPR-5 conflicts with FR-REQ-6 and Story 4.2** (Gap #3) | PRD + Story 4.2 | Ambiguous requirement; risk of misinterpretation by builder |
| 4 | **Story 4.3 implicit dependency on Story 4.4 notification service** (QUAL-M2) | Story 4.3 | Developer confusion; partial implementation risk |

---

### Recommended Next Steps

**Immediate (fix before starting Epic 4):**

1. **Add audit log AC to Story 4.1**: Append: "Given the leave request is successfully created, When the transaction commits, Then `services/audit.append({ action: 'SUBMITTED', actorId: employee.id, ... })` is called and an `audit_logs` entry exists for this submission."

2. **Add audit log AC to Story 4.2**: Append: "Given the employee's cancel request succeeds, Then `services/audit.append({ action: 'CANCELLED', actorId: employee.id, ... })` is called and an `audit_logs` entry exists."

3. **Clarify FR-APPR-5 in the PRD**: Update to: "Rejecting a pending request (no balance change since none was deducted) or an admin cancelling a previously approved request restores the balance. Employees may only cancel pending requests." This removes the ambiguity about employee-cancelling-approved.

4. **Add notification stub note to Story 4.3**: Clarify that `services/notification.trigger()` calls should be left as a stub/no-op in Story 4.3 and wired fully in Story 4.4.

**Short-term (before Epic 5 or at start of Epic 6):**

5. **Add NFR-DEPL-1 story**: A deployment story covering: production hosting selection, HTTPS configuration, CI/CD pipeline, and stable URL documented in README. This is load-bearing for the portfolio reviewer goal.

6. **Specify UI component library**: Add an architecture decision (AD-17 or convention row) specifying the component library and form validation approach (e.g., shadcn/ui + Radix + React Hook Form + Zod).

7. **Define calendar colour mapping strategy**: Either add a `color` field to the `leave_types` table (requires migration and PRD addendum) or specify a fixed palette assigned by index in a constants file.

**Nice-to-have (before production deployment):**

8. **Add NFR-UX-1 to architecture binds**: Wire responsive layout as an explicit architectural constraint, not just a PRD NFR.

9. **Add responsive layout AC to at least one story per epic**: Ensures developers verify responsiveness as they build.

10. **Consider a Story 6.5 (End-to-End Smoke Test / Deployment Checklist)**: A final story or README checklist that verifies the complete portfolio-reviewer journey across all three roles in the deployed app.

---

### Issues by Category

| Category | Critical | High | Moderate | Minor | Total |
|---|---|---|---|---|---|
| Epic Coverage (FR/NFR gaps) | 2 | 1 | 2 | 2 | 7 |
| UX Alignment | 0 | 1 | 2 | 2 | 5 |
| Epic Quality | 2 | 1 | 1 | 5 | 9 |
| **Total** | **4** | **3** | **5** | **9** | **21** |

---

### Final Note

This assessment identified **21 findings across 3 categories**. The 4 critical issues all require targeted story AC additions or a PRD clarification — none require re-architecting or rewriting epics. The architecture is sound, the FR coverage is strong (97%), and the epic sequencing is correct. Address the 4 critical items and the 3 high-priority items before starting Epic 4 implementation. The remaining moderate and minor items can be addressed iteratively without blocking the build.

**Assessment date:** 2026-06-30
**Assessed by:** Implementation Readiness Checker (BMad)
**Documents reviewed:** PRD (prd.md + addendum.md), Architecture (ARCHITECTURE-SPINE.md), Epics (epics.md)

---

### Epic-by-Epic Compliance Checklist

#### Epic 1: Foundation, Authentication & Project Scaffold
- [⚠️] Epic delivers user value — partial (auth + seed = yes; scaffold = no)
- [✅] Epic can function independently — yes (first epic)
- [⚠️] Stories appropriately sized — Story 1.1 is large
- [✅] No forward dependencies
- [🔴] Database tables created when needed — VIOLATION: all 9 tables created in Story 1.1
- [✅] Clear acceptance criteria
- [✅] FR traceability maintained

#### Epic 2: Admin System Configuration
- [✅] Epic delivers user value — admin can configure org structure
- [✅] Epic can function independently with Epic 1
- [✅] Stories appropriately sized — 3 stories, well-scoped
- [✅] No forward dependencies
- [✅] Database tables created when needed (tables already exist from 1.1)
- [⚠️] Clear ACs — Story 2.2 references Story 1.4 by name (minor)
- [✅] FR traceability maintained

#### Epic 3: Employee Management & Leave Balances
- [✅] Epic delivers user value — admin manages workforce
- [✅] Epic can function independently with Epics 1–2
- [✅] Stories appropriately sized
- [✅] No forward dependencies
- [✅] Database tables created when needed
- [✅] Clear ACs — good Given/When/Then structure throughout
- [✅] FR traceability maintained

#### Epic 4: Leave Request Lifecycle
- [✅] Epic delivers user value — core product functionality
- [✅] Epic can function independently with Epics 1–3
- [⚠️] Stories appropriately sized — Story 4.3 is large (4 journeys)
- [🟠] Implicit dependency — Story 4.3 needs 4.4's notification service to be complete
- [✅] Database tables created when needed
- [✅] Clear ACs — detailed BDD structure
- [✅] FR traceability maintained

#### Epic 5: Role Dashboards & Department Leave Calendar
- [✅] Epic delivers user value — role-appropriate at-a-glance views
- [✅] Epic can function independently with Epics 1–4
- [✅] Stories appropriately sized — 4 focused stories
- [✅] No forward dependencies
- [✅] Database tables created when needed
- [✅] Clear ACs — empty state conditions explicitly handled
- [✅] FR traceability maintained

#### Epic 6: Reports, Audit Log View & Employee Profile
- [✅] Epic delivers user value — export, audit visibility, self-service profile
- [✅] Epic can function independently with Epics 1–5
- [✅] Stories appropriately sized — 4 well-scoped stories
- [✅] No forward dependencies
- [✅] Database tables created when needed
- [✅] Clear ACs — fallback library decision (pdf-lib) explicitly in AC
- [✅] FR traceability maintained




---

### PRD Completeness Assessment

The PRD is thorough and well-structured with:
- Clear role definitions and permission scopes
- All 61 FRs explicitly numbered and grouped by domain
- 8 NFRs covering security, performance, UX, and deployment
- Explicit business rules for leave calculation logic
- Clear out-of-scope statements to prevent scope creep
- Tech stack decisions captured in addendum
- Minor gaps: PDF library choice deferred; FR-NOTIF-4 and FR-AUTH-4 marked as assumptions needing confirmation


