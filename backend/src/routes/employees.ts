import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import {
  listEmployeesController,
  getEmployeeController,
  createEmployeeController,
  updateEmployeeController,
  listAvailableManagersController,
  getEmployeeBalancesController,
  updateEmployeeBalanceController,
} from '../controllers/employees.js'

export const employeesRouter = Router()

// CRITICAL: /available-managers MUST come before /:id or Express treats
// the literal string "available-managers" as the :id param.
employeesRouter.get('/available-managers', authenticate, requireRole(['ADMIN']), listAvailableManagersController)

employeesRouter.get('/', authenticate, requireRole(['ADMIN']), listEmployeesController)
employeesRouter.get('/:id', authenticate, requireRole(['ADMIN']), getEmployeeController)
employeesRouter.post('/', authenticate, requireRole(['ADMIN']), createEmployeeController)
employeesRouter.patch('/:id', authenticate, requireRole(['ADMIN']), updateEmployeeController)
employeesRouter.get('/:id/balances', authenticate, requireRole(['ADMIN']), getEmployeeBalancesController)
employeesRouter.patch('/:id/balances/:leaveTypeId', authenticate, requireRole(['ADMIN']), updateEmployeeBalanceController)
