import { useEffect, useRef, useState, type FormEvent } from 'react'
import { apiClient } from '../../lib/apiClient.js'
import type { CompanyHoliday, ApiListResponse, ApiResponse } from '../../lib/types.js'
import { errorMessage, Modal } from '../../lib/uiHelpers.js'

export function HolidaysPage() {
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<CompanyHoliday | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadIdRef = useRef(0)

  async function loadHolidays() {
    const requestId = ++loadIdRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiListResponse<CompanyHoliday>>('/company-holidays')
      if (requestId !== loadIdRef.current) return
      setHolidays(res.data.data)
    } catch (err) {
      if (requestId !== loadIdRef.current) return
      setError(errorMessage(err, 'Failed to load holidays'))
    } finally {
      if (requestId === loadIdRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    loadHolidays()
  }, [])

  async function handleDelete(holiday: CompanyHoliday) {
    if (!window.confirm(`Delete "${holiday.name}"? This cannot be undone.`)) return
    setError(null)
    setDeleting(holiday.id)
    try {
      await apiClient.delete(`/company-holidays/${holiday.id}`)
      await loadHolidays()
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete holiday'))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Company Holidays</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Add Holiday
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
              <th className="py-2 px-4">Date</th>
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((holiday) => (
              <tr key={holiday.id} className="border-b text-sm">
                <td className="py-2 px-4">{holiday.date}</td>
                <td className="py-2 px-4">{holiday.name}</td>
                <td className="py-2 px-4 space-x-2">
                  <button
                    onClick={() => setEditingHoliday(holiday)}
                    className="text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(holiday)}
                    disabled={deleting === holiday.id}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deleting === holiday.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
            {holidays.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 px-4 text-center text-gray-500">
                  No holidays yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showAddModal && (
        <HolidayFormModal
          holiday={null}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false)
            await loadHolidays()
          }}
        />
      )}

      {editingHoliday && (
        <HolidayFormModal
          holiday={editingHoliday}
          onClose={() => setEditingHoliday(null)}
          onSaved={async () => {
            setEditingHoliday(null)
            await loadHolidays()
          }}
        />
      )}
    </div>
  )
}

function HolidayFormModal({
  holiday,
  onClose,
  onSaved,
}: {
  holiday: CompanyHoliday | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [date, setDate] = useState(holiday?.date ?? '')
  const [name, setName] = useState(holiday?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const idPrefix = holiday ? 'edit' : 'new'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (holiday) {
        const updates: { date?: string; name?: string } = {}
        if (date !== holiday.date) updates.date = date
        if (name !== holiday.name) updates.name = name
        if (Object.keys(updates).length > 0) {
          await apiClient.patch(`/company-holidays/${holiday.id}`, updates)
        }
      } else {
        await apiClient.post<ApiResponse<CompanyHoliday>>('/company-holidays', { date, name })
      }
      await onSaved()
    } catch (err) {
      setError(errorMessage(err, holiday ? 'Failed to update holiday' : 'Failed to create holiday'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={holiday ? 'Edit Holiday' : 'Add Holiday'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`${idPrefix}-date`} className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
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
            {submitting ? (holiday ? 'Saving…' : 'Creating…') : holiday ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

