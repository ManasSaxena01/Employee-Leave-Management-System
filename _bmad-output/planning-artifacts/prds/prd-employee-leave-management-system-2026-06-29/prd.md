---
title: Employee Leave Management System — PRD
status: final
created: 2026-06-29
updated: 2026-06-29 (finalized)
project: employee-leave-management-system
---

# Employee Leave Management System — Product Requirements Document

## 1. Overview

A web-based Employee Leave Management System that enables employees to apply for leave, managers to approve or reject team requests, and administrators to manage the full workforce configuration. The system enforces Role-Based Access Control (RBAC) with dedicated dashboards per role.

**Primary audience:** Portfolio reviewers and interviewers — the deployed application will include seeded demo accounts allowing immediate exploration of all three roles without account setup.

---

## 2. Goals & Success Criteria

| Goal | Measurable outcome |
|---|---|
| Demonstrate full-stack RBAC implementation | All three role dashboards are live and independently navigable |
| Demonstrate complete leave lifecycle | Submit → Approve → Notify → Balance deducted, end-to-end in the deployed app |
| Demonstrate file handling | Document upload works for leave types that require it |
| Demonstrate reporting | CSV and PDF exports generate correctly |
| Demonstrate audit trail | Admin can view a timestamped log of all leave actions |
| Zero-friction demo | Interviewer clicks public URL, logs in as any of 3 seeded roles, explores without setup |

**Counter-metrics:** The system must not allow a non-admin to access admin routes, a manager to approve leaves outside their team, or an employee to view another employee's leave history.

---

## 3. User Roles & Permission Scope

### 3.1 Admin
Full system access.
- Manage employees, managers, and departments
- Configure leave types and default annual quotas
- Override leave balance per employee
- Manage company holidays
- Approve or reject any leave request organization-wide
- View organization-wide leave reports and export
- View full audit log

### 3.2 Manager
Scoped to their department / direct reports.
- View team member list
- Review, approve, or reject leave requests from direct reports only
- View department leave calendar
- Generate and export team leave reports

### 3.3 Employee
Self-service only.
- View personal leave balances per leave type
- Submit leave requests with optional document upload
- View personal leave history and current request status
- Cancel own pending (not yet approved) requests
- Update personal profile (name, contact details, photo)

---

## 4. Functional Requirements

### FR-AUTH — Authentication & Authorization

| ID | Requirement |
|---|---|
| FR-AUTH-1 | Users log in with email and password; receive a JWT on success |
| FR-AUTH-2 | JWT is validated on every protected API route; role enforced server-side |
| FR-AUTH-3 | Passwords stored as bcrypt hashes; plaintext never persisted |
| FR-AUTH-4 | Silent token refresh via refresh token stored in httpOnly cookie `[ASSUMPTION]` |
| FR-AUTH-5 | Logout invalidates the refresh token |

### FR-EMP — Employee Management (Admin)

| ID | Requirement |
|---|---|
| FR-EMP-1 | Admin can create, read, update, and deactivate employee accounts |
| FR-EMP-2 | Admin assigns role (Admin / Manager / Employee) per account |
| FR-EMP-3 | Admin assigns employee to a department and sets their reporting manager |
| FR-EMP-4 | Admin can override the default leave balance for any employee per leave type |

### FR-DEPT — Department Management (Admin)

| ID | Requirement |
|---|---|
| FR-DEPT-1 | Admin can create, rename, and deactivate departments |
| FR-DEPT-2 | Admin assigns a manager to each department |

### FR-LT — Leave Type Management (Admin)

| ID | Requirement |
|---|---|
| FR-LT-1 | System ships with five predefined leave types: Sick, Annual, Casual, Maternity/Paternity, Unpaid |
| FR-LT-2 | Admin can add new leave types, rename existing ones, or deactivate them via a CRUD table |
| FR-LT-3 | Each leave type carries: name, default annual quota (days), document-required flag, active status |
| FR-LT-4 | Document-required flag is a simple checkbox per leave type; Sick leave defaults to required, Annual defaults to not required |

### FR-BAL — Leave Balance Tracking

| ID | Requirement |
|---|---|
| FR-BAL-1 | Default annual quota per leave type applies to all employees unless overridden |
| FR-BAL-2 | Admin can set a per-employee override for any leave type |
| FR-BAL-3 | All balances reset to their configured quota on January 1st; no carry-forward |
| FR-BAL-4 | Balance is deducted when a leave request is approved; restored on rejection or cancellation |
| FR-BAL-5 | Employee dashboard displays remaining balance per active leave type |

### FR-HOL — Holiday Management (Admin)

| ID | Requirement |
|---|---|
| FR-HOL-1 | Admin can create, edit, and delete company holidays (date + name) |
| FR-HOL-2 | Holidays are excluded when calculating working days for a leave request |
| FR-HOL-3 | Holiday list is visible read-only to all authenticated users |

### FR-REQ — Leave Request Workflow (Employee)

| ID | Requirement |
|---|---|
| FR-REQ-1 | Employee submits a request specifying: leave type, start date, end date, reason (text), and optional document |
| FR-REQ-2 | System calculates leave duration in working days (weekdays minus company holidays) |
| FR-REQ-3 | If remaining balance is insufficient, system warns the employee but still allows submission |
| FR-REQ-4 | If one or more team members have approved leave overlapping the requested dates, system shows a warning banner; submission is not blocked |
| FR-REQ-5 | If the selected leave type has document-required = true, a file upload is mandatory before submission |
| FR-REQ-6 | Employee can cancel their own request while it is in Pending status |
| FR-REQ-7 | Employee can view their full leave history with status (Pending / Approved / Rejected / Cancelled) |

### FR-APPR — Approval & Rejection Process (Manager, Admin)

| ID | Requirement |
|---|---|
| FR-APPR-1 | Manager sees all Pending requests from their direct reports |
| FR-APPR-2 | Admin sees all Pending requests across the organization |
| FR-APPR-3 | Approver can Approve or Reject a request; an optional comment is captured either way |
| FR-APPR-4 | Approving a request immediately deducts the calculated days from the employee's balance |
| FR-APPR-5 | Rejecting a pending request requires no balance change (none was deducted at submission); an admin cancelling a previously approved request restores the balance. Employees may only cancel their own pending requests (see FR-REQ-6) |
| FR-APPR-6 | Approver can view the attached document before deciding |

### FR-NOTIF — Notifications

| ID | Requirement |
|---|---|
| FR-NOTIF-1 | Email sent to the employee's manager when a new leave request is submitted |
| FR-NOTIF-2 | Email sent to the employee when their request is approved or rejected |
| FR-NOTIF-3 | Email sent to the employee when their approved request is cancelled by an admin |
| FR-NOTIF-4 | In-app notification badge reflects unread notification count `[ASSUMPTION]` |

### FR-CAL — Department Leave Calendar (Manager)

| ID | Requirement |
|---|---|
| FR-CAL-1 | Month-view calendar showing approved leaves for all team members |
| FR-CAL-2 | Leave entries colour-coded by leave type |
| FR-CAL-3 | Company holidays marked on the calendar |

### FR-DASH — Dashboard Analytics

| ID | Requirement |
|---|---|
| FR-DASH-1 | Employee dashboard: leave balance cards per type, recent requests list, upcoming approved leaves |
| FR-DASH-2 | Manager dashboard: count of pending approvals, list of team members on leave today, team leave summary |
| FR-DASH-3 | Admin dashboard: org-wide pending request count, department leave summary, total leaves taken this month |

### FR-SRCH — Search, Filtering & Pagination

| ID | Requirement |
|---|---|
| FR-SRCH-1 | Leave request lists filterable by: status, date range, leave type, and employee name |
| FR-SRCH-2 | Employee list searchable by name and filterable by department |
| FR-SRCH-3 | All list views paginated server-side (default 20 rows per page) |

### FR-RPT — Reports & Export

| ID | Requirement |
|---|---|
| FR-RPT-1 | Admin can generate a leave report filtered by department, date range, and/or leave type |
| FR-RPT-2 | Manager can generate a team leave report for their department |
| FR-RPT-3 | Reports exportable as CSV |
| FR-RPT-4 | Reports exportable as PDF |
| FR-RPT-5 | Report generation is on-demand; no scheduled delivery `[ASSUMPTION]` |

### FR-AUDIT — Audit Log

| ID | Requirement |
|---|---|
| FR-AUDIT-1 | Every leave state transition (Submit, Approve, Reject, Cancel) is logged with: actor, target employee, leave request ID, action, timestamp, and optional comment |
| FR-AUDIT-2 | Audit log is visible to Admin only, with filter by date range and employee |
| FR-AUDIT-3 | Audit log is read-only; no entry may be edited or deleted |

### FR-PROFILE — Employee Profile

| ID | Requirement |
|---|---|
| FR-PROFILE-1 | Employee can update their display name, contact email, phone number, and profile photo |
| FR-PROFILE-2 | Employee cannot change their own role, department, or reporting manager |

### FR-SEED — Demo Seed Data

| ID | Requirement |
|---|---|
| FR-SEED-1 | Application ships with seeded accounts: `admin@demo.com`, `manager@demo.com`, `employee@demo.com` — all with known passwords documented in the project README |
| FR-SEED-2 | Seed data includes at least two departments, five employees, and leave requests in every status (Pending, Approved, Rejected, Cancelled) |

---

## 5. Leave Policy Rules

These rules govern all leave calculations and must be consistently enforced by the API.

- **Working day:** Any weekday (Mon–Fri) that does not fall on a company holiday.
- **Leave duration:** Count of working days from start date to end date, inclusive.
- **Balance check:** Performed at submission time for user feedback; deduction occurs at approval time.
- **Overlap warning threshold:** One or more approved leaves for any team member on any day within the requested range triggers the overlap warning banner.
- **Balance reset:** Runs as a scheduled job on January 1st; sets each employee's balance to the configured quota for each leave type.

---

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-SEC-1 | RBAC enforced at the API layer; UI-only restriction is insufficient |
| NFR-SEC-2 | File uploads restricted to PDF, JPG, PNG; maximum 5 MB per file |
| NFR-SEC-3 | JWT access token expires in 15 minutes; refresh token in 7 days `[ASSUMPTION]` |
| NFR-SEC-4 | All secrets (DB URL, JWT secret, storage credentials) loaded via environment variables; no hardcoded values |
| NFR-PERF-1 | API responses for list and detail endpoints return within 500 ms under normal load |
| NFR-UX-1 | UI is responsive and usable on desktop and tablet; mobile is not a v1 requirement |
| NFR-DEPL-1 | Application is publicly accessible via HTTPS at a stable URL |
| NFR-DEPL-2 | Database schema managed via migrations; seed script is idempotent and re-runnable |

---

## 7. Out of Scope (v1)

The following are explicitly excluded from v1 to keep scope manageable:

- Mobile application (iOS / Android / PWA)
- Multi-tenancy (single company deployment only)
- Payroll integration
- SSO / OAuth (Google, SAML, Azure AD)
- Biometric attendance
- Leave accrual or pro-ration for mid-year joiners
- Carry-forward of unused leave (planned v2)
- Shift or schedule management
- Localization / multiple languages
