import { prisma } from '../prisma/client.js'
import { calculateWorkingDays } from '../utils/workingDays.js'
import { audit } from './audit.js'
import { notification } from './notification.js'

function parseDateUTC(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z')
}

export interface OverlappingLeave {
  id: string
  employeeName: string
  leaveTypeName: string
  startDate: string
  endDate: string
}

export interface LeaveRequestRow {
  id: string
  userId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  durationDays: number
  status: string
  reason: string
  documentPath: string | null
  comment: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SubmitResult {
  request: LeaveRequestRow
  balanceWarning: boolean
  overlapWarning: boolean
  overlappingLeaves: OverlappingLeave[]
}

export async function submit(input: {
  userId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  reason: string
  documentPath?: string
}): Promise<SubmitResult> {
  const { userId, leaveTypeId, startDate, endDate, reason, documentPath } = input

  const start = parseDateUTC(startDate)
  const end = parseDateUTC(endDate)

  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } })
  if (!leaveType) {
    throw Object.assign(new Error('Leave type not found'), { status: 404 })
  }
  if (!leaveType.active) {
    throw Object.assign(new Error('Leave type is not active'), { status: 400 })
  }
  if (leaveType.documentRequired && !documentPath) {
    throw Object.assign(new Error('Document is required for this leave type'), { status: 400 })
  }

  const submitter = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true },
  })
  if (!submitter) {
    throw Object.assign(new Error('User not found'), { status: 404 })
  }

  // Fetch holidays outside transaction — read-only, no race concern (story guardrail #11)
  const holidays = await prisma.companyHoliday.findMany({ select: { date: true } })
  const holidayDates = holidays.map((h) => h.date)

  const durationDays = calculateWorkingDays(start, end, holidayDates)
  if (durationDays <= 0) {
    throw Object.assign(new Error('Leave request must span at least one working day'), { status: 400 })
  }

  // Balance check outside transaction — warning only, not a blocking constraint
  const balanceRow = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId: { userId, leaveTypeId } },
    select: { balance: true },
  })
  const balanceWarning = balanceRow ? balanceRow.balance < durationDays : false

  // AD-4: overlap SELECT + INSERT inside a single transaction to prevent TOCTOU
  const { request, overlappingLeaves } = await prisma.$transaction(async (tx) => {
    let overlapping: OverlappingLeave[] = []
    if (submitter.managerId) {
      const teamLeaves = await tx.leaveRequest.findMany({
        where: {
          status: 'APPROVED',
          userId: { not: userId },
          user: { managerId: submitter.managerId },
          startDate: { lte: end },
          endDate: { gte: start },
        },
        include: {
          user: { select: { name: true } },
          leaveType: { select: { name: true } },
        },
      })
      overlapping = teamLeaves.map((lr) => ({
        id: lr.id,
        employeeName: lr.user.name,
        leaveTypeName: lr.leaveType.name,
        startDate: lr.startDate.toISOString().slice(0, 10),
        endDate: lr.endDate.toISOString().slice(0, 10),
      }))
    }

    const created = await tx.leaveRequest.create({
      data: {
        userId,
        leaveTypeId,
        startDate: start,
        endDate: end,
        durationDays,
        reason,
        documentPath: documentPath ?? null,
        status: 'PENDING',
      },
    })

    const row: LeaveRequestRow = {
      id: created.id,
      userId: created.userId,
      leaveTypeId: created.leaveTypeId,
      startDate: created.startDate.toISOString().slice(0, 10),
      endDate: created.endDate.toISOString().slice(0, 10),
      durationDays: created.durationDays,
      status: created.status,
      reason: created.reason,
      documentPath: created.documentPath,
      comment: created.comment,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    }

    return { request: row, overlappingLeaves: overlapping }
  })

  // AD-8: audit.append() called AFTER transaction commits
  await audit.append({
    leaveRequestId: request.id,
    actorId: userId,
    action: 'SUBMITTED' as const,
    comment: undefined,
  })

  // AD-14: SUBMITTED notification goes to manager, not employee (stub until Story 4.4)
  if (submitter.managerId) {
    await notification.trigger('SUBMITTED', submitter.managerId)
  }

  return {
    request,
    balanceWarning,
    overlapWarning: overlappingLeaves.length > 0,
    overlappingLeaves,
  }
}
