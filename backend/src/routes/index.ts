import { Router } from 'express'
import path from 'path'
import { existsSync } from 'fs'
import { authRouter } from './auth.js'
import { departmentsRouter } from './departments.js'
import { leaveTypesRouter } from './leaveTypes.js'
import { companyHolidaysRouter } from './companyHolidays.js'
import { employeesRouter } from './employees.js'
import { leaveRequestsRouter } from './leaveRequests.js'
import { authenticate } from '../middleware/auth.js'

export const router = Router()

router.use('/auth', authRouter)
router.use('/departments', departmentsRouter)
router.use('/leave-types', leaveTypesRouter)
router.use('/company-holidays', companyHolidaysRouter)
router.use('/employees', employeesRouter)
router.use('/leave-requests', leaveRequestsRouter)

router.get('/files/:filename', authenticate, (req, res) => {
  const filename = path.basename(req.params['filename'] as string)
  const filePath = path.resolve('uploads', filename)
  if (!existsSync(filePath)) {
    res.status(404).json({ success: false, error: 'File not found' })
    return
  }
  res.sendFile(filePath, { root: process.cwd() })
})

// Future story routes registered here (employees, etc.)
