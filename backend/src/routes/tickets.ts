import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AuthRequest, Ticket, TicketPriority, TicketStatus } from '../types';
import { determinePriority } from '../utils/priority';
import { autoAssignAgent } from '../utils/assignment';
import { auditLog } from '../utils/auditLog';
import { getPagination, paginate } from '../utils/pagination';
import { ticketQueue, emailQueue } from '../queues';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All ticket routes require authentication
router.use(authenticate);

const VALID_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];
const VALID_STATUSES: TicketStatus[] = ['open', 'in_progress', 'escalated', 'resolved', 'closed', 'deleted'];

const createTicketSchema = z.object({
  subject: z.string().min(5).max(500),
  order_id: z.string().optional(),
  issue_type: z.string().min(2).max(100),
  description: z.string().min(10).max(5000),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
});

const updateTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'escalated', 'resolved', 'closed', 'deleted']).optional(),
  assigned_to: z.string().uuid().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' });

const messageSchema = z.object({
  message: z.string().min(1).max(10000),
  is_internal: z.boolean().optional().default(false),
});

const escalateSchema = z.object({
  reason: z.string().min(5).max(1000),
});

// --- POST /api/tickets ---
router.post('/', authorize('customer'), upload.single('attachment'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { order_id, issue_type, description, subject } = parsed.data;

  // Validate order belongs to customer if provided
  if (order_id) {
    const orderCheck = await query(
      'SELECT id FROM orders WHERE id = $1 AND user_id = $2',
      [order_id, req.user!.id]
    );
    if (!orderCheck.rows.length) {
      res.status(400).json({ error: 'Order not found or does not belong to your account' });
      return;
    }
  }

  // Auto-determine priority
  const { priority } = determinePriority(description, issue_type);

  // Auto-assign agent
  const assignedTo = await autoAssignAgent(priority, issue_type);

  const ticketId = uuidv4();
  const escalationLevel = (priority === 'High' || priority === 'Critical' || issue_type.toLowerCase() === 'payment') ? 2 : 1;

  await query(
    `INSERT INTO tickets (id, user_id, order_id, subject, issue_type, priority, status, description, assigned_to, escalation_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [ticketId, req.user!.id, order_id || null, subject, issue_type, priority, 'open', description, assignedTo, escalationLevel]
  );

  // Audit log
  await auditLog('ticket_create', req.user!.id, ticketId, null,
    { ticketId, priority, issue_type, assigned_to: assignedTo }, req.ip || null);

  // Queue: classification + email
  await ticketQueue.add('classify', { ticketId, description, issue_type });
  await emailQueue.add('ticket_created', { ticketId, userId: req.user!.id });
  if (assignedTo) {
    await emailQueue.add('ticket_assigned', { ticketId, agentId: assignedTo });
  }

  const result = await query<Ticket>('SELECT * FROM tickets WHERE id = $1', [ticketId]);

  // Fetch linked order + payment info if order_id provided
  let order = null;
  let payment = null;
  if (order_id) {
    const orderRes = await query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (orderRes.rows.length) {
      order = orderRes.rows[0];
      const payRes = await query('SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1', [order_id]);
      payment = payRes.rows[0] || null;
    }
  }

  res.status(201).json({ message: 'Ticket created', ticket: result.rows[0], order, payment });
});

// --- GET /api/tickets ---
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, priority, date_from, date_to, order_id, search } = req.query as Record<string, string>;
  const { page, limit, offset } = getPagination(req.query as Record<string, string>);

  const user = req.user!;
  const conditions: string[] = ['t.deleted_at IS NULL'];
  const params: unknown[] = [];
  let idx = 1;

  // Role-based filtering
  if (user.role === 'customer') {
    conditions.push(`t.user_id = $${idx++}`);
    params.push(user.id);
  } else if (user.role === 'agent_l1' || user.role === 'agent_l2' || user.role === 'agent_l3') {
    conditions.push(`t.assigned_to = $${idx++}`);
    params.push(user.id);
  }
  // admin sees all

  if (status && VALID_STATUSES.includes(status as TicketStatus)) {
    conditions.push(`t.status = $${idx++}`);
    params.push(status);
  }
  if (priority && VALID_PRIORITIES.includes(priority as TicketPriority)) {
    conditions.push(`t.priority = $${idx++}`);
    params.push(priority);
  }
  if (date_from) {
    conditions.push(`t.created_at >= $${idx++}`);
    params.push(date_from);
  }
  if (date_to) {
    conditions.push(`t.created_at <= $${idx++}`);
    params.push(date_to);
  }
  if (order_id) {
    conditions.push(`t.order_id = $${idx++}`);
    params.push(order_id);
  }
  if (search) {
    conditions.push(`(t.subject ILIKE $${idx} OR t.description ILIKE $${idx} OR u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM tickets t
     LEFT JOIN users u ON t.user_id = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const ticketResult = await query<Ticket & { customer_name: string; customer_email: string; assigned_to_name: string }>(    `SELECT t.*, u.name AS customer_name, u.email AS customer_email, a.name AS assigned_to_name
     FROM tickets t
     LEFT JOIN users u ON t.user_id = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...params, limit, offset]
  );

  res.json(paginate(ticketResult.rows, total, page, limit));
});

// --- GET /api/tickets/:id ---
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const result = await query<Ticket>(
    `SELECT t.*, u.name AS customer_name, u.email AS customer_email, a.name AS assigned_to_name
     FROM tickets t
     LEFT JOIN users u ON t.user_id = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [req.params.id]
  );

  if (!result.rows.length) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const ticket = result.rows[0];

  // Customers can only see own tickets
  if (user.role === 'customer' && ticket.user_id !== user.id) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Fetch linked order + payment
  let order = null;
  let payment = null;
  if (ticket.order_id) {
    const orderRes = await query('SELECT * FROM orders WHERE id = $1', [ticket.order_id]);
    if (orderRes.rows.length) {
      order = orderRes.rows[0];
      const payRes = await query('SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1', [ticket.order_id]);
      payment = payRes.rows[0] || null;
    }
  }

  res.json({ ticket, order, payment });
});

// --- PATCH /api/tickets/:id ---
router.patch('/:id', authorize('agent_l1', 'agent_l2', 'agent_l3', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = updateTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const before = await query<Ticket>('SELECT * FROM tickets WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!before.rows.length) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const { status, assigned_to, priority } = parsed.data;
  if (status) { updates.push(`status = $${idx++}`); params.push(status); }
  if (assigned_to) { updates.push(`assigned_to = $${idx++}`); params.push(assigned_to); }
  if (priority) { updates.push(`priority = $${idx++}`); params.push(priority); }

  params.push(req.params.id);

  const afterResult = await query<Ticket>(
    `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  await auditLog('ticket_update', req.user!.id, req.params.id,
    before.rows[0] as unknown as Record<string, unknown>,
    afterResult.rows[0] as unknown as Record<string, unknown>,
    req.ip || null
  );

  res.json({ message: 'Ticket updated', ticket: afterResult.rows[0] });
});

// --- POST /api/tickets/:id/messages ---
router.post('/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = req.user!;
  const { message, is_internal } = parsed.data;

  // Verify ticket exists
  const ticketCheck = await query<Ticket>(
    'SELECT * FROM tickets WHERE id = $1 AND deleted_at IS NULL',
    [req.params.id]
  );
  if (!ticketCheck.rows.length) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  const ticket = ticketCheck.rows[0];

  // Customers can only message on own tickets, cannot post internal
  if (user.role === 'customer') {
    if (ticket.user_id !== user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    if (is_internal) {
      res.status(403).json({ error: 'Customers cannot post internal messages' });
      return;
    }
  }

  const msgId = uuidv4();
  const result = await query(
    'INSERT INTO ticket_messages (id, ticket_id, user_id, message, is_internal) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [msgId, req.params.id, user.id, message, is_internal || false]
  );

  res.status(201).json({ message: 'Message added', data: result.rows[0] });
});

// --- GET /api/tickets/:id/messages ---
router.get('/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;

  const ticketCheck = await query<Ticket>(
    'SELECT * FROM tickets WHERE id = $1 AND deleted_at IS NULL',
    [req.params.id]
  );
  if (!ticketCheck.rows.length) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  const ticket = ticketCheck.rows[0];

  if (user.role === 'customer' && ticket.user_id !== user.id) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const { page, limit, offset } = getPagination(req.query as Record<string, string>);

  let whereInternal = '';
  const params: unknown[] = [req.params.id];

  // Customers never see internal messages
  if (user.role === 'customer') {
    whereInternal = ' AND tm.is_internal = false';
  }

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = $1${whereInternal}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const messages = await query(
    `SELECT tm.*, u.name AS sender_name, u.role AS sender_role
     FROM ticket_messages tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.ticket_id = $1${whereInternal}
     ORDER BY tm.created_at ASC
     LIMIT $2 OFFSET $3`,
    [...params, limit, offset]
  );

  res.json(paginate(messages.rows, total, page, limit));
});

// --- POST /api/tickets/:id/escalate ---
router.post('/:id/escalate', authorize('agent_l1', 'agent_l2', 'agent_l3', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = escalateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const user = req.user!;
  const { reason } = parsed.data;

  const ticketResult = await query<Ticket>('SELECT * FROM tickets WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!ticketResult.rows.length) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const ticket = ticketResult.rows[0];
  const fromLevel = ticket.escalation_level;
  const toLevel = fromLevel + 1;

  if (toLevel > 3) {
    res.status(400).json({ error: 'Ticket already at maximum escalation level (L3)' });
    return;
  }

  // Determine target role for assignment
  const targetRole = toLevel === 2 ? 'agent_l2' : 'agent_l3';
  const newAgent = await query<{ id: string }>(
    `SELECT u.id FROM users u
     LEFT JOIN tickets t ON t.assigned_to = u.id AND t.status IN ('open','in_progress') AND t.deleted_at IS NULL
     WHERE u.role = $1 AND u.is_active = true
     GROUP BY u.id ORDER BY COUNT(t.id) ASC LIMIT 1`,
    [targetRole]
  );

  const newAssignedTo = newAgent.rows[0]?.id || ticket.assigned_to;

  // Update ticket
  await query(
    'UPDATE tickets SET escalation_level = $1, status = $2, assigned_to = $3 WHERE id = $4',
    [toLevel, 'escalated', newAssignedTo, ticket.id]
  );

  // Insert escalation history
  await query(
    'INSERT INTO escalation_history (id, ticket_id, from_level, to_level, reason, escalated_by) VALUES ($1, $2, $3, $4, $5, $6)',
    [uuidv4(), ticket.id, fromLevel, toLevel, reason, user.id]
  );

  await auditLog('ticket_escalate', user.id, ticket.id,
    { escalation_level: fromLevel, assigned_to: ticket.assigned_to } as Record<string, unknown>,
    { escalation_level: toLevel, assigned_to: newAssignedTo, reason } as Record<string, unknown>,
    req.ip || null
  );

  res.json({ message: `Ticket escalated from L${fromLevel} to L${toLevel}` });
});

// --- POST /api/tickets/:id/resolve ---
router.post('/:id/resolve', authorize('agent_l1', 'agent_l2', 'agent_l3', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const ticketResult = await query<Ticket>('SELECT * FROM tickets WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!ticketResult.rows.length) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const ticket = ticketResult.rows[0];
  await query("UPDATE tickets SET status = 'resolved' WHERE id = $1", [ticket.id]);

  await auditLog('ticket_resolve', req.user!.id, ticket.id,
    { status: ticket.status } as Record<string, unknown>,
    { status: 'resolved' } as Record<string, unknown>,
    req.ip || null
  );

  // Notify customer via email queue
  await emailQueue.add('ticket_resolved', { ticketId: ticket.id, userId: ticket.user_id });

  res.json({ message: 'Ticket resolved' });
});

// --- DELETE /api/tickets/:id (SOFT DELETE) ---
router.delete('/:id', authorize('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const ticketResult = await query<Ticket>('SELECT * FROM tickets WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!ticketResult.rows.length) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // SOFT DELETE — never actual row deletion
  await query("UPDATE tickets SET deleted_at = NOW(), status = 'deleted' WHERE id = $1", [req.params.id]);

  await auditLog('ticket_delete', req.user!.id, req.params.id,
    ticketResult.rows[0] as unknown as Record<string, unknown>,
    { deleted_at: new Date(), status: 'deleted' } as Record<string, unknown>,
    req.ip || null
  );

  res.json({ message: 'Ticket soft-deleted' });
});

// --- POST /api/tickets/:id/reassign ---
router.post('/:id/reassign', authorize('agent_l1', 'agent_l2', 'agent_l3', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ agent_id: z.string().uuid(), reason: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const ticketResult = await query<Ticket>('SELECT * FROM tickets WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!ticketResult.rows.length) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const ticket = ticketResult.rows[0];
  const agentCheck = await query('SELECT id, role FROM users WHERE id = $1 AND is_active = true', [parsed.data.agent_id]);
  if (!agentCheck.rows.length) {
    res.status(400).json({ error: 'Agent not found or inactive' });
    return;
  }

  await query('UPDATE tickets SET assigned_to = $1 WHERE id = $2', [parsed.data.agent_id, ticket.id]);

  await auditLog('ticket_reassign', req.user!.id, ticket.id,
    { assigned_to: ticket.assigned_to } as Record<string, unknown>,
    { assigned_to: parsed.data.agent_id, reason: parsed.data.reason } as Record<string, unknown>,
    req.ip || null
  );

  res.json({ message: 'Ticket reassigned' });
});

export default router;
