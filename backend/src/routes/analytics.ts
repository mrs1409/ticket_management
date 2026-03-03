import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// --- GET /api/analytics/tickets ---
router.get('/tickets', async (req: AuthRequest, res: Response): Promise<void> => {
  const days = Math.min(parseInt((req.query.days as string) || '30', 10) || 30, 365);

  // Tickets created per day (last N days)
  const dailyCreated = await query(`
    SELECT
      DATE(created_at) AS date,
      COUNT(*) AS count
    FROM tickets
    WHERE created_at >= NOW() - INTERVAL '${days} days' AND deleted_at IS NULL
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  // Average resolution time (hours)
  const avgResolution = await query(`
    SELECT
      ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)::numeric, 2) AS avg_hours
    FROM tickets
    WHERE status = 'resolved' AND deleted_at IS NULL
  `);

  // Escalation count by level
  const escalationByLevel = await query(`
    SELECT
      to_level AS level,
      COUNT(*) AS count
    FROM escalation_history
    GROUP BY to_level
    ORDER BY to_level ASC
  `);

  // Tickets by priority
  const byPriority = await query(`
    SELECT priority, COUNT(*) AS count
    FROM tickets WHERE deleted_at IS NULL
    GROUP BY priority
  `);

  // Tickets by status
  const byStatus = await query(`
    SELECT status, COUNT(*) AS count
    FROM tickets WHERE deleted_at IS NULL
    GROUP BY status
  `);

  // Tickets by issue type
  const byIssueType = await query(`
    SELECT issue_type, COUNT(*) AS count
    FROM tickets WHERE deleted_at IS NULL
    GROUP BY issue_type
    ORDER BY count DESC
    LIMIT 10
  `);

  // Escalation rate (escalated or higher-level tickets / total)
  const escalationRate = await query<{ escalated_tickets: string; total_tickets: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE escalation_level > 1 OR status = 'escalated') AS escalated_tickets,
      COUNT(*) AS total_tickets
    FROM tickets WHERE deleted_at IS NULL
  `);

  const escRow = escalationRate.rows[0];
  const totalTix = parseInt(escRow.total_tickets, 10);
  const escalatedTix = parseInt(escRow.escalated_tickets, 10);
  const escRate = totalTix > 0 ? parseFloat((escalatedTix / totalTix).toFixed(4)) : 0;

  const avgHours = (avgResolution.rows[0] as unknown as { avg_hours?: string | null })?.avg_hours;

  const parseCount = (rows: { count: string | number; [key: string]: unknown }[]) =>
    rows.map(r => ({ ...r, count: parseInt(String(r.count), 10) }));

  const payload = {
    // Keys used by admin dashboard
    daily_created: parseCount(dailyCreated.rows as { count: string | number; [key: string]: unknown }[]),
    escalations_by_level: parseCount(escalationByLevel.rows as { count: string | number; [key: string]: unknown }[]),
    by_priority: parseCount(byPriority.rows as { count: string | number; [key: string]: unknown }[]),
    by_status: parseCount(byStatus.rows as { count: string | number; [key: string]: unknown }[]),
    avg_resolution_hours: parseFloat(avgHours || '0') || 0,
    // Extended keys for analytics page
    daily: parseCount(dailyCreated.rows as { count: string | number; [key: string]: unknown }[]),
    by_escalation_level: parseCount(escalationByLevel.rows as { count: string | number; [key: string]: unknown }[]),
    by_issue_type: parseCount(byIssueType.rows as { count: string | number; [key: string]: unknown }[]),
    escalation_rate: escRate,
    days_range: days,
  };

  res.json(payload);
});

export default router;
