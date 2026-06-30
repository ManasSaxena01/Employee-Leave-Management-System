import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { apiClient } from '../lib/apiClient.js'

export function DashboardPage() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await apiClient.post('/auth/logout')
    } catch {
      // Server-side cleanup failed — proceed with local logout anyway.
      // The access token expires in ≤15 min and the refresh cookie will be
      // invalidated on the next server interaction.
    }
    clearAuth()
    navigate('/login', { replace: true })
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
