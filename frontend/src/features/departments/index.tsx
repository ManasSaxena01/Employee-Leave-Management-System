import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { apiClient } from '../../lib/apiClient.js'
import type { Department, ApiListResponse, ApiResponse, ApiError } from '../../lib/types.js'

interface AvailableManager {
  id: string
  name: string
  email: string
}

function errorMessage(err: unknown, fallback: string): string {
  const axiosError = err as { response?: { data?: ApiError } }
  return axiosError?.response?.data?.error ?? fallback
}

export function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<AvailableManager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)

  async function loadDepartments() {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiListResponse<Department>>('/departments')
      setDepartments(res.data.data)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load departments'))
    } finally {
      setLoading(false)
    }
  }

  async function loadManagers() {
    try {
      const res = await apiClient.get<ApiResponse<AvailableManager[]>>('/departments/available-managers')
      setManagers(res.data.data)
    } catch {
      // Manager dropdown is optional — failures here don't block the page.
    }
  }

  useEffect(() => {
    loadDepartments()
    loadManagers()
  }, [])

  function managerName(managerId: string | null): string {
    if (!managerId) return '—'
    return managers.find((m) => m.id === managerId)?.name ?? managerId
  }

  async function handleToggleActive(department: Department) {
    setError(null)
    try {
      await apiClient.patch(`/departments/${department.id}`, { active: !department.active })
      await loadDepartments()
    } catch (err) {
      setError(errorMessage(err, 'Failed to update department'))
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Departments</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Add Department
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : (
        <table className="w-full border-collapse bg-white shadow rounded">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b">
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">Manager</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id} className="border-b text-sm">
                <td className="py-2 px-4">{department.name}</td>
                <td className="py-2 px-4">{managerName(department.managerId)}</td>
                <td className="py-2 px-4">
                  <span className={department.active ? 'text-green-600' : 'text-gray-400'}>
                    {department.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2 px-4 space-x-2">
                  <button
                    onClick={() => setEditingDepartment(department)}
                    className="text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(department)}
                    className="text-gray-600 hover:underline"
                  >
                    {department.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 px-4 text-center text-gray-500">
                  No departments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showAddModal && (
        <DepartmentFormModal
          department={null}
          managers={managers}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false)
            await loadDepartments()
          }}
        />
      )}

      {editingDepartment && (
        <DepartmentFormModal
          department={editingDepartment}
          managers={managers}
          onClose={() => setEditingDepartment(null)}
          onSaved={async () => {
            setEditingDepartment(null)
            await loadDepartments()
          }}
        />
      )}
    </div>
  )
}

function DepartmentFormModal({
  department,
  managers,
  onClose,
  onSaved,
}: {
  department: Department | null
  managers: AvailableManager[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(department?.name ?? '')
  const [managerId, setManagerId] = useState(department?.managerId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const idPrefix = department ? 'edit' : 'new'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (department) {
        const updates: { name?: string; managerId?: string | null } = {}
        if (name !== department.name) updates.name = name
        if (managerId !== (department.managerId ?? '')) updates.managerId = managerId || null
        if (Object.keys(updates).length > 0) {
          await apiClient.patch(`/departments/${department.id}`, updates)
        }
      } else {
        const res = await apiClient.post<ApiResponse<Department>>('/departments', { name })
        const created = res.data.data
        if (managerId) {
          await apiClient.patch(`/departments/${created.id}`, { managerId })
        }
      }
      onSaved()
    } catch (err) {
      setError(errorMessage(err, department ? 'Failed to update department' : 'Failed to create department'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={department ? 'Edit Department' : 'Add Department'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`${idPrefix}-name`} className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-manager`} className="block text-sm font-medium text-gray-700 mb-1">
            Manager{department ? '' : ' (optional)'}
          </label>
          <select
            id={`${idPrefix}-manager`}
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— None —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:underline">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {submitting ? (department ? 'Saving…' : 'Creating…') : department ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
