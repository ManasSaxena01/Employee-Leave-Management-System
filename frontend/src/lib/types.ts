import type { Role, LeaveStatus } from './constants.js'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  active: boolean
  departmentId: string | null
  managerId: string | null
  contactEmail: string | null
  phone: string | null
  photoPath: string | null
  createdAt: string
  updatedAt: string
}

export interface Department {
  id: string
  name: string
  managerId: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface LeaveType {
  id: string
  name: string
  defaultQuota: number
  documentRequired: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface LeaveBalance {
  id: string
  userId: string
  leaveTypeId: string
  balance: number
}

export interface LeaveRequest {
  id: string
  userId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  durationDays: number
  status: LeaveStatus
  reason: string
  documentPath: string | null
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  leaveRequestId: string
  actorId: string
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  comment: string | null
  createdAt: string
}

export interface CompanyHoliday {
  id: string
  date: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface RefreshToken {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  message: string
  read: boolean
  createdAt: string
}

export interface ApiResponse<T> {
  success: true
  data: T
}

export interface ApiListResponse<T> {
  success: true
  data: T[]
  meta: { page: number; limit: number; total: number }
}

export interface ApiError {
  success: false
  error: string
}
