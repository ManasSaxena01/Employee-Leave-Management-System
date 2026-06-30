import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import {
  listLeaveTypesController,
  createLeaveTypeController,
  updateLeaveTypeController,
} from '../controllers/leaveTypes.js'

export const leaveTypesRouter = Router()

leaveTypesRouter.get('/', authenticate, listLeaveTypesController)
leaveTypesRouter.post('/', authenticate, requireRole(['ADMIN']), createLeaveTypeController)
leaveTypesRouter.patch('/:id', authenticate, requireRole(['ADMIN']), updateLeaveTypeController)
