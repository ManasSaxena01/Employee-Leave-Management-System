import { prisma } from '../prisma/client.js'

type TransactionClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// AD-15 + AD-2: provisioning a new leave type must create a leave_balances row
// for every existing active employee, and all balance writes go through this service.
export async function provisionBalancesForNewLeaveType(
  leaveTypeId: string,
  defaultQuota: number,
  tx?: TransactionClient
): Promise<void> {
  const client = tx ?? prisma
  const activeUsers = await client.user.findMany({
    where: { active: true },
    select: { id: true },
  })

  if (activeUsers.length === 0) return

  await client.leaveBalance.createMany({
    data: activeUsers.map((u) => ({ userId: u.id, leaveTypeId, balance: defaultQuota })),
    skipDuplicates: true,
  })
}

// AD-15: called by services/user.ts on employee creation inside a transaction.
// Provisions one leave_balances row per active leave type for the new user.
export async function provisionBalancesForNewUser(
  userId: string,
  tx?: TransactionClient
): Promise<void> {
  const client = tx ?? prisma
  const activeLeaveTypes = await client.leaveType.findMany({
    where: { active: true },
    select: { id: true, defaultQuota: true },
  })
  if (activeLeaveTypes.length === 0) return
  await client.leaveBalance.createMany({
    data: activeLeaveTypes.map((lt) => ({ userId, leaveTypeId: lt.id, balance: lt.defaultQuota })),
    skipDuplicates: true,
  })
}

export type BalanceRow = {
  leaveTypeId: string
  leaveTypeName: string
  balance: number
  defaultQuota: number
}

export async function getBalancesForUser(userId: string): Promise<BalanceRow[]> {
  const balances = await prisma.leaveBalance.findMany({
    where: { userId },
    include: { leaveType: { select: { name: true, defaultQuota: true } } },
    orderBy: { leaveType: { name: 'asc' } },
  })
  return balances.map((b) => ({
    leaveTypeId: b.leaveTypeId,
    leaveTypeName: b.leaveType.name,
    balance: b.balance,
    defaultQuota: b.leaveType.defaultQuota,
  }))
}

export async function updateBalance(
  userId: string,
  leaveTypeId: string,
  newBalance: number
): Promise<BalanceRow> {
  if (newBalance < 0) {
    throw Object.assign(new Error('balance must be ≥ 0'), { status: 400 })
  }
  const existing = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId: { userId, leaveTypeId } },
  })
  if (!existing) {
    throw Object.assign(new Error('Leave balance record not found'), { status: 404 })
  }
  const updated = await prisma.leaveBalance.update({
    where: { userId_leaveTypeId: { userId, leaveTypeId } },
    data: { balance: newBalance },
    include: { leaveType: { select: { name: true, defaultQuota: true } } },
  })
  return {
    leaveTypeId: updated.leaveTypeId,
    leaveTypeName: updated.leaveType.name,
    balance: updated.balance,
    defaultQuota: updated.leaveType.defaultQuota,
  }
}

export async function resetAllBalances(): Promise<void> {
  const leaveTypes = await prisma.leaveType.findMany({
    where: { active: true },
    select: { id: true, defaultQuota: true },
  })
  if (leaveTypes.length === 0) return
  await prisma.$transaction(
    leaveTypes.map((lt) =>
      prisma.leaveBalance.updateMany({
        where: { leaveTypeId: lt.id },
        data: { balance: lt.defaultQuota },
      })
    )
  )
}
