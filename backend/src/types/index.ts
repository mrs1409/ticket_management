export type UserRole = 'customer' | 'agent_l1' | 'agent_l2' | 'agent_l3' | 'admin';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketStatus = 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed' | 'deleted';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  role: UserRole;
  name: string;
  is_active: boolean;
  oauth_provider?: string;
  oauth_id?: string;
  created_at: Date;
}

export interface Ticket {
  id: string;
  user_id: string;
  order_id?: string;
  issue_type: string;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  assigned_to?: string;
  escalation_level: number;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  created_at: Date;
}

export interface EscalationHistory {
  id: string;
  ticket_id: string;
  from_level: number;
  to_level: number;
  reason?: string;
  escalated_by?: string;
  escalated_at: Date;
}

export interface AuditLog {
  id: string;
  action_type: string;
  user_id?: string;
  ticket_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  ip_address?: string;
  created_at: Date;
}

export interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  items: Array<{ sku: string; name: string; quantity: number; price: number }>;
  created_at: Date;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  payment_method?: string;
  transaction_id?: string;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request
import { Request } from 'express';

export type AuthUser = Omit<User, 'password_hash'>;

// Augment Express's Request.user so `authenticate` middleware is compatible
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends AuthUser {}
  }
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
