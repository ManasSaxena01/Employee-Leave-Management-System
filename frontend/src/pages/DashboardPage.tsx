import { useAuth } from '../context/AuthContext.js'

export function DashboardPage() {
  const { user } = useAuth()
  return <div>Dashboard — {user?.role ?? 'Loading...'}</div>
}
