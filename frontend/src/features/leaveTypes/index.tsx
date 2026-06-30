import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { apiClient } from '../../lib/apiClient.js'
import type { LeaveType, ApiListResponse, ApiResponse, ApiError } from '../../lib/types.js'

function errorMessage(err: unknown, fallback: string): string {
  const axiosError = err as { response?: { data?: ApiError } }
  return axiosError?.response?.data?.error ?? fallback
}

export function LeaveTypesPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null)

  async function loadLeaveTypes() {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiListResponse<LeaveType>>('/leave-types')
      setLeaveTypes(res.data.data)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load leave types'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeaveTypes()
  }, [])

  async function handleToggleActive(leaveType: LeaveType) {
    setError(null)
    try {
      await apiClient.patch(`/leave-types/${leaveType.id}`, { active: !leaveType.active })
      await loadLeaveTypes()
    } catch (err) {
      setError(errorMessage(err, 'Failed to update leave type'))
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Leave Types</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Add Leave Type
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
              <th className="py-2 px-4">Default Quota (days)</th>
              <th className="py-2 px-4">Document Required</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveTypes.map((leaveType) => (
              <tr key={leaveType.id} className="border-b text-sm">
                <td className="py-2 px-4">{leaveType.name}</td>
                <td className="py-2 px-4">{leaveType.defaultQuota}</td>
                <td className="py-2 px-4">
                  <input type="checkbox" checked={leaveType.documentRequired} disabled readOnly />
                </td>
                <td className="py-2 px-4">
                  <span className={leaveType.active ? 'text-green-600' : 'text-gray-400'}>
                    {leaveType.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2 px-4 space-x-2">
                  <button
                    onClick={() => setEditingLeaveType(leaveType)}
                    className="text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(leaveType)}
                    className="text-gray-600 hover:underline"
                  >
                    {leaveType.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {leaveTypes.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 px-4 text-center text-gray-500">
                  No leave types yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showAddModal && (
        <LeaveTypeFormModal
          leaveType={null}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false)
            await loadLeaveTypes()
          }}
        />
      )}

      {editingLeaveType && (
        <LeaveTypeFormModal
          leaveType={editingLeaveType}
          onClose={() => setEditingLeaveType(null)}
          onSaved={async () => {
            setEditingLeaveType(null)
            await loadLeaveTypes()
          }}
        />
      )}
    </div>
  )
}

function LeaveTypeFormModal({
  leaveType,
  onClose,
  onSaved,
}: {
  leaveType: LeaveType | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(leaveType?.name ?? '')
  const [defaultQuota, setDefaultQuota] = useState(leaveType?.defaultQuota ?? 0)
  const [documentRequired, setDocumentRequired] = useState(leaveType?.documentRequired ?? false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const idPrefix = leaveType ? 'edit' : 'new'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (leaveType) {
        const updates: { name?: string; defaultQuota?: number; documentRequired?: boolean } = {}
        if (name !== leaveType.name) updates.name = name
        if (defaultQuota !== leaveType.defaultQuota) updates.defaultQuota = defaultQuota
        if (documentRequired !== leaveType.documentRequired) updates.documentRequired = documentRequired
        if (Object.keys(updates).length > 0) {
          await apiClient.patch(`/leave-types/${leaveType.id}`, updates)
        }
      } else {
        await apiClient.post<ApiResponse<LeaveType>>('/leave-types', { name, defaultQuota, documentRequired })
      }
      onSaved()
    } catch (err) {
      setError(errorMessage(err, leaveType ? 'Failed to update leave type' : 'Failed to create leave type'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={leaveType ? 'Edit Leave Type' : 'Add Leave Type'} onClose={onClose}>
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
          <label htmlFor={`${idPrefix}-quota`} className="block text-sm font-medium text-gray-700 mb-1">
            Default Quota (days)
          </label>
          <input
            id={`${idPrefix}-quota`}
            type="number"
            min={1}
            step={1}
            required
            value={defaultQuota}
            onChange={(e) => setDefaultQuota(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center">
          <input
            id={`${idPrefix}-document-required`}
            type="checkbox"
            checked={documentRequired}
            onChange={(e) => setDocumentRequired(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor={`${idPrefix}-document-required`} className="text-sm font-medium text-gray-700">
            Document required
          </label>
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
            {submitting ? (leaveType ? 'Saving…' : 'Creating…') : leaveType ? 'Save' : 'Create'}
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
