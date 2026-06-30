import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { prisma } from './client.js'
import { calculateWorkingDays } from '../utils/workingDays.js'

async function main() {
  // ── 1. Leave types (FR-LT-1: idempotent, unchanged from existing seed) ───
  const [annual, sick, casual, maternityPaternity, unpaid] = await Promise.all([
    prisma.leaveType.upsert({ where: { name: 'Annual Leave' }, update: {}, create: { name: 'Annual Leave', defaultQuota: 20, documentRequired: false } }),
    prisma.leaveType.upsert({ where: { name: 'Sick Leave' }, update: {}, create: { name: 'Sick Leave', defaultQuota: 10, documentRequired: true } }),
    prisma.leaveType.upsert({ where: { name: 'Casual Leave' }, update: {}, create: { name: 'Casual Leave', defaultQuota: 7, documentRequired: false } }),
    prisma.leaveType.upsert({ where: { name: 'Maternity/Paternity Leave' }, update: {}, create: { name: 'Maternity/Paternity Leave', defaultQuota: 90, documentRequired: false } }),
    prisma.leaveType.upsert({ where: { name: 'Unpaid Leave' }, update: {}, create: { name: 'Unpaid Leave', defaultQuota: 30, documentRequired: false } }),
  ])
  const leaveTypes = [annual, sick, casual, maternityPaternity, unpaid]

  // ── 2. Departments (without managerId to avoid circular FK) ─────────────
  const [engDept, hrDept] = await Promise.all([
    prisma.department.upsert({ where: { name: 'Engineering' }, update: {}, create: { name: 'Engineering' } }),
    prisma.department.upsert({ where: { name: 'Human Resources' }, update: {}, create: { name: 'Human Resources' } }),
  ])

  // ── 3. Users (upsert by email; all share Password123!) ──────────────────
  const passwordHash = await bcrypt.hash('Password123!', 10)

  const [admin, bob, carol, diana, eve, frank] = await Promise.all([
    prisma.user.upsert({ where: { email: 'admin@demo.com' }, update: {}, create: { email: 'admin@demo.com', passwordHash, name: 'Alice Admin', role: 'ADMIN' } }),
    prisma.user.upsert({ where: { email: 'manager@demo.com' }, update: {}, create: { email: 'manager@demo.com', passwordHash, name: 'Bob Manager', role: 'MANAGER', departmentId: engDept.id } }),
    prisma.user.upsert({ where: { email: 'employee@demo.com' }, update: {}, create: { email: 'employee@demo.com', passwordHash, name: 'Carol Employee', role: 'EMPLOYEE', departmentId: engDept.id } }),
    prisma.user.upsert({ where: { email: 'diana@demo.com' }, update: {}, create: { email: 'diana@demo.com', passwordHash, name: 'Diana HR', role: 'MANAGER', departmentId: hrDept.id } }),
    prisma.user.upsert({ where: { email: 'eve@demo.com' }, update: {}, create: { email: 'eve@demo.com', passwordHash, name: 'Eve Engineer', role: 'EMPLOYEE', departmentId: engDept.id } }),
    prisma.user.upsert({ where: { email: 'frank@demo.com' }, update: {}, create: { email: 'frank@demo.com', passwordHash, name: 'Frank Ops', role: 'EMPLOYEE', departmentId: hrDept.id } }),
  ])

  // ── 4. Wire department managers and reporting relationships ──────────────
  await Promise.all([
    prisma.department.update({ where: { id: engDept.id }, data: { managerId: bob.id } }),
    prisma.department.update({ where: { id: hrDept.id }, data: { managerId: diana.id } }),
    prisma.user.update({ where: { id: carol.id }, data: { managerId: bob.id } }),
    prisma.user.update({ where: { id: eve.id }, data: { managerId: bob.id } }),
    prisma.user.update({ where: { id: frank.id }, data: { managerId: diana.id } }),
  ])

  // ── 5. Leave balances: every user × every leave type (30 rows) ──────────
  const users = [admin, bob, carol, diana, eve, frank]
  for (const user of users) {
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: { userId_leaveTypeId: { userId: user.id, leaveTypeId: lt.id } },
        update: {}, // non-destructive: don't clobber balances changed by real approvals/testing on re-seed
        create: { userId: user.id, leaveTypeId: lt.id, balance: lt.defaultQuota },
      })
    }
  }

  // ── 6. Company holidays for 2026 ─────────────────────────────────────────
  const holidays = [
    { date: new Date('2026-01-01'), name: "New Year's Day" },
    { date: new Date('2026-01-26'), name: 'Republic Day' },
    { date: new Date('2026-04-14'), name: 'Dr. Ambedkar Jayanti' },
    { date: new Date('2026-08-15'), name: 'Independence Day' },
    { date: new Date('2026-10-02'), name: 'Gandhi Jayanti' },
    { date: new Date('2026-12-25'), name: 'Christmas Day' },
  ]
  for (const h of holidays) {
    await prisma.companyHoliday.upsert({ where: { date: h.date }, update: {}, create: h })
  }

  // ── 7. Compute working-day durations using seeded holidays ───────────────
  const dbHolidays = await prisma.companyHoliday.findMany()
  const holidayDates = dbHolidays.map(h => h.date)

  const lr1Days = calculateWorkingDays(new Date('2026-08-03'), new Date('2026-08-07'), holidayDates) // 5
  const lr2Days = calculateWorkingDays(new Date('2026-07-06'), new Date('2026-07-08'), holidayDates) // 3
  const lr3Days = calculateWorkingDays(new Date('2026-06-22'), new Date('2026-06-24'), holidayDates) // 3
  const lr4Days = calculateWorkingDays(new Date('2026-05-04'), new Date('2026-05-05'), holidayDates) // 2

  // ── 8. Leave requests (findFirst idempotency — no unique constraint) ──────
  let lr1 = await prisma.leaveRequest.findFirst({ where: { userId: carol.id, startDate: new Date('2026-08-03') } })
  let lr1Created = false
  if (!lr1) {
    lr1 = await prisma.leaveRequest.create({ data: { userId: carol.id, leaveTypeId: annual.id, startDate: new Date('2026-08-03'), endDate: new Date('2026-08-07'), durationDays: lr1Days, status: 'PENDING', reason: 'Family vacation' } })
    lr1Created = true
  }

  let lr2 = await prisma.leaveRequest.findFirst({ where: { userId: eve.id, startDate: new Date('2026-07-06') } })
  let lr2Created = false
  if (!lr2) {
    lr2 = await prisma.leaveRequest.create({ data: { userId: eve.id, leaveTypeId: annual.id, startDate: new Date('2026-07-06'), endDate: new Date('2026-07-08'), durationDays: lr2Days, status: 'APPROVED', reason: 'Medical appointment' } })
    lr2Created = true
  }

  let lr3 = await prisma.leaveRequest.findFirst({ where: { userId: frank.id, startDate: new Date('2026-06-22') } })
  let lr3Created = false
  if (!lr3) {
    lr3 = await prisma.leaveRequest.create({ data: { userId: frank.id, leaveTypeId: casual.id, startDate: new Date('2026-06-22'), endDate: new Date('2026-06-24'), durationDays: lr3Days, status: 'REJECTED', reason: 'Personal errands' } })
    lr3Created = true
  }

  let lr4 = await prisma.leaveRequest.findFirst({ where: { userId: carol.id, startDate: new Date('2026-05-04') } })
  let lr4Created = false
  if (!lr4) {
    lr4 = await prisma.leaveRequest.create({ data: { userId: carol.id, leaveTypeId: casual.id, startDate: new Date('2026-05-04'), endDate: new Date('2026-05-05'), durationDays: lr4Days, status: 'CANCELLED', reason: 'No longer needed' } })
    lr4Created = true
  }

  // ── 9. Audit logs (only when leave request was freshly created) ──────────
  if (lr1Created) {
    await prisma.auditLog.create({ data: { leaveRequestId: lr1.id, actorId: carol.id, action: 'SUBMITTED' } })
  }
  if (lr2Created) {
    await prisma.auditLog.createMany({ data: [
      { leaveRequestId: lr2.id, actorId: eve.id, action: 'SUBMITTED' },
      { leaveRequestId: lr2.id, actorId: bob.id, action: 'APPROVED' },
    ] })
  }
  if (lr3Created) {
    await prisma.auditLog.createMany({ data: [
      { leaveRequestId: lr3.id, actorId: frank.id, action: 'SUBMITTED' },
      { leaveRequestId: lr3.id, actorId: diana.id, action: 'REJECTED' },
    ] })
  }
  if (lr4Created) {
    await prisma.auditLog.createMany({ data: [
      { leaveRequestId: lr4.id, actorId: carol.id, action: 'SUBMITTED' },
      { leaveRequestId: lr4.id, actorId: carol.id, action: 'CANCELLED' },
    ] })
  }

  // ── 10. Adjust Eve's Annual balance to reflect approved deduction ─────────
  // Always update (idempotent: sets to correct value every run)
  await prisma.leaveBalance.update({
    where: { userId_leaveTypeId: { userId: eve.id, leaveTypeId: annual.id } },
    data: { balance: annual.defaultQuota - lr2Days }, // 20 - 3 = 17
  })

  console.log('Seed complete.')
  console.log('')
  console.log('Demo accounts (password: Password123!):')
  console.log('  admin@demo.com     → ADMIN')
  console.log('  manager@demo.com   → MANAGER (Engineering)')
  console.log('  employee@demo.com  → EMPLOYEE (Engineering)')
  console.log('  diana@demo.com     → MANAGER (Human Resources)')
  console.log('  eve@demo.com       → EMPLOYEE (Engineering)')
  console.log('  frank@demo.com     → EMPLOYEE (Human Resources)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
