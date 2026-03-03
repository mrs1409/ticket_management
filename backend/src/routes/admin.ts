import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AuthRequest, User } from '../types';
import { auditLog } from '../utils/auditLog';
import { getPagination, paginate } from '../utils/pagination';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/admin/users
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  const { role, search } = req.query as Record<string, string>;
  const { page, limit, offset } = getPagination(req.query as Record<string, string>);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (role) { conditions.push(`role = $${idx++}`); params.push(role); }
  if (search) {
    conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(`SELECT COUNT(*) FROM users ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query<User>(
    `SELECT id, email, name, role, is_active, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    [...params, limit, offset]
  );

  res.json(paginate(result.rows, total, page, limit));
});

// PATCH /api/admin/users/:id
const updateUserSchema = z.object({
  role: z.enum(['customer', 'agent_l1', 'agent_l2', 'agent_l3', 'admin']).optional(),
  is_active: z.boolean().optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field required' });

router.patch('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const before = await query<User>('SELECT id, email, role, is_active FROM users WHERE id = $1', [req.params.id]);
  if (!before.rows.length) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const { role, is_active } = parsed.data;
  if (role !== undefined) { updates.push(`role = $${idx++}`); params.push(role); }
  if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active); }

  params.push(req.params.id);
  const afterResult = await query<User>(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, is_active`,
    params
  );

  await auditLog('user_update', req.user!.id, null,
    before.rows[0] as unknown as Record<string, unknown>,
    afterResult.rows[0] as unknown as Record<string, unknown>,
    req.ip || null
  );

  res.json({ message: 'User updated', user: afterResult.rows[0] });
});

export default router;
