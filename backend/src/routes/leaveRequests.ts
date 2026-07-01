import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { authenticate } from '../middleware/auth.js'
import { upload } from '../middleware/upload.js'
import { submitLeaveRequestController } from '../controllers/leaveRequests.js'

export const leaveRequestsRouter = Router()

function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('document')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ success: false, error: err.message })
      return
    }
    if (err instanceof Error) {
      res.status(400).json({ success: false, error: err.message })
      return
    }
    next()
  })
}

leaveRequestsRouter.post('/', authenticate, handleUpload, submitLeaveRequestController)
