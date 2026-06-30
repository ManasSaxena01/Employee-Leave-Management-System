# Addendum — Employee Leave Management System

*Content that belongs downstream (architecture, implementation) or earned a place but does not fit the PRD body.*

---

## Tech Stack Decisions

### Frontend
- **React** — component framework
- **TailwindCSS** — utility-first styling
- **React Query** — server state management and caching

### Backend
- **Node.js + Express** — API server
- **Prisma ORM** — type-safe database access and migrations

### Database
- **PostgreSQL** — primary data store
- Local: Docker container
- Production: Supabase or Railway (free tier)

### Authentication
- **JWT** — access tokens (short-lived)
- **bcrypt** — password hashing
- Refresh tokens stored in httpOnly cookies

### File Uploads
- **Multer** — multipart form handling
- Storage: local disk (development) → Cloudflare R2 (production, free tier S3-compatible)

### Email Notifications
- **Nodemailer** — email transport
- Development: Ethereal (mock SMTP, no real sends)
- Production: Resend (free tier, real delivery)

### Report Generation
- CSV: `csv-stringify`
- PDF: `pdf-lib` or `Puppeteer` (decision deferred to architecture phase — Puppeteer offers richer layout at higher resource cost)

---

## V2 Planned Features

- Leave carry-forward: unused days roll over to next year (with optional cap)
- Leave accrual / pro-ration for mid-year joiners
- SSO / OAuth (Google Workspace, SAML)
- Mobile-responsive PWA or native app

---

## Options Considered

### PDF generation: pdf-lib vs Puppeteer
- **pdf-lib** — lightweight, no headless browser, programmatic PDF construction. Limited layout flexibility.
- **Puppeteer** — renders HTML to PDF, rich layout, but adds ~300 MB dependency and higher memory at runtime.
- Decision deferred to architecture. Recommendation: start with pdf-lib; switch to Puppeteer if report layout complexity demands it.

### Email delivery: Ethereal vs Resend
- **Ethereal** — fake SMTP, captures emails to a web inbox. Zero cost, zero deliverability. Good for development.
- **Resend** — real delivery, 3,000 emails/month free tier. Production-suitable.
- Decision: use both — Ethereal for local dev, Resend for production deployment, toggled via `EMAIL_PROVIDER` env var.
