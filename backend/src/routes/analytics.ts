import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// --- GET /api/analytics/tickets ---
router.get('/tickets', async (_req: AuthRequest, res: Response): Promise<void> => {
  // Tickets created per day (last 30 days)
  const dailyCreated = await query(`
    SELECT
      DATE(created_at) AS date,
      COUNT(*) AS count
    FROM tickets
    WHERE created_at >= NOW() - INTERVAL '30 days' AND deleted_at IS NULL
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
      to_level AS escalation_level,
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

  res.json({
    daily_created: dailyCreated.rows,
    avg_resolution_hours: avgResolution.rows[0]?.avg_hours || 0,
    escalations_by_level: escalationByLevel.rows,
    by_priority: byPriority.rows,
    by_status: byStatus.rows,
  });
});

export default router;
