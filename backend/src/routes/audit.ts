import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AuthRequest } from '../types';
import { auditLog } from '../utils/auditLog';
import { getPagination, paginate } from '../utils/pagination';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// --- GET /api/audit/tickets/:id ---
router.get('/tickets/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page, limit, offset } = getPagination(req.query as Record<string, string>);

  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) FROM audit_logs WHERE ticket_id = $1',
    [req.params.id]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT al.*, u.name AS user_name, u.role AS user_role
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.ticket_id = $1
     ORDER BY al.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.params.id, limit, offset]
  );

  res.json(paginate(result.rows, total, page, limit));
});

// --- GET /api/audit/users/:id ---
router.get('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page, limit, offset } = getPagination(req.query as Record<string, string>);

  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) FROM audit_logs WHERE user_id = $1',
    [req.params.id]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT al.*, t.issue_type AS ticket_issue_type
     FROM audit_logs al
     LEFT JOIN tickets t ON al.ticket_id = t.id
     WHERE al.user_id = $1
     ORDER BY al.created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.params.id, limit, offset]
  );

  res.json(paginate(result.rows, total, page, limit));
});

export default router;
