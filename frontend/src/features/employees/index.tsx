import { useEffect, useState, type FormEvent } from 'react'
import { apiClient } from '../../lib/apiClient.js'
import type { User, Department, ApiListResponse, ApiResponse } from '../../lib/types.js'
import { errorMessage, Modal } from '../../lib/uiHelpers.js'

interface AvailableManager {
  id: string
  name: string
  email: string
}

interface BalanceRow {
  leaveTypeId: string
  leaveTypeName: string
  balance: number
  defaultQuota: number
}

export function EmployeesPage() {
  const [employees, setEmployees] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<AvailableManager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterDeptId, setFilterDeptId] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null)
  const [balancesEmployee, setBalancesEmployee] = useState<User | null>(null)

  // Incrementing this triggers a reload without resetting page/search/filter state.
  const [reloadKey, setReloadKey] = useState(0)
  function reloadEmployees() {
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search.trim()) params.set('search', search.trim())
    if (filterDeptId) params.set('departmentId', filterDeptId)
    apiClient
      .get<ApiListResponse<User>>(`/employees?${params}`)
      .then((res) => {
        if (cancelled) return
        setEmployees(res.data.data)
        setTotal(res.data.meta.total)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(errorMessage(err, 'Failed to load employees'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, search, filterDeptId, reloadKey])

  useEffect(() => {
    async function loadDepartments() {
      try {
        const res = await apiClient.get<ApiListResponse<Department>>('/departments')
        setDepartments(res.data.data)
      } catch {
        // Optional — failures here don't block the page.
      }
    }
    async function loadManagers() {
      try {
        const res = await apiClient.get<ApiResponse<AvailableManager[]>>('/employees/available-managers')
        setManagers(res.data.data)
      } catch {
        // Manager dropdown is optional — failures here don't block the page.
      }
    }
    loadDepartments()
    loadManagers()
  }, [])

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleDeptFilterChange(value: string) {
    setFilterDeptId(value)
    setPage(1)
  }

  function departmentName(departmentId: string | null): string {
    if (!departmentId) return '—'
    return departments.find((d) => d.id === departmentId)?.name ?? departmentId
  }

  async function handleToggleActive(employee: User) {
    setError(null)
    try {
      await apiClient.patch(`/employees/${employee.id}`, { active: !employee.active })
      reloadEmployees()
    } catch (err) {
      setError(errorMessage(err, 'Failed to update employee'))
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Employees</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Add Employee
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
        />
        <select
          value={filterDeptId}
          onChange={(e) => handleDeptFilterChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Departments</option>
          {departments.filter((d) => d.active).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : (
        <table className="w-full border-collapse bg-white shadow rounded">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b">
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">Email</th>
              <th className="py-2 px-4">Role</th>
              <th className="py-2 px-4">Department</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b text-sm">
                <td className="py-2 px-4">{employee.name}</td>
                <td className="py-2 px-4">{employee.email}</td>
                <td className="py-2 px-4">{employee.role}</td>
                <td className="py-2 px-4">{departmentName(employee.departmentId)}</td>
                <td className="py-2 px-4">
                  <span className={employee.active ? 'text-green-600' : 'text-gray-400'}>
                    {employee.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2 px-4 space-x-2">
                  <button
                    onClick={() => setEditingEmployee(employee)}
                    className="text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setBalancesEmployee(employee)}
                    className="text-indigo-600 hover:underline"
                  >
                    Balances
                  </button>
                  <button
                    onClick={() => handleToggleActive(employee)}
                    className="text-gray-600 hover:underline"
                  >
                    {employee.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 px-4 text-center text-gray-500">
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {total > limit && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(total / limit)} ({total} total)
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / limit)}
            className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {showAddModal && (
        <EmployeeFormModal
          employee={null}
          departments={departments}
          managers={managers}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false)
            reloadEmployees()
          }}
        />
      )}

      {editingEmployee && (
        <EmployeeFormModal
          employee={editingEmployee}
          departments={departments}
          managers={managers}
          onClose={() => setEditingEmployee(null)}
          onSaved={() => {
            setEditingEmployee(null)
            reloadEmployees()
          }}
        />
      )}

      {balancesEmployee && (
        <BalancesModal
          employee={balancesEmployee}
          onClose={() => setBalancesEmployee(null)}
        />
      )}
    </div>
  )
}

function EmployeeFormModal({
  employee,
  departments,
  managers,
  onClose,
  onSaved,
}: {
  employee: User | null
  departments: Department[]
  managers: AvailableManager[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(employee?.name ?? '')
  const [email, setEmail] = useState(employee?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(employee?.role ?? 'EMPLOYEE')
  const [departmentId, setDepartmentId] = useState(employee?.departmentId ?? '')
  const [managerId, setManagerId] = useState(employee?.managerId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const idPrefix = employee ? 'edit' : 'new'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (employee) {
        const updates: Record<string, unknown> = {}
        if (name !== employee.name) updates['name'] = name
        if (role !== employee.role) updates['role'] = role
        if (departmentId !== (employee.departmentId ?? '')) updates['departmentId'] = departmentId || null
        if (managerId !== (employee.managerId ?? '')) updates['managerId'] = managerId || null
        if (Object.keys(updates).length > 0) {
          await apiClient.patch(`/employees/${employee.id}`, updates)
        }
      } else {
        await apiClient.post<ApiResponse<User>>('/employees', {
          email: email.trim().toLowerCase(),
          name: name.trim(),
          password,
          role,
          departmentId: departmentId || undefined,
          managerId: managerId || undefined,
        })
      }
      onSaved()
    } catch (err) {
      setError(errorMessage(err, employee ? 'Failed to update employee' : 'Failed to create employee'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={employee ? 'Edit Employee' : 'Add Employee'} onClose={onClose}>
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

        {!employee && (
          <>
            <div>
              <label htmlFor={`${idPrefix}-email`} className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id={`${idPrefix}-email`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-password`} className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password
              </label>
              <input
                id={`${idPrefix}-password`}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor={`${idPrefix}-role`} className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id={`${idPrefix}-role`}
            value={role}
            onChange={(e) => setRole(e.target.value as 'EMPLOYEE' | 'MANAGER' | 'ADMIN')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="EMPLOYEE">EMPLOYEE</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-department`} className="block text-sm font-medium text-gray-700 mb-1">
            Department (optional)
          </label>
          <select
            id={`${idPrefix}-department`}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— None —</option>
            {departments.filter((d) => d.active).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-manager`} className="block text-sm font-medium text-gray-700 mb-1">
            Reporting Manager (optional)
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
            {submitting ? (employee ? 'Saving…' : 'Creating…') : employee ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function BalancesModal({ employee, onClose }: { employee: User; onClose: () => void }) {
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiClient
      .get<ApiResponse<BalanceRow[]>>(`/employees/${employee.id}/balances`)
      .then((res) => {
        if (!cancelled) {
          setBalances(res.data.data)
          setFetchError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setFetchError(errorMessage(err, 'Failed to load balances'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [employee.id])

  async function handleSave(leaveTypeId: string) {
    const parsed = Number(editValue)
    if (!Number.isInteger(parsed) || parsed < 0) {
      setSaveError('Balance must be a non-negative whole number')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const res = await apiClient.patch<ApiResponse<BalanceRow>>(
        `/employees/${employee.id}/balances/${leaveTypeId}`,
        { balance: parsed }
      )
      setBalances((prev) => prev.map((b) => (b.leaveTypeId === leaveTypeId ? res.data.data : b)))
      setEditingTypeId(null)
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to update balance'))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(b: BalanceRow) {
    setEditingTypeId(b.leaveTypeId)
    setEditValue(String(b.balance))
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingTypeId(null)
    setSaveError(null)
  }

  return (
    <Modal title={`Leave Balances — ${employee.name}`} onClose={onClose}>
      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : fetchError ? (
        <p className="text-sm text-red-600" role="alert">{fetchError}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-4">Leave Type</th>
              <th className="py-2 pr-4">Default</th>
              <th className="py-2 pr-4">Balance</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.leaveTypeId} className="border-b">
                <td className="py-2 pr-4">{b.leaveTypeName}</td>
                <td className="py-2 pr-4">{b.defaultQuota}</td>
                <td className="py-2 pr-4">
                  {editingTypeId === b.leaveTypeId ? (
                    <input
                      type="number"
                      min={0}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    b.balance
                  )}
                </td>
                <td className="py-2">
                  {editingTypeId === b.leaveTypeId ? (
                    <span className="space-x-2">
                      <button
                        onClick={() => handleSave(b.leaveTypeId)}
                        disabled={saving}
                        className="text-indigo-600 hover:underline disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-gray-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => startEdit(b)}
                      className="text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {balances.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">
                  No balances found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {saveError && (
        <p className="mt-2 text-sm text-red-600" role="alert">{saveError}</p>
      )}
    </Modal>
  )
}
