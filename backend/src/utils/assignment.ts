import { query } from '../db/connection';
import { TicketPriority } from '../types';

/**
 * Auto-assign a ticket to the least-loaded eligible agent using load-based balancing.
 *
 * Assignment rules:
 * - Critical / High priority → agent_l2 (these tickets skip L1)
 * - payment issue_type       → agent_l2 (priority escalation per spec)
 * - Low / Medium priority    → agent_l1 with fewest open tickets
 *
 * Falls back to any active agent of the target role if none have tickets yet.
 * Returns null only if no agents of the required role exist.
 *
 * @param priority  - Auto-determined ticket priority
 * @param issueType - Ticket category
 * @returns UUID of the assigned agent, or null
 *
 * - Critical/High → assign to agent_l2 with lowest open ticket count
 * - Low/Medium → assign to agent_l1 with lowest open ticket count (load-balancing)
 */
export async function autoAssignAgent(priority: TicketPriority, issueType: string): Promise<string | null> {
  // Payment issue type → always L2
  const useL2 = priority === 'High' || priority === 'Critical' || issueType.toLowerCase() === 'payment';
  const targetRole = useL2 ? 'agent_l2' : 'agent_l1';

  const result = await query<{ id: string; open_count: string }>(
    `SELECT u.id,
       COUNT(t.id) FILTER (WHERE t.status IN ('open', 'in_progress') AND t.deleted_at IS NULL) AS open_count
     FROM users u
     LEFT JOIN tickets t ON t.assigned_to = u.id
     WHERE u.role = $1 AND u.is_active = true
     GROUP BY u.id
     ORDER BY open_count ASC
     LIMIT 1`,
    [targetRole]
  );

  if (!result.rows.length) {
    // Fallback to any active agent of target role
    const fallback = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = $1 AND is_active = true LIMIT 1`,
      [targetRole]
    );
    return fallback.rows[0]?.id || null;
  }

  return result.rows[0].id;
}
