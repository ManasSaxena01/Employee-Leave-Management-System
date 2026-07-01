import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import {
  listCompanyHolidaysController,
  createCompanyHolidayController,
  updateCompanyHolidayController,
  deleteCompanyHolidayController,
} from '../controllers/companyHolidays.js'

export const companyHolidaysRouter = Router()

// AC4: all authenticated users can read the holiday list
companyHolidaysRouter.get('/', authenticate, listCompanyHolidaysController)
// AC1/AC2/AC3: only admins can manage holidays
companyHolidaysRouter.post('/', authenticate, requireRole(['ADMIN']), createCompanyHolidayController)
companyHolidaysRouter.patch('/:id', authenticate, requireRole(['ADMIN']), updateCompanyHolidayController)
companyHolidaysRouter.delete('/:id', authenticate, requireRole(['ADMIN']), deleteCompanyHolidayController)
