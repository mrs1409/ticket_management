import { Router, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { AuthRequest } from '../types';
import { ticketQueue, emailQueue, escalationQueue, cleanupQueue } from '../queues';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

const queues = [ticketQueue, emailQueue, escalationQueue, cleanupQueue];

function findQueue(name: string) {
  return queues.find((q) => q.name === name);
}

// --- GET /api/jobs/status/:jobId ---
router.get('/status/:jobId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { queueName } = req.query as { queueName: string };
  const q = queueName ? findQueue(queueName) : ticketQueue;

  if (!q) {
    res.status(400).json({ error: 'Queue not found' });
    return;
  }

  const job = await q.getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const state = await job.getState();
  res.json({
    jobId: job.id,
    name: job.name,
    state,
    data: job.data,
    progress: job.progress,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  });
});

// --- GET /api/jobs/failed ---
router.get('/failed', async (_req: AuthRequest, res: Response): Promise<void> => {
  const allFailed = await Promise.all(
    queues.map(async (q) => {
      const failed = await q.getFailed(0, 50);
      return failed.map((j) => ({
        queue: q.name,
        jobId: j.id,
        name: j.name,
        data: j.data,
        failedReason: j.failedReason,
        timestamp: j.timestamp,
      }));
    })
  );
  res.json({ failed: allFailed.flat() });
});

// --- POST /api/jobs/retry/:jobId ---
router.post('/retry/:jobId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { queueName } = req.body as { queueName: string };
  const q = queueName ? findQueue(queueName) : ticketQueue;

  if (!q) {
    res.status(400).json({ error: 'Queue not found. Provide queueName in body.' });
    return;
  }

  const job = await q.getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  await job.retry();
  res.json({ message: `Job ${req.params.jobId} queued for retry` });
});

export default router;
