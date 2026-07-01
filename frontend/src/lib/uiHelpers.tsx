import type { ReactNode } from 'react'
import type { ApiError } from './types.js'

export function errorMessage(err: unknown, fallback: string): string {
  const axiosError = err as { response?: { data?: ApiError } }
  return axiosError?.response?.data?.error ?? fallback
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
