import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext.js'
import { LoginPage } from './features/auth/index.js'
import { LeavesPage } from './features/leaves/index.js'
import { EmployeesPage } from './features/employees/index.js'
import { DepartmentsPage } from './features/departments/index.js'
import { LeaveTypesPage } from './features/leaveTypes/index.js'
import { HolidaysPage } from './features/holidays/index.js'
import { CalendarPage } from './features/calendar/index.js'
import { ReportsPage } from './features/reports/index.js'
import { AuditPage } from './features/audit/index.js'
import { ProfilePage } from './features/profile/index.js'
import { DashboardPage } from './pages/DashboardPage.js'
import { ApprovalsPage } from './pages/ApprovalsPage.js'

function RequireAuth() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireRole({ roles }: { roles: string[] }) {
  const { user } = useAuth()
  return user && roles.includes(user.role) ? <Outlet /> : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leaves" element={<LeavesPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route element={<RequireRole roles={['MANAGER', 'ADMIN']} />}>
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>

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
  )
}
