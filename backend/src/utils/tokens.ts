import jwt from 'jsonwebtoken';
import { getRedisClient } from '../config/redis';
import { JwtPayload, UserRole } from '../types';

export function generateAccessToken(userId: string, role: UserRole, email: string): string {
  return jwt.sign(
    { userId, role, email },
    process.env.JWT_ACCESS_SECRET as string,
    { expiresIn: (process.env.JWT_ACCESS_EXPIRY || '15m') as jwt.SignOptions['expiresIn'] }
  );
}

export function generateRefreshToken(userId: string, role: UserRole, email: string): string {
  return jwt.sign(
    { userId, role, email },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as jwt.SignOptions['expiresIn'] }
  );
}

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const redis = getRedisClient();
  const ttl = 7 * 24 * 60 * 60; // 7 days in seconds
  await redis.set(`refresh:${userId}`, token, { EX: ttl });
}

export async function validateRefreshToken(userId: string, token: string): Promise<boolean> {
  const redis = getRedisClient();
  const stored = await redis.get(`refresh:${userId}`);
  return stored === token;
}

export async function deleteRefreshToken(userId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`refresh:${userId}`);
}

export async function blacklistAccessToken(token: string): Promise<void> {
  const redis = getRedisClient();
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redis.set(`blacklist:${token}`, '1', { EX: ttl });
      }
    }
  } catch {
    // If decode fails, set with 15 min TTL
    await redis.set(`blacklist:${token}`, '1', { EX: 900 });
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as JwtPayload;
}
