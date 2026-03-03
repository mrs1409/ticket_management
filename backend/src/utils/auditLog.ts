import { query } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

export async function auditLog(
  action_type: string,
  user_id: string | null,
  ticket_id: string | null,
  before_state: Record<string, unknown> | null,
  after_state: Record<string, unknown> | null,
  ip_address: string | null
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (id, action_type, user_id, ticket_id, before_state, after_state, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        action_type,
        user_id || null,
        ticket_id || null,
        before_state ? JSON.stringify(before_state) : null,
        after_state ? JSON.stringify(after_state) : null,
        ip_address || null,
      ]
    );
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err);
    // Non-fatal — don't throw
  }
}
