import { query } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * Write an immutable audit record for any critical action in the system.
 * Non-fatal: logs errors internally without throwing, ensuring audit failures
 * never disrupt the primary request flow.
 *
 * @param action_type  - Descriptive action label (e.g. 'ticket_create', 'user_login')
 * @param user_id      - UUID of the acting user, or null for system-triggered events
 * @param ticket_id    - UUID of the affected ticket, or null (e.g. auth events)
 * @param before_state - Snapshot of relevant fields BEFORE the change
 * @param after_state  - Snapshot of relevant fields AFTER the change
 * @param ip_address   - Client IP for security traceability
 */
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
