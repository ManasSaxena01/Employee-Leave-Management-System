import { prisma } from '../prisma/client.js'

// AD-15 + AD-2: provisioning a new leave type must create a leave_balances row
// for every existing active employee, and all balance writes go through this service.
export async function provisionBalancesForNewLeaveType(
  leaveTypeId: string,
  defaultQuota: number
): Promise<void> {
  const activeUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true },
  })

  if (activeUsers.length === 0) return

  await prisma.leaveBalance.createMany({
    data: activeUsers.map((u) => ({ userId: u.id, leaveTypeId, balance: defaultQuota })),
    skipDuplicates: true,
  })
}
