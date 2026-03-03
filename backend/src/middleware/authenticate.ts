import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getRedisClient } from '../config/redis';
import { query } from '../db/connection';
import { JwtPayload, AuthRequest, User } from '../types';

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET as string
    ) as JwtPayload;

    // Check blacklist in Redis
    const redis = getRedisClient();
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      res.status(401).json({ error: 'Token has been invalidated' });
      return;
    }

    // Load user from DB (check is_active)
    const result = await query<User>(
      `SELECT id, email, role, name, is_active, created_at FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!result.rows.length) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];
    if (!user.is_active) {
      res.status(403).json({ error: 'Account deactivated' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      next(err);
    }
  }
}
