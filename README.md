# E-Commerce Support Ticket Management System

A production-ready, full-stack customer support ticket management system built for e-commerce platforms. Supports multi-tier agent escalation (L1 → L2 → L3), async job processing with BullMQ, role-based access control, Google OAuth, audit logging, and real-time dashboards.

---

## Architecture

```
tick_management/
├── backend/           Express.js + TypeScript REST API
│   ├── src/
│   │   ├── routes/    API route handlers
│   │   ├── workers/   BullMQ job workers
│   │   ├── queues/    BullMQ queue definitions
│   │   ├── db/        PostgreSQL connection, migrations, seeds
│   │   ├── middleware/ authenticate, authorize, error handling
│   │   ├── utils/     auditLog, tokens, priority, assignment, email
│   │   └── types/     TypeScript interfaces + Express augmentation
│   └── ...
└── frontend/          Next.js 14 App Router + TypeScript + Tailwind CSS
    ├── app/
    │   ├── (customer)/  Customer portal pages
    │   ├── (agent)/     Agent portal pages
    │   ├── (admin)/     Admin portal pages
    │   └── auth/        OAuth callback
    ├── lib/api.ts       Axios instance with auto-refresh
    └── store/           Zustand auth store
```

---

## Local Setup

### Prerequisites
- Node.js v18+
- PostgreSQL 14+ (local or Neon cloud)
- Redis 6+ (local or Upstash cloud)
- Git

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd tick_management
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env with your DB, Redis, JWT secrets (see Environment Variables section)

npm install
npm run migrate    # Creates all tables + enums
npm run seed       # Seeds 7 test users, sample orders, tickets
npm run dev        # Start dev server on http://localhost:4000
```

To also start the BullMQ workers (required for queue processing):

```bash
npm run worker
```

To run the unit test suite:

```bash
npm test              # Run all tests with coverage report
npm run test:watch    # Watch mode for development
```

> **Test coverage:** 46 tests across 3 suites — `priority`, `tokens`, `escalation logic` — targeting 60%+ line coverage.


### 3. Frontend setup

```bash
cd ../frontend
cp .env.local.example .env.local   # or create manually — see below
npm install
npm run dev        # Start Next.js on http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `PORT` | API server port | `4000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/ticketdb` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | `your-strong-secret-here` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | `another-strong-secret` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | from Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI | `http://localhost:4000/api/auth/oauth/google/callback` |
| `SMTP_HOST` | SMTP host (leave blank for Ethereal auto) | `smtp.ethereal.email` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `test@ethereal.email` |
| `SMTP_PASS` | SMTP password | `ethereal-password` |
| `SMTP_FROM` | From address for emails | `noreply@ticketapp.com` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:4000/api` |

---

## Test Credentials

All credentials work on both local and live demo:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@ticketapp.com` | `Admin@123` |
| **Agent L1** | `agent.l1a@ticketapp.com` | `AgentL1@123` |
| **Agent L1 (B)** | `agent.l1b@ticketapp.com` | `AgentL1@123` |
| **Agent L2** | `agent.l2@ticketapp.com` | `AgentL2@123` |
| **Agent L3** | `agent.l3@ticketapp.com` | `AgentL3@123` |
| **Customer** | `customer1@example.com` | `Customer@123` |
| **Customer (B)** | `customer2@example.com` | `Customer@123` |

---

## Live Demo

| Service | URL |
|---|---|
| Frontend (Vercel) | _Update after deployment_ |
| Backend API (Render) | _Update after deployment_ |

---

## API Documentation

Base URL: `https://<backend-url>/api`

All authenticated endpoints require: `Authorization: Bearer <accessToken>`

---

### Auth Routes

#### `POST /auth/register`
Create a new customer account.

**Body:**
```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "Password@123" }
```

**Response:** `201` → `{ user, accessToken, refreshToken }`

---

#### `POST /auth/login`
Authenticate with email + password.

**Body:**
```json
{ "email": "jane@example.com", "password": "Password@123" }
```

**Response:** `200` → `{ user, accessToken, refreshToken }`

---

#### `GET /auth/oauth/google`
Redirect to Google OAuth consent screen.

---

#### `GET /auth/oauth/google/callback`
Google OAuth callback. Redirects to: `FRONTEND_URL/auth/callback?accessToken=...&refreshToken=...`

---

#### `POST /auth/refresh`
Issue a new access token using a valid refresh token.

**Body:** `{ "refreshToken": "..." }`

**Response:** `200` → `{ accessToken, refreshToken }`

---

#### `POST /auth/logout`
Invalidate current access token + delete refresh token.

**Auth:** Required

**Response:** `200` → `{ message: "Logged out successfully" }`

---

#### `GET /auth/me`
Get current authenticated user.

**Auth:** Required

**Response:** `200` → `{ user: { id, email, name, role, is_active } }`

---

### Ticket Routes

#### `POST /tickets`
Create a new ticket. Auto-assigns priority and agent.

**Auth:** Customer only

**Body:**
```json
{
  "subject": "My order never arrived",
  "description": "Order placed 2 weeks ago, not delivered",
  "issue_type": "Delivery",
  "order_id": "ORD-001"
}
```

**Response:** `201` → `{ ticket }`

---

#### `GET /tickets`
List tickets. Customers see own; agents see assigned; admin sees all.

**Auth:** Required

**Query params:** `status`, `priority`, `order_id`, `from`, `to`, `page`, `limit`, `search`

**Response:** `200` → `{ data: [...tickets], total, page, limit, totalPages }`

---

#### `GET /tickets/:id`
Get ticket detail with messages and linked order/payment info.

**Auth:** Required (customer sees own ticket only)

**Response:** `200` → `{ ticket, messages, order?, payment? }`

---

#### `PATCH /tickets/:id`
Update ticket fields (status, assigned_to, priority).

**Auth:** Agent / Admin

**Body:** `{ "status": "in_progress" }`

**Response:** `200` → `{ ticket }`

---

#### `POST /tickets/:id/messages`
Add a message to a ticket thread.

**Auth:** Required

**Body:** `{ "message": "...", "is_internal": false }`

**Response:** `201` → `{ message }`

---

#### `GET /tickets/:id/messages`
Get all messages. Internal messages hidden from customers.

**Auth:** Required

**Response:** `200` → `[...messages]`

---

#### `POST /tickets/:id/escalate`
Escalate ticket to next level (L1→L2, L2→L3).

**Auth:** Agent only

**Body:** `{ "reason": "Customer escalated via phone" }`

**Response:** `200` → `{ ticket, escalation }`

---

#### `POST /tickets/:id/resolve`
Mark ticket as resolved.

**Auth:** Agent / Admin

**Response:** `200` → `{ ticket }`

---

#### `POST /tickets/:id/reassign`
Reassign ticket to another agent.

**Auth:** Agent / Admin

**Body:** `{ "agent_id": "<uuid>" }`

**Response:** `200` → `{ ticket }`

---

#### `DELETE /tickets/:id`
Soft-delete ticket (sets `deleted_at`, status → `deleted`).

**Auth:** Admin only

**Response:** `200` → `{ message: "Ticket deleted" }`

---

### Escalation Routes

#### `GET /escalations`
Full escalation history (with optional `ticket_id` filter).

**Auth:** Admin / Agent

---

#### `POST /escalations/rules`
Update SLA escalation rules (stored in Redis).

**Auth:** Admin only

**Body:** `{ "l1_to_l2_hours": 24, "l2_to_l3_hours": 48 }`

---

#### `GET /escalations/rules`
Get current escalation rules.

**Auth:** Admin only

---

### Dashboard Routes

#### `GET /dashboard/customer`
**Auth:** Customer

Returns: `{ total, open, in_progress, escalated, resolved, closed, recent_tickets }`

---

#### `GET /dashboard/agent`
**Auth:** Agent

Returns: `{ assigned, open_by_priority, resolved_today, escalated }`

---

#### `GET /dashboard/admin`
**Auth:** Admin

Returns: `{ counts, agent_performance[], escalation_rate, daily_last_7_days[] }`

---

### Analytics Routes

#### `GET /analytics/tickets?days=30`
**Auth:** Admin / Agent

Returns: `{ daily[], by_priority[], by_status[], by_issue_type[], avg_resolution_hours, escalation_rate }`

---

### Agent Routes

#### `GET /agents/workload`
**Auth:** Admin / Agent

Returns each agent's open ticket count by priority.

---

### Order Routes

#### `GET /orders/:orderId`
**Auth:** Customer (own orders) / Agent / Admin

Returns order details including items JSON.

---

#### `GET /orders/:orderId/payments`
**Auth:** Customer (own orders) / Agent / Admin

Returns payment records for the order.

---

### Audit Routes

#### `GET /audit/tickets/:id`
**Auth:** Admin only

Full audit trail for a specific ticket.

---

#### `GET /audit/users/:id`
**Auth:** Admin only

All actions performed by a specific user.

---

### Job Routes

#### `GET /jobs/status/:jobId`
**Auth:** Admin only

Returns BullMQ job state (`waiting`, `active`, `completed`, `failed`).

---

#### `GET /jobs/failed`
**Auth:** Admin only

Lists all failed jobs across all queues.

---

#### `POST /jobs/retry/:jobId`
**Auth:** Admin only

Retry a specific failed job by ID.

---

### Admin Routes

#### `GET /admin/users`
**Auth:** Admin only

Paginated list of all users.

**Query params:** `role`, `search`, `page`, `limit`

---

#### `PATCH /admin/users/:id`
**Auth:** Admin only

Update user role and/or active status.

**Body:** `{ "role": "agent_l2", "is_active": true }`

---

## Role Summary

| Role | Capabilities |
|---|---|
| `customer` | Create tickets for own orders; view/reply own tickets; view customer dashboard |
| `agent_l1` | View assigned tickets; add messages (internal + external); escalate to L2; resolve |
| `agent_l2` | Same as L1 + escalate to L3; assigned High/Critical tickets by default |
| `agent_l3` | Same as L2; top-tier escalation target |
| `admin` | Full access; manage users; soft-delete tickets; view all analytics + audit logs |

---

## Queue Workers

| Queue | Trigger | Action |
|---|---|---|
| `ticket-classification` | Ticket creation | Re-evaluate priority from description keywords |
| `auto-escalation` | Every 1 hour (cron) | Escalate L1→L2 after 24h, L2→L3 after 48h |
| `email-notifications` | Ticket create/assign/resolve | Send email to customer/agent via Nodemailer |
| `cleanup-archive` | Daily cron | Soft-delete resolved/closed tickets older than 90 days |

## Bonus Features Implemented

- **Unit Tests (Jest + ts-jest):** 46 tests across 3 suites — `priority.test.ts`, `tokens.test.ts`, `escalation.test.ts` — covering keyword priority detection, JWT generation/verification, and SLA escalation rules. Run with `npm test` from the `backend/` directory.

---

## Security Highlights

- **Parameterized SQL** everywhere (no string concatenation)
- **JWT access token** stored in memory on the client (not localStorage)
- **Refresh token** stored in Redis on the server; deleted on logout
- **Token blacklisting** on logout (access token added to Redis with TTL)
- **Helmet** on all routes
- **Rate limiting**: 500/15min globally, 20/15min on auth routes
- **CORS** restricted to configured `FRONTEND_URL`
- **RBAC** middleware on every protected route
- **is_active** check on every authenticated request
- **Soft deletes** — ticket rows are never hard-deleted

---

## Deployment Instructions

### 1. Database — Neon (Postgres)
1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string
3. Set as `DATABASE_URL` in your backend env vars
4. Run: `DATABASE_URL="..." npm run migrate && npm run seed`

### 2. Redis — Upstash
1. Create a Redis database at [upstash.com](https://upstash.com)
2. Copy the `redis://` URL
3. Set as `REDIS_URL` in backend env vars

### 3. Backend — Render
1. Connect GitHub repo, select `backend/` as root directory
2. Build: `npm install && npm run build`
3. Start: `npm start`
4. Set all env vars in Render dashboard
5. Health check path: `/api/health`

### 4. Frontend — Vercel
1. Import GitHub repo, set root to `frontend/`
2. Set `NEXT_PUBLIC_API_URL` to your Render backend URL
3. Deploy — Vercel auto-detects Next.js

### 5. Update CORS
Set `FRONTEND_URL` on Render to your Vercel URL after it's deployed.
