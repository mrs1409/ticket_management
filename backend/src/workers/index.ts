import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { connectDB, query } from '../db/connection';
import { connectRedis } from '../config/redis';
import { determinePriority } from '../utils/priority';
import { sendEmail, emailTemplates } from '../utils/email';
import { auditLog } from '../utils/auditLog';
import { getRedisClient } from '../config/redis';
import { redisConnection } from '../queues';
import { v4 as uuidv4 } from 'uuid';

// ---- Queue 1: Ticket Classification ----
const classificationWorker = new Worker(
  'ticket-classification',
  async (job: Job) => {
    const { ticketId, description, issue_type } = job.data as {
      ticketId: string;
      description: string;
      issue_type: string;
    };

    const { priority: newPriority } = determinePriority(description, issue_type);

    const current = await query<{ priority: string }>(
      'SELECT priority FROM tickets WHERE id = $1',
      [ticketId]
    );

    if (!current.rows.length) return;
    const oldPriority = current.rows[0].priority;

    if (oldPriority !== newPriority) {
      await query('UPDATE tickets SET priority = $1 WHERE id = $2', [newPriority, ticketId]);
      await auditLog('ticket_priority_auto_update', null, ticketId,
        { priority: oldPriority } as Record<string, unknown>,
        { priority: newPriority, reason: 'classification_job' } as Record<string, unknown>,
        null
      );
      console.log(`[ClassificationWorker] Ticket ${ticketId} priority updated: ${oldPriority} → ${newPriority}`);
    } else {
      console.log(`[ClassificationWorker] Ticket ${ticketId} priority confirmed: ${newPriority}`);
    }
  },
  { connection: redisConnection }
);

classificationWorker.on('completed', (job) => console.log(`[ClassificationWorker] Job ${job.id} completed`));
classificationWorker.on('failed', (job, err) => console.error(`[ClassificationWorker] Job ${job?.id} failed:`, err));

// ---- Queue 2: Auto-Escalation Cron ----
const escalationWorker = new Worker(
  'auto-escalation',
  async (_job: Job) => {
    console.log('[EscalationWorker] Running auto-escalation check...');

    const redis = getRedisClient();
    const rulesRaw = await redis.get('escalation_rules');
    const rules = rulesRaw ? JSON.parse(rulesRaw) : { l1_to_l2_hours: 24, l2_to_l3_hours: 48 };

    // L1 tickets unresolved > 24h
    const l1Tickets = await query(
      `SELECT * FROM tickets
       WHERE escalation_level = 1
         AND status IN ('open', 'in_progress')
         AND deleted_at IS NULL
         AND created_at < NOW() - INTERVAL '${rules.l1_to_l2_hours} hours'`
    );

    for (const ticket of l1Tickets.rows) {
      const t = ticket as { id: string; escalation_level: number; assigned_to: string; status: string };
      // Find L2 agent
      const l2Agent = await query<{ id: string }>(
        `SELECT u.id FROM users u
         LEFT JOIN tickets t2 ON t2.assigned_to = u.id AND t2.status IN ('open','in_progress') AND t2.deleted_at IS NULL
         WHERE u.role = 'agent_l2' AND u.is_active = true
         GROUP BY u.id ORDER BY COUNT(t2.id) ASC LIMIT 1`
      );
      const newAgent = l2Agent.rows[0]?.id || t.assigned_to;

      await query(
        "UPDATE tickets SET escalation_level = 2, status = 'escalated', assigned_to = $1 WHERE id = $2",
        [newAgent, t.id]
      );
      await query(
        'INSERT INTO escalation_history (id, ticket_id, from_level, to_level, reason, escalated_by) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), t.id, 1, 2, `Auto-escalated: unresolved after ${rules.l1_to_l2_hours}h`, null]
      );
      await auditLog('ticket_auto_escalate', null, t.id,
        { escalation_level: 1 } as Record<string, unknown>,
        { escalation_level: 2, reason: 'auto_24h' } as Record<string, unknown>,
        null
      );
      console.log(`[EscalationWorker] Ticket ${t.id} escalated L1→L2`);
    }

    // L2 tickets unresolved > 48h
    const l2Tickets = await query(
      `SELECT * FROM tickets
       WHERE escalation_level = 2
         AND status IN ('open', 'in_progress', 'escalated')
         AND deleted_at IS NULL
         AND created_at < NOW() - INTERVAL '${rules.l2_to_l3_hours} hours'`
    );

    for (const ticket of l2Tickets.rows) {
      const t = ticket as { id: string; escalation_level: number; assigned_to: string };
      const l3Agent = await query<{ id: string }>(
        `SELECT u.id FROM users u
         LEFT JOIN tickets t2 ON t2.assigned_to = u.id AND t2.status IN ('open','in_progress') AND t2.deleted_at IS NULL
         WHERE u.role = 'agent_l3' AND u.is_active = true
         GROUP BY u.id ORDER BY COUNT(t2.id) ASC LIMIT 1`
      );
      const newAgent = l3Agent.rows[0]?.id || t.assigned_to;

      await query(
        "UPDATE tickets SET escalation_level = 3, status = 'escalated', assigned_to = $1 WHERE id = $2",
        [newAgent, t.id]
      );
      await query(
        'INSERT INTO escalation_history (id, ticket_id, from_level, to_level, reason, escalated_by) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), t.id, 2, 3, `Auto-escalated: unresolved after ${rules.l2_to_l3_hours}h`, null]
      );
      await auditLog('ticket_auto_escalate', null, t.id,
        { escalation_level: 2 } as Record<string, unknown>,
        { escalation_level: 3, reason: 'auto_48h' } as Record<string, unknown>,
        null
      );
      console.log(`[EscalationWorker] Ticket ${t.id} escalated L2→L3`);
    }

    console.log(`[EscalationWorker] Done. Processed ${l1Tickets.rows.length} L1 + ${l2Tickets.rows.length} L2 tickets`);
  },
  { connection: redisConnection }
);

escalationWorker.on('failed', (job, err) => console.error(`[EscalationWorker] Job ${job?.id} failed:`, err));

// ---- Queue 3: Email Notifications ----
const emailWorker = new Worker(
  'email-notifications',
  async (job: Job) => {
    const { ticketId, userId, agentId } = job.data as {
      ticketId?: string;
      userId?: string;
      agentId?: string;
    };

    if (job.name === 'ticket_created' && ticketId && userId) {
      const userResult = await query<{ email: string; name: string }>(
        'SELECT email, name FROM users WHERE id = $1',
        [userId]
      );
      const ticketResult = await query<{ description: string }>(
        'SELECT description FROM tickets WHERE id = $1',
        [ticketId]
      );
      if (userResult.rows.length && ticketResult.rows.length) {
        const { subject, text } = emailTemplates.ticketCreated(
          userResult.rows[0].name,
          ticketId,
          ticketResult.rows[0].description.substring(0, 100)
        );
        await sendEmail(userResult.rows[0].email, subject, text);
      }
    } else if (job.name === 'ticket_assigned' && ticketId && agentId) {
      const agentResult = await query<{ email: string; name: string }>(
        'SELECT email, name FROM users WHERE id = $1',
        [agentId]
      );
      if (agentResult.rows.length) {
        const { subject, text } = emailTemplates.ticketAssigned(agentResult.rows[0].name, ticketId);
        await sendEmail(agentResult.rows[0].email, subject, text);
      }
    } else if (job.name === 'ticket_resolved' && ticketId && userId) {
      const userResult = await query<{ email: string; name: string }>(
        'SELECT email, name FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length) {
        const { subject, text } = emailTemplates.ticketResolved(userResult.rows[0].name, ticketId);
        await sendEmail(userResult.rows[0].email, subject, text);
      }
    }
  },
  { connection: redisConnection }
);

emailWorker.on('completed', (job) => console.log(`[EmailWorker] Job ${job.id} (${job.name}) completed`));
emailWorker.on('failed', (job, err) => console.error(`[EmailWorker] Job ${job?.id} failed:`, err));

// ---- Queue 4: Cleanup/Archive (Daily Cron) ----
const cleanupWorker = new Worker(
  'cleanup-archive',
  async (_job: Job) => {
    console.log('[CleanupWorker] Running daily cleanup...');

    const result = await query(
      `UPDATE tickets
       SET deleted_at = NOW(), status = 'deleted'
       WHERE status IN ('resolved', 'closed')
         AND deleted_at IS NULL
         AND updated_at < NOW() - INTERVAL '90 days'
       RETURNING id`
    );

    console.log(`[CleanupWorker] Archived ${result.rowCount} old resolved/closed tickets`);
  },
  { connection: redisConnection }
);

cleanupWorker.on('failed', (job, err) => console.error(`[CleanupWorker] Job ${job?.id} failed:`, err));

// ---- Startup: Schedule cron jobs ----
async function startWorkers() {
  await connectDB();
  await connectRedis();

  // Import here to avoid circular dependency issues
  const { escalationQueue, cleanupQueue } = await import('../queues');

  // Auto-escalation: every hour
  await escalationQueue.add(
    'check',
    {},
    {
      repeat: { pattern: '0 * * * *' },
      removeOnComplete: 10,
      removeOnFail: 20,
    }
  );

  // Cleanup: daily at 2am
  await cleanupQueue.add(
    'archive',
    {},
    {
      repeat: { pattern: '0 2 * * *' },
      removeOnComplete: 5,
      removeOnFail: 10,
    }
  );

  console.log('[Workers] All workers started. Cron jobs scheduled.');
  console.log('[Workers] - Auto-escalation: every hour');
  console.log('[Workers] - Cleanup archive: daily at 2am');
}

startWorkers().catch((err) => {
  console.error('[Workers] Fatal startup error:', err);
  process.exit(1);
});
