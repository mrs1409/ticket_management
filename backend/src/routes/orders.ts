import { Router, Response } from 'express';
import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

// --- GET /api/orders/:orderId ---
router.get('/:orderId', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const params: unknown[] = [req.params.orderId];

  let sql = `SELECT o.*, u.name AS customer_name FROM orders o
             JOIN users u ON o.user_id = u.id
             WHERE o.id = $1`;

  // Customers can only see own orders
  if (user.role === 'customer') {
    sql += ` AND o.user_id = $2`;
    params.push(user.id);
  }

  const result = await query(sql, params);
  if (!result.rows.length) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json({ order: result.rows[0] });
});

// --- GET /api/orders/:orderId/payments ---
router.get('/:orderId/payments', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;

  // Verify order access
  const orderCheck = await query(
    `SELECT id, user_id FROM orders WHERE id = $1`,
    [req.params.orderId]
  );
  if (!orderCheck.rows.length) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const order = orderCheck.rows[0] as { id: string; user_id: string };
  if (user.role === 'customer' && order.user_id !== user.id) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const payments = await query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC',
    [req.params.orderId]
  );
  res.json({ payments: payments.rows });
});

export default router;
