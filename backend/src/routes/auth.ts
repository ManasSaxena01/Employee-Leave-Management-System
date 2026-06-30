import { Router } from 'express'
import { loginController, refreshController } from '../controllers/auth.js'

export const authRouter = Router()

authRouter.post('/login', loginController)
authRouter.post('/refresh', refreshController)

// Story 1.3 will add:
// authRouter.post('/logout', authenticate, logoutController)
