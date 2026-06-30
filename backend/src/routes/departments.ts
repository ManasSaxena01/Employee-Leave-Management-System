import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import {
  listDepartmentsController,
  createDepartmentController,
  updateDepartmentController,
  listAvailableManagersController,
} from '../controllers/departments.js'

export const departmentsRouter = Router()

departmentsRouter.get('/', authenticate, listDepartmentsController)
// Read-only manager list — any authenticated user needs this to resolve a
// department's managerId to a display name (see DepartmentsPage). Mutating
// endpoints below stay ADMIN-only.
departmentsRouter.get('/available-managers', authenticate, listAvailableManagersController)
departmentsRouter.post('/', authenticate, requireRole(['ADMIN']), createDepartmentController)
departmentsRouter.patch('/:id', authenticate, requireRole(['ADMIN']), updateDepartmentController)
