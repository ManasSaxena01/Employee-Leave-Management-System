# Employee Leave Management System

Full-stack leave management system built with Node.js 24 / Express 5 / Prisma 7 / React 18 / TailwindCSS 4.

## Prerequisites

- Node.js 24 LTS
- Docker & Docker Compose
- npm 10+

## Quick Start

### 1. Clone and configure environment

```bash
cp .env.example .env
# Edit .env if needed (defaults work for local Docker setup)
```

### 2. Start the database

```bash
docker compose up -d
```

Postgres 16 will be available at `localhost:5432`.
pgAdmin UI will be available at `http://localhost:5050` (admin@admin.com / admin).

### 3. Install and migrate backend

```bash
cd backend
npm install
npx prisma migrate dev --name init
```

### 4. Start the backend

```bash
npm run dev
```

Backend runs on `http://localhost:4000`.

### 5. Install and start frontend

```bash
cd ../frontend
npm install
npm run dev
```

Frontend dev server runs on `http://localhost:5173`.

## Demo Seed Credentials

> Seed data is implemented in Story 1.4. Credentials will be added here once available.

| Role     | Email | Password |
|----------|-------|----------|
| Admin    | TBD   | TBD      |
| Manager  | TBD   | TBD      |
| Employee | TBD   | TBD      |

## Project Structure

```
employee-leave-management-system/
├── backend/          Node.js 24 / Express 5 / Prisma 7 API
├── frontend/         React 18 / React Router 7 / TailwindCSS 4 SPA
├── docker-compose.yml
└── .env.example
```

## Tech Stack

- **Backend:** Node.js 24, Express 5, TypeScript 6, Prisma 7, PostgreSQL 16
- **Frontend:** React 18, React Router 7, TanStack Query 5, TailwindCSS 4, Vite
- **Infrastructure:** Docker Compose, pgAdmin

## Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with tsx watch |
| `npm test` | Run unit tests (Vitest) |
| `npx prisma migrate dev` | Apply Prisma migrations |
| `npx prisma studio` | Open Prisma Studio |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
