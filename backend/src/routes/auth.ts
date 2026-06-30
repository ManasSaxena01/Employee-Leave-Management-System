import { Router } from 'express'
import { loginController, refreshController, logoutController } from '../controllers/auth.js'

export const authRouter = Router()

authRouter.post('/login', loginController)
authRouter.post('/refresh', refreshController)
authRouter.post('/logout', logoutController)
