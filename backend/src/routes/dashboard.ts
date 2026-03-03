import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

// --- GET /api/dashboard/customer ---
router.get('/customer', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'open') AS open,
       COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
       COUNT(*) FILTER (WHERE status = 'escalated') AS escalated,
       COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
       COUNT(*) FILTER (WHERE status = 'closed') AS closed,
       COUNT(*) AS total
     FROM tickets
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  res.json({ summary: result.rows[0] });
});

// --- GET /api/dashboard/agent ---
router.get('/agent', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.id;

  const summary = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('open','in_progress')) AS open_assigned,
       COUNT(*) FILTER (WHERE priority = 'Critical' AND status IN ('open','in_progress')) AS critical,
       COUNT(*) FILTER (WHERE priority = 'High' AND status IN ('open','in_progress')) AS high,
       COUNT(*) FILTER (WHERE priority = 'Medium' AND status IN ('open','in_progress')) AS medium,
       COUNT(*) FILTER (WHERE priority = 'Low' AND status IN ('open','in_progress')) AS low,
       COUNT(*) FILTER (WHERE status = 'resolved' AND DATE(updated_at) = CURRENT_DATE) AS resolved_today
     FROM tickets
     WHERE assigned_to = $1 AND deleted_at IS NULL`,
    [userId]
  );

  const recent = await query(
    `SELECT id, issue_type, priority, status, created_at, updated_at
     FROM tickets
     WHERE assigned_to = $1 AND status IN ('open','in_progress') AND deleted_at IS NULL
     ORDER BY
       CASE priority WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
       created_at ASC
     LIMIT 10`,
    [userId]
  );

  res.json({ summary: summary.rows[0], recent_tickets: recent.rows });
});

// --- GET /api/dashboard/admin ---
router.get('/admin', async (_req: AuthRequest, res: Response): Promise<void> => {
  const totals = await query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'open') AS open,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
      COUNT(*) FILTER (WHERE status = 'escalated') AS escalated,
      COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
      COUNT(*) FILTER (WHERE status = 'closed') AS closed
    FROM tickets WHERE deleted_at IS NULL
  `);

  const agentPerformance = await query(`
    SELECT
      u.id, u.name, u.role,
      COUNT(t.id) FILTER (WHERE t.status = 'resolved') AS resolved_total,
      COUNT(t.id) FILTER (WHERE t.status IN ('open','in_progress') AND t.deleted_at IS NULL) AS open_count,
      COUNT(t.id) FILTER (WHERE t.status = 'resolved' AND DATE(t.updated_at) = CURRENT_DATE) AS resolved_today
    FROM users u
    LEFT JOIN tickets t ON t.assigned_to = u.id
    WHERE u.role IN ('agent_l1','agent_l2','agent_l3')
    GROUP BY u.id, u.name, u.role
    ORDER BY resolved_total DESC
  `);

  const escalationRate = await query(`
    SELECT
      COUNT(DISTINCT ticket_id) AS escalated_tickets,
      (SELECT COUNT(*) FROM tickets WHERE deleted_at IS NULL) AS total_tickets
    FROM escalation_history
  `);

  res.json({
    totals: totals.rows[0],
    agent_performance: agentPerformance.rows,
    escalation_rate: escalationRate.rows[0],
  });
});

export default router;
