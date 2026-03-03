import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import { query } from '../db/connection';
import { authenticate } from '../middleware/authenticate';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  deleteRefreshToken,
  blacklistAccessToken,
  verifyRefreshToken,
} from '../utils/tokens';
import { auditLog } from '../utils/auditLog';
import { User, AuthRequest } from '../types';

const router = Router();

// Auth-specific rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Validation Schemas ---
const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// --- Google OAuth Setup ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/oauth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || '';
        const name = profile.displayName || '';

        let result = await query<User>('SELECT * FROM users WHERE oauth_id = $1 AND oauth_provider = $2', [
          profile.id,
          'google',
        ]);

        if (!result.rows.length) {
          // Check if user with same email
          result = await query<User>('SELECT * FROM users WHERE email = $1', [email]);
          if (result.rows.length) {
            // Link OAuth to existing account
            await query('UPDATE users SET oauth_id = $1, oauth_provider = $2 WHERE email = $3', [
              profile.id,
              'google',
              email,
            ]);
          } else {
            // Create new user
            await query(
              'INSERT INTO users (id, email, name, role, oauth_id, oauth_provider) VALUES ($1, $2, $3, $4, $5, $6)',
              [uuidv4(), email, name, 'customer', profile.id, 'google']
            );
          }
          result = await query<User>('SELECT * FROM users WHERE email = $1', [email]);
        }

        return done(null, result.rows[0]);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

// --- POST /api/auth/register ---
router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { name, email, password } = parsed.data;

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();

  await query(
    'INSERT INTO users (id, email, password_hash, role, name) VALUES ($1, $2, $3, $4, $5)',
    [userId, email, passwordHash, 'customer', name]
  );

  const accessToken = generateAccessToken(userId, 'customer', email);
  const refreshToken = generateRefreshToken(userId, 'customer', email);
  await storeRefreshToken(userId, refreshToken);

  await auditLog('user_register', userId, null, null, { email, name, role: 'customer' }, req.ip || null);

  res.status(201).json({
    message: 'Registration successful',
    user: { id: userId, email, name, role: 'customer' },
    accessToken,
    refreshToken,
  });
});

// --- POST /api/auth/login ---
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  const result = await query<User>(
    'SELECT id, email, password_hash, role, name, is_active FROM users WHERE email = $1',
    [email]
  );

  if (!result.rows.length) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const user = result.rows[0];

  if (!user.is_active) {
    res.status(403).json({ error: 'Account deactivated. Contact support.' });
    return;
  }

  if (!user.password_hash) {
    res.status(401).json({ error: 'Please use OAuth to login' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const accessToken = generateAccessToken(user.id, user.role, user.email);
  const refreshToken = generateRefreshToken(user.id, user.role, user.email);
  await storeRefreshToken(user.id, refreshToken);

  await auditLog('user_login', user.id, null, null, { email: user.email }, req.ip || null);

  res.json({
    message: 'Login successful',
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
  });
});

// --- Google OAuth routes ---
router.get(
  '/oauth/google',
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })
);

router.get(
  '/oauth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth_failed' }),
  async (req: AuthRequest, res: Response) => {
    const user = req.user as User;
    const accessToken = generateAccessToken(user.id, user.role, user.email);
    const refreshToken = generateRefreshToken(user.id, user.role, user.email);
    await storeRefreshToken(user.id, refreshToken);

    // Redirect to frontend with tokens in query (frontend should exchange immediately)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?access=${accessToken}&refresh=${refreshToken}`);
  }
);

// --- POST /api/auth/refresh ---
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const valid = await validateRefreshToken(decoded.userId, refreshToken);

    if (!valid) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const newAccessToken = generateAccessToken(decoded.userId, decoded.role, decoded.email);
    const newRefreshToken = generateRefreshToken(decoded.userId, decoded.role, decoded.email);
    await storeRefreshToken(decoded.userId, newRefreshToken);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// --- POST /api/auth/logout ---
router.post('/logout', authenticate, authLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const token = req.headers.authorization!.split(' ')[1];

  await blacklistAccessToken(token);
  await deleteRefreshToken(req.user!.id);

  await auditLog('user_logout', req.user!.id, null, null, { email: req.user!.email }, req.ip || null);

  res.json({ message: 'Logged out successfully' });
});

// --- GET /api/auth/me ---
router.get('/me', authenticate, (req: AuthRequest, res: Response): void => {
  res.json({ user: req.user });
});

export default router;
