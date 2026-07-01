import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react'
import { apiClient } from '../../lib/apiClient.js'
import type { LeaveType, LeaveRequest, ApiListResponse, ApiResponse } from '../../lib/types.js'
import { errorMessage, Modal } from '../../lib/uiHelpers.js'

interface SubmitResponse extends LeaveRequest {
  balanceWarning: boolean
  overlapWarning: boolean
  overlappingLeaves: Array<{
    id: string
    employeeName: string
    leaveTypeName: string
    startDate: string
    endDate: string
  }>
}

export function LeavesPage() {
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [successResult, setSuccessResult] = useState<SubmitResponse | null>(null)

  function handleSubmitted(result: SubmitResponse) {
    setShowSubmitModal(false)
    setSuccessResult(result)
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Leave Requests</h1>
        <button
          onClick={() => { setSuccessResult(null); setShowSubmitModal(true) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Submit Leave Request
        </button>
      </div>

      {successResult && (
        <div className="mb-4 space-y-2">
          <div className="bg-green-50 border border-green-300 text-green-800 rounded p-3 text-sm">
            Leave request submitted successfully (ID: {successResult.id}).
          </div>
          {successResult.balanceWarning && (
            <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded p-3 text-sm">
              Warning: Your remaining balance is less than the requested leave duration.
            </div>
          )}
          {successResult.overlapWarning && (
            <div className="bg-orange-50 border border-orange-300 text-orange-800 rounded p-3 text-sm">
              Warning: The following team members have approved leave overlapping your dates:{' '}
              {successResult.overlappingLeaves.map((l) => l.employeeName).join(', ')}
            </div>
          )}
        </div>
      )}

      {showSubmitModal && (
        <SubmitLeaveModal
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  )
}

function SubmitLeaveModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void
  onSubmitted: (result: SubmitResponse) => void
}) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const loadIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++loadIdRef.current
    setLoadingTypes(true)
    apiClient
      .get<ApiListResponse<LeaveType>>('/leave-types')
      .then((res) => {
        if (requestId !== loadIdRef.current) return
        setLeaveTypes(res.data.data.filter((lt) => lt.active))
      })
      .catch(() => {
        if (requestId !== loadIdRef.current) return
        setError('Failed to load leave types')
      })
      .finally(() => {
        if (requestId === loadIdRef.current) setLoadingTypes(false)
      })
  }, [])

  const selectedType = leaveTypes.find((lt) => lt.id === leaveTypeId)
  const isDocRequired = selectedType?.documentRequired ?? false

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (isDocRequired && !file) {
      setError('Document is required for this leave type')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('leaveTypeId', leaveTypeId)
      formData.append('startDate', startDate)
      formData.append('endDate', endDate)
      formData.append('reason', reason)
      if (file) formData.append('document', file)

      const res = await apiClient.post<ApiResponse<SubmitResponse>>('/leave-requests', formData)
      onSubmitted(res.data.data)
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit leave request'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
  }

  return (
    <Modal title="Submit Leave Request" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="leave-type" className="block text-sm font-medium text-gray-700 mb-1">
            Leave Type
          </label>
          {loadingTypes ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <select
              id="leave-type"
              required
              value={leaveTypeId}
              onChange={(e) => { setLeaveTypeId(e.target.value); setFile(null) }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select leave type…</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            id="start-date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
            Reason
          </label>
          <textarea
            id="reason"
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="document" className="block text-sm font-medium text-gray-700 mb-1">
            Supporting Document{isDocRequired ? ' (required)' : ' (optional)'}
          </label>
          <input
            id="document"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-600"
          />
          {isDocRequired && (
            <p className="text-xs text-red-600 mt-1">A document is required for this leave type.</p>
          )}
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
            disabled={submitting || loadingTypes}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
