import dotenv from 'dotenv';
dotenv.config();

import { query, connectDB } from './connection';

const migrations = [
  // Enable UUID extension
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

  // ENUM types
  `DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'agent_l1', 'agent_l2', 'agent_l3', 'admin');
  EXCEPTION WHEN duplicate_object THEN null; END $$`,

  `DO $$ BEGIN
    CREATE TYPE ticket_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
  EXCEPTION WHEN duplicate_object THEN null; END $$`,

  `DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'escalated', 'resolved', 'closed', 'deleted');
  EXCEPTION WHEN duplicate_object THEN null; END $$`,

  // users table
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role user_role NOT NULL DEFAULT 'customer',
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,

  // orders table (mock)
  `CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`,

  // payments table (mock)
  `CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id)`,

  // tickets table
  `CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id VARCHAR(255),
    subject VARCHAR(500) NOT NULL,
    issue_type VARCHAR(100) NOT NULL,
    priority ticket_priority NOT NULL DEFAULT 'Low',
    status ticket_status NOT NULL DEFAULT 'open',
    description TEXT NOT NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    escalation_level INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
  )`,

  // Add subject column if it doesn't exist (idempotent migration)
  `DO $$ BEGIN
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subject VARCHAR(500) NOT NULL DEFAULT '';
  EXCEPTION WHEN others THEN null; END $$`,

  `CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to)`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)`,

  // ticket_messages table
  `CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id)`,

  // escalation_history table
  `CREATE TABLE IF NOT EXISTS escalation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    from_level INT NOT NULL,
    to_level INT NOT NULL,
    reason TEXT,
    escalated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_escalation_history_ticket_id ON escalation_history(ticket_id)`,

  // audit_logs table
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_audit_logs_ticket_id ON audit_logs(ticket_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`,

  // Trigger: auto-update updated_at on tickets
  `CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ language 'plpgsql'`,

  `DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets`,
  `CREATE TRIGGER update_tickets_updated_at
   BEFORE UPDATE ON tickets
   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`,
];

async function migrate() {
  await connectDB();
  console.log('[Migrate] Running migrations...');
  for (const sql of migrations) {
    try {
      await query(sql);
      console.log('[Migrate] OK:', sql.substring(0, 60).replace(/\n/g, ' '));
    } catch (err) {
      console.error('[Migrate] FAILED:', sql.substring(0, 80));
      throw err;
    }
  }
  console.log('[Migrate] All migrations completed successfully');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[Migrate] Fatal error:', err);
  process.exit(1);
});
