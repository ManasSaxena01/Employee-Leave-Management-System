import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from './client.js'

async function main() {
  // 1. Leave types (FR-LT-1: Sick, Annual, Casual, Maternity/Paternity, Unpaid)
  const [annual, sick, casual, maternityPaternity, unpaid] = await Promise.all([
    prisma.leaveType.upsert({
      where: { name: 'Annual Leave' },
      update: {},
      create: { name: 'Annual Leave', defaultQuota: 20, documentRequired: false },
    }),
    prisma.leaveType.upsert({
      where: { name: 'Sick Leave' },
      update: {},
      create: { name: 'Sick Leave', defaultQuota: 10, documentRequired: true },
    }),
    prisma.leaveType.upsert({
      where: { name: 'Casual Leave' },
      update: {},
      create: { name: 'Casual Leave', defaultQuota: 7, documentRequired: false },
    }),
    prisma.leaveType.upsert({
      where: { name: 'Maternity/Paternity Leave' },
      update: {},
      create: { name: 'Maternity/Paternity Leave', defaultQuota: 90, documentRequired: false },
    }),
    prisma.leaveType.upsert({
      where: { name: 'Unpaid Leave' },
      update: {},
      create: { name: 'Unpaid Leave', defaultQuota: 30, documentRequired: false },
    }),
  ])
  const leaveTypes = [annual, sick, casual, maternityPaternity, unpaid]

  // 2. Department (created without manager first to avoid circular dependency)
  const dept = await prisma.department.upsert({
    where: { name: 'Engineering' },
    update: {},
    create: { name: 'Engineering' },
  })

  // 3. Users — all share the same demo password
  const passwordHash = await bcrypt.hash('Password123!', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      name: 'Alice Admin',
      role: 'ADMIN',
    },
  })

  const manager = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      passwordHash,
      name: 'Bob Manager',
      role: 'MANAGER',
      departmentId: dept.id,
    },
  })

  const employee = await prisma.user.upsert({
    where: { email: 'employee@example.com' },
    update: {},
    create: {
      email: 'employee@example.com',
      passwordHash,
      name: 'Carol Employee',
      role: 'EMPLOYEE',
      departmentId: dept.id,
      managerId: manager.id,
    },
  })

  // 4. Wire the manager to the department now that the user row exists
  await prisma.department.update({
    where: { id: dept.id },
    data: { managerId: manager.id },
  })

  // 5. Leave balances: every user gets the default quota for each leave type
  const users = [admin, manager, employee]
  for (const user of users) {
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: { userId_leaveTypeId: { userId: user.id, leaveTypeId: lt.id } },
        update: {},
        create: { userId: user.id, leaveTypeId: lt.id, balance: lt.defaultQuota },
      })
    }
  }

  // 6. Company holidays for 2026
  const holidays = [
    { date: new Date('2026-01-01'), name: "New Year's Day" },
    { date: new Date('2026-01-26'), name: 'Republic Day' },
    { date: new Date('2026-04-14'), name: 'Dr. Ambedkar Jayanti' },
    { date: new Date('2026-08-15'), name: 'Independence Day' },
    { date: new Date('2026-10-02'), name: 'Gandhi Jayanti' },
    { date: new Date('2026-12-25'), name: 'Christmas Day' },
  ]

  for (const h of holidays) {
    await prisma.companyHoliday.upsert({
      where: { date: h.date },
      update: {},
      create: h,
    })
  }

  console.log('Seed complete.')
  console.log('')
  console.log('Demo accounts (password: Password123!):')
  console.log('  admin@example.com    → ADMIN')
  console.log('  manager@example.com  → MANAGER')
  console.log('  employee@example.com → EMPLOYEE')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
