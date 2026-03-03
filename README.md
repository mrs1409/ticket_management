<!-- ============================================================
     TICKETDESK  -  README
     ============================================================ -->

# TicketDesk

### Production-grade Customer Support Ticket Management System

*Multi-role · Full-stack · Background queues · Google OAuth · Real-time analytics*
---

## Table of Contents

- [What is TicketDesk?](#what-is-ticketdesk)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Test Credentials](#test-credentials)
- [API Reference](#api-reference)
- [Role Capabilities](#role-capabilities)
- [Background Workers](#background-workers)
- [Security](#security)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## What is TicketDesk?

TicketDesk is a **multi-role customer support platform** where:

- **Customers** submit support tickets linked to their orders
- **Agents** (L1 to L2 to L3) triage, escalate, and resolve tickets
- **Admins** have full visibility via analytics, audit trails, and user management

Everything runs on a REST API with JWT authentication, BullMQ background workers for auto-escalation, and real-time email notifications at each ticket lifecycle stage.

---

## Architecture

```
+-------------------------------------------------------------------+
|                         CLIENT BROWSER                            |
|                   Next.js 15 (App Router)                         |
|   Landing --> Login / Register --> Dashboard (per role)           |
|             Customer  |  Agent L1/L2/L3  |  Admin                |
+----------------------+--------------------------------------------+
                       |  HTTPS / REST   (Authorization: Bearer)
+----------------------v--------------------------------------------+
|                     EXPRESS API  :5000                            |
|                                                                   |
|   /auth  /tickets  /escalations  /dashboard  /analytics          |
|   /agents  /orders  /audit  /jobs  /admin                        |
|                                                                   |
|   Passport.js (Local + Google OAuth 2.0)                         |
|   JWT (Access 15 min / Refresh 7 d) + Token Blacklist            |
|   RBAC Middleware  .  Helmet  .  Rate Limiter                     |
+------+-------------------------------------------+---------------+
       |                                           |
+------v----------+                  +-------------v--------------+
|  Neon Postgres  |                  |    Upstash Redis           |
|  (pg pool)      |                  |  Sessions . Blacklist      |
|  10 tables      |                  |  BullMQ Queues . SLA Rules |
+-----------------+                  +-------------+--------------+
                                                   |
                                       +-----------v--------------+
                                       |     BullMQ Workers       |
                                       |   ticket-classification  |
                                       |   auto-escalation (1h)   |
                                       |   email-notifications    |
                                       |   cleanup-archive (24h)  |
                                       +--------------------------+
```

---

## Features

|  #  | Area                 | Description                                                                                    |
| :-: | :------------------- | :--------------------------------------------------------------------------------------------- |
|  1  | **Authentication**   | Email/password + Google OAuth 2.0; JWT access (15 min) + refresh (7 d); blacklist on logout   |
|  2  | **Role-Based Access**| 5 roles: `customer` `agent_l1` `agent_l2` `agent_l3` `admin` — enforced on every route        |
|  3  | **Ticket Lifecycle** | Create → auto-priority → auto-assign → escalate (L1 to L2 to L3) → resolve                   |
|  4  | **Priority Engine**  | Keyword matching maps ticket description to Low / Medium / High / Critical automatically       |
|  5  | **SLA Escalation**   | BullMQ cron every hour; auto-escalates tickets past configurable time thresholds               |
|  6  | **Email Alerts**     | Nodemailer on ticket create, assignment, and resolution (Ethereal in dev)                      |
|  7  | **Analytics**        | Daily volume, by-priority breakdown, average resolution time, escalation rate                  |
|  8  | **Audit Logs**       | Immutable, append-only log of every ticket state change and user action                        |
|  9  | **Admin Panel**      | Manage users (role + active status), view all tickets, retry failed background jobs            |
| 10  | **Test Suite**       | 46 Jest / ts-jest tests covering priority detection, JWT logic, and SLA escalation rules       |

---

## Tech Stack

### Backend

| Layer              | Technology                                             |
| :----------------- | :----------------------------------------------------- |
| Runtime            | Node.js 20 + TypeScript 5                             |
| Framework          | Express 4                                             |
| Database           | PostgreSQL 16 via Neon (`pg` pool)                    |
| Cache and Queues   | Redis via Upstash (`ioredis` + BullMQ)                |
| Authentication     | Passport.js — Local strategy + Google OAuth 2.0, JWT  |
| Email              | Nodemailer (Ethereal dev / SMTP prod)                 |
| Testing            | Jest + ts-jest (46 tests)                             |
| Security           | Helmet, express-rate-limit, CORS, parameterized SQL   |

### Frontend

| Layer              | Technology                                             |
| :----------------- | :----------------------------------------------------- |
| Framework          | Next.js 15 — App Router, Turbopack                    |
| Language           | TypeScript 5                                          |
| State Management   | Zustand                                               |
| HTTP Client        | Axios with auto refresh-token interceptor             |
| Styling            | Tailwind CSS v4                                       |
| UI Components      | Lucide React, react-hot-toast, Recharts               |

---

## Quick Start

### Prerequisites

- Node.js 20+
- [Neon](https://neon.tech) PostgreSQL (or local Postgres)
- [Upstash](https://upstash.com) Redis (or local Redis)

---

### 1. Clone the repo

```bash
git clone https://github.com/your-username/tick_management.git
cd tick_management
```

---

### 2. Set up the Backend

```bash
cd backend
cp .env.example .env
# Fill in all values - see Environment Variables section
```

```bash
npm install
npm run build
npm run migrate    # Creates all tables and enums in your DB
npm run seed       # Seeds 7 test users, sample orders, and tickets
npm run dev        # Dev server at http://localhost:5000
```

In a **second terminal**, start the background workers:

```bash
npm run worker
```

Run the test suite:

```bash
npm test              # Full suite with coverage
npm run test:watch    # Watch mode
```

---

### 3. Set up the Frontend

```bash
cd frontend

# Create the env file
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local

npm install
npm run dev    # Next.js at http://localhost:3000
```

---

## Environment Variables

### `backend/.env`

| Variable               | Description                                      | Example Value                                                |
| :--------------------- | :----------------------------------------------- | :----------------------------------------------------------- |
| `PORT`                 | API server port                                  | `5000`                                                       |
| `NODE_ENV`             | Runtime environment                              | `development`                                                |
| `DATABASE_URL`         | PostgreSQL connection string                     | `postgres://user:pass@host/db?sslmode=require`               |
| `REDIS_URL`            | Redis connection string                          | `rediss://default:pass@host:6379`                            |
| `JWT_ACCESS_SECRET`    | Secret for short-lived access tokens             | any long random string                                       |
| `JWT_REFRESH_SECRET`   | Secret for refresh tokens — **must differ**      | another long random string                                   |
| `FRONTEND_URL`         | CORS allowed origin                              | `http://localhost:3000`                                      |
| `GOOGLE_CLIENT_ID`     | Google OAuth2 client ID                          | from Google Cloud Console                                    |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret                      | from Google Cloud Console                                    |
| `GOOGLE_CALLBACK_URL`  | OAuth redirect URI                               | `http://localhost:5000/api/auth/oauth/google/callback`       |
| `SMTP_HOST`            | SMTP server host                                 | `smtp.ethereal.email`                                        |
| `SMTP_PORT`            | SMTP server port                                 | `587`                                                        |
| `SMTP_USER`            | SMTP username                                    | —                                                            |
| `SMTP_PASS`            | SMTP password                                    | —                                                            |
| `SMTP_FROM`            | Sender address                                   | `noreply@ticketapp.com`                                      |

### `frontend/.env.local`

| Variable                | Description            | Example Value                   |
| :---------------------- | :--------------------- | :------------------------------ |
| `NEXT_PUBLIC_API_URL`   | Backend API base URL   | `http://localhost:5000/api`     |

---

## Test Credentials

> Use any of these on a local or live instance after running `npm run seed`.

| Role               | Email                         | Password       |
| :----------------- | :---------------------------- | :------------: |
| **Admin**          | `admin@ticketapp.com`         | `Admin@123`    |
| **Agent - L1 (A)** | `agent.l1a@ticketapp.com`     | `AgentL1@123`  |
| **Agent - L1 (B)** | `agent.l1b@ticketapp.com`     | `AgentL1@123`  |
| **Agent - L2**     | `agent.l2@ticketapp.com`      | `AgentL2@123`  |
| **Agent - L3**     | `agent.l3@ticketapp.com`      | `AgentL3@123`  |
| **Customer (A)**   | `customer1@example.com`       | `Customer@123` |
| **Customer (B)**   | `customer2@example.com`       | `Customer@123` |

---

## API Reference

**Base URL:** `http://localhost:5000/api`

All protected endpoints require the header:

```
Authorization: Bearer <accessToken>
```

---

### Auth `/auth`

| Method   | Endpoint                       | Protected | Description                              |
| :------: | :----------------------------- | :-------: | :--------------------------------------- |
| `POST`   | `/auth/register`               | —         | Register a new customer account          |
| `POST`   | `/auth/login`                  | —         | Email + password login                   |
| `GET`    | `/auth/oauth/google`           | —         | Redirect to Google OAuth consent screen  |
| `GET`    | `/auth/oauth/google/callback`  | —         | Handle Google OAuth callback             |
| `POST`   | `/auth/refresh`                | —         | Rotate both access and refresh tokens    |
| `POST`   | `/auth/logout`                 | Yes       | Blacklist tokens and end session         |
| `GET`    | `/auth/me`                     | Yes       | Return the currently authenticated user  |

---

### Tickets `/tickets`

| Method   | Endpoint                      | Protected     | Description                                           |
| :------: | :---------------------------- | :-----------: | :---------------------------------------------------- |
| `POST`   | `/tickets`                    | Customer      | Create ticket with auto-priority and auto-assign      |
| `GET`    | `/tickets`                    | Any           | List tickets scoped by role; supports filters + pages |
| `GET`    | `/tickets/:id`                | Any           | Full detail with messages and linked order            |
| `PATCH`  | `/tickets/:id`                | Agent / Admin | Update status, priority, or assignee                  |
| `POST`   | `/tickets/:id/messages`       | Any           | Post a message (agents can flag as internal)          |
| `GET`    | `/tickets/:id/messages`       | Any           | Full thread (internal notes hidden from customers)    |
| `POST`   | `/tickets/:id/escalate`       | Agent         | Escalate — L1 to L2, or L2 to L3                     |
| `POST`   | `/tickets/:id/resolve`        | Agent / Admin | Mark the ticket as resolved                           |
| `POST`   | `/tickets/:id/reassign`       | Agent / Admin | Reassign to a different agent                         |
| `DELETE` | `/tickets/:id`                | Admin         | Soft-delete a ticket                                  |

---

### Escalations `/escalations`

| Method | Endpoint               | Protected     | Description                    |
| :----: | :--------------------- | :-----------: | :----------------------------- |
| `GET`  | `/escalations`         | Admin / Agent | Full escalation history        |
| `GET`  | `/escalations/rules`   | Admin         | View current SLA thresholds    |
| `POST` | `/escalations/rules`   | Admin         | Update SLA time thresholds     |

---

### Dashboard and Analytics

| Method | Endpoint                | Protected     | Description                                    |
| :----: | :---------------------- | :-----------: | :--------------------------------------------- |
| `GET`  | `/dashboard/customer`   | Customer      | Personal ticket summary and stats              |
| `GET`  | `/dashboard/agent`      | Agent         | Assigned-ticket summary and SLA status         |
| `GET`  | `/dashboard/admin`      | Admin         | System-wide ticket and agent stats             |
| `GET`  | `/analytics/tickets`    | Admin / Agent | Daily trend, by-priority counts, resolution time |

---

### Admin and Agents

| Method  | Endpoint             | Protected     | Description                            |
| :-----: | :------------------- | :-----------: | :------------------------------------- |
| `GET`   | `/admin/users`       | Admin         | Paginated list of all users            |
| `PATCH` | `/admin/users/:id`   | Admin         | Change a user's role or active status  |
| `GET`   | `/agents/workload`   | Admin / Agent | Count of open tickets per agent        |

---

### Orders, Audit and Jobs

| Method | Endpoint                       | Protected                | Description                             |
| :----: | :----------------------------- | :----------------------: | :-------------------------------------- |
| `GET`  | `/orders/:orderId`             | Owner / Agent / Admin    | Order details                           |
| `GET`  | `/orders/:orderId/payments`    | Owner / Agent / Admin    | Payment records for an order            |
| `GET`  | `/audit/tickets/:id`           | Admin                    | Complete audit trail for a ticket       |
| `GET`  | `/audit/users/:id`             | Admin                    | All recorded actions by a user          |
| `GET`  | `/jobs/status/:jobId`          | Admin                    | BullMQ job status by ID                 |
| `GET`  | `/jobs/failed`                 | Admin                    | All failed jobs across every queue      |
| `POST` | `/jobs/retry/:jobId`           | Admin                    | Retry a specific failed job             |

---

## Role Capabilities

| Role        | What they can do                                                                                  |
| :---------- | :------------------------------------------------------------------------------------------------ |
| `customer`  | Create tickets for their own orders · view and reply to their own tickets · customer dashboard    |
| `agent_l1`  | View assigned tickets · post messages · escalate to L2 · mark resolved                           |
| `agent_l2`  | Everything L1 can do + escalate to L3 · receives High / Critical tickets by default              |
| `agent_l3`  | Everything L2 can do · top-tier escalation endpoint                                               |
| `admin`     | Full system access · manage all users · delete any ticket · all analytics and audit logs          |

---

## Background Workers

| Queue                    | Triggered By                      | What It Does                                                       |
| :----------------------- | :-------------------------------- | :----------------------------------------------------------------- |
| `ticket-classification`  | New ticket created                | Re-scores ticket priority using description keywords               |
| `auto-escalation`        | Cron — every 1 hour               | Escalates L1 to L2 and L2 to L3 when SLA thresholds are breached  |
| `email-notifications`    | Ticket create / assign / resolve  | Sends notification email via Nodemailer                            |
| `cleanup-archive`        | Cron — daily                      | Soft-deletes resolved or closed tickets older than 90 days         |

> **SLA defaults:** L1 to L2 after **24 h** · L2 to L3 after **48 h**
> Thresholds are stored in Redis and configurable via `POST /escalations/rules`.

---

## Security

- **Parameterized SQL** on every database query — zero string concatenation
- **JWT access token** stored in memory (not `localStorage`); refresh token stored in Redis
- Refresh token **deleted on logout**; access token **blacklisted** in Redis until it expires
- **Helmet** sets security headers on every response
- **Rate limiting:** 500 req / 15 min globally · 20 req / 15 min on all auth routes
- **CORS** restricted to the value of `FRONTEND_URL`
- **RBAC middleware** on every protected route — no route trusts client-supplied roles
- `is_active` flag checked on every authenticated request
- **Soft deletes** — ticket rows are never hard-deleted from the database

---

## Deployment

### Step 1 — Database (Neon)

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string and set it as `DATABASE_URL`
3. Run `npm run migrate && npm run seed`

### Step 2 — Redis (Upstash)

1. Create a Redis database at [upstash.com](https://upstash.com)
2. Copy the `rediss://` connection string and set it as `REDIS_URL`

### Step 3 — Backend (Render)

1. Connect your repo, set root directory to `backend/`
2. **Build command:** `npm install && npm run build`
3. **Start command:** `node dist/index.js`
4. Add all environment variables in the Render dashboard
5. Health check path: `/api/health`
6. Add a **second Render service** for workers: `node dist/workers/index.js`

### Step 4 — Frontend (Vercel)

1. Import the repo and set root directory to `frontend/`
2. Add env var: `NEXT_PUBLIC_API_URL=<your-render-url>/api`
3. Deploy — Next.js is auto-detected

### Post-deploy checklist

- [ ] Update `FRONTEND_URL` on Render to your Vercel domain
- [ ] Update `GOOGLE_CALLBACK_URL` on Google Cloud Console and in Render env vars

---

## Project Structure

```
tick_management/
├── backend/
│   ├── src/
│   │   ├── db/           # pg Pool + connection helper
│   │   ├── middleware/   # auth, RBAC, error handler
│   │   ├── queues/       # BullMQ queue definitions
│   │   ├── routes/       # Express routers (one file per domain)
│   │   ├── services/     # Business logic — priority, tokens, SLA
│   │   ├── workers/      # BullMQ worker processes
│   │   └── index.ts      # Application entry point
│   ├── migrations/       # Raw SQL migration files
│   ├── seeds/            # Seed data scripts
│   └── tests/            # Jest test suites (46 tests)
│
└── frontend/
    ├── app/
    │   ├── (customer)/   # Customer dashboard + ticket views
    │   ├── (agent)/      # Agent dashboard + queue management
    │   ├── (admin)/      # Admin — users, analytics, job monitor
    │   ├── auth/         # Login, register, OAuth callback
    │   └── page.tsx      # Public landing page
    ├── store/            # Zustand stores — auth, tickets
    └── proxy.ts          # Next.js middleware — route protection
```

---

<div align="center">

Built with Next.js · Express · PostgreSQL · Redis · BullMQ

</div>
