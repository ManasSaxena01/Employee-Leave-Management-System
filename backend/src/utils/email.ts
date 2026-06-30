import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

async function createTransport() {
  if (process.env['EMAIL_PROVIDER'] === 'resend') {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: process.env['RESEND_API_KEY'] }
    })
  }
  // Ethereal fake SMTP for development
  const account = await nodemailer.createTestAccount()
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: account.user, pass: account.pass }
  })
}

// AD-7: fire-and-forget — never re-throws; callers must NOT await this
export async function sendEmail(opts: EmailOptions): Promise<void> {
  try {
    const transport = await createTransport()
    await transport.sendMail({ from: 'no-reply@leave.app', ...opts })
  } catch (err) {
    console.error('[email] send failed:', err)
  }
}
