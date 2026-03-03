import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AuthRequest } from '../types';
import { getPagination, paginate } from '../utils/pagination';
import { getRedisClient } from '../config/redis';

const router = Router();
router.use(authenticate);

// --- GET /api/escalations ---
router.get('/', authorize('agent_l1', 'agent_l2', 'agent_l3', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { page, limit, offset } = getPagination(req.query as Record<string, string>);
  const { ticket_id } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (ticket_id) {
    conditions.push(`eh.ticket_id = $${idx++}`);
    params.push(ticket_id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(`SELECT COUNT(*) FROM escalation_history eh ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT eh.*, t.issue_type, t.priority, t.subject, u.name AS escalated_by_name
     FROM escalation_history eh
     JOIN tickets t ON eh.ticket_id = t.id
     LEFT JOIN users u ON eh.escalated_by = u.id
     ${where}
     ORDER BY eh.escalated_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...params, limit, offset]
  );

  res.json(paginate(result.rows, total, page, limit));
});

// --- POST /api/escalations/rules ---
const rulesSchema = z.object({
  l1_to_l2_hours: z.number().min(1).max(168).default(24),
  l2_to_l3_hours: z.number().min(1).max(168).default(48),
});

router.post('/rules', authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = rulesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const redis = getRedisClient();
  await redis.set('escalation_rules', JSON.stringify(parsed.data));

  res.json({ message: 'Escalation rules updated', rules: parsed.data });
});

router.get('/rules', authorize('agent_l1', 'agent_l2', 'agent_l3', 'admin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const redis = getRedisClient();
  const raw = await redis.get('escalation_rules');
  const rules = raw ? JSON.parse(raw) : { l1_to_l2_hours: 24, l2_to_l3_hours: 48 };
  res.json({ rules });
});

export default router;
