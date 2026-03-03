import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

// --- GET /api/agents/workload ---
router.get('/workload', authorize('agent_l1', 'agent_l2', 'agent_l3', 'admin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const result = await query(
    `SELECT
       u.id, u.name, u.role,
       COUNT(t.id) FILTER (WHERE t.status IN ('open','in_progress') AND t.deleted_at IS NULL) AS total_open,
       COUNT(t.id) FILTER (WHERE t.priority = 'Critical' AND t.status IN ('open','in_progress') AND t.deleted_at IS NULL) AS critical,
       COUNT(t.id) FILTER (WHERE t.priority = 'High' AND t.status IN ('open','in_progress') AND t.deleted_at IS NULL) AS high,
       COUNT(t.id) FILTER (WHERE t.priority = 'Medium' AND t.status IN ('open','in_progress') AND t.deleted_at IS NULL) AS medium,
       COUNT(t.id) FILTER (WHERE t.priority = 'Low' AND t.status IN ('open','in_progress') AND t.deleted_at IS NULL) AS low
     FROM users u
     LEFT JOIN tickets t ON t.assigned_to = u.id
     WHERE u.role IN ('agent_l1','agent_l2','agent_l3') AND u.is_active = true
     GROUP BY u.id, u.name, u.role
     ORDER BY total_open DESC`
  );
  res.json({ workload: result.rows });
});

export default router;
