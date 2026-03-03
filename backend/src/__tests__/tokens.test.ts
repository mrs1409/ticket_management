import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/tokens';
import type { JwtPayload } from '../types';

// Mock Redis so tests don't need a live connection
jest.mock('../config/redis', () => ({
  getRedisClient: () => ({
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

const TEST_USER = { userId: 'test-uuid-1234', role: 'customer' as const, email: 'test@example.com' };

describe('generateAccessToken()', () => {
  test('returns a signed JWT string', () => {
    const token = generateAccessToken(TEST_USER.userId, TEST_USER.role, TEST_USER.email);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // valid JWT has 3 parts
  });

  test('payload contains correct userId, role, email', () => {
    const token = generateAccessToken(TEST_USER.userId, TEST_USER.role, TEST_USER.email);
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
    expect(decoded.userId).toBe(TEST_USER.userId);
    expect(decoded.role).toBe(TEST_USER.role);
    expect(decoded.email).toBe(TEST_USER.email);
  });

  test('expires in 15 minutes (≤ 900 seconds from now)', () => {
    const token = generateAccessToken(TEST_USER.userId, TEST_USER.role, TEST_USER.email);
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
    expect(decoded.exp).toBeDefined();
    const secondsLeft = (decoded.exp! - Math.floor(Date.now() / 1000));
    expect(secondsLeft).toBeGreaterThan(0);
    expect(secondsLeft).toBeLessThanOrEqual(900);
  });
});

describe('generateRefreshToken()', () => {
  test('returns a signed JWT string', () => {
    const token = generateRefreshToken(TEST_USER.userId, TEST_USER.role, TEST_USER.email);
    expect(typeof token).toBe('string');
  });

  test('payload contains correct fields', () => {
    const token = generateRefreshToken(TEST_USER.userId, TEST_USER.role, TEST_USER.email);
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
    expect(decoded.userId).toBe(TEST_USER.userId);
    expect(decoded.role).toBe(TEST_USER.role);
  });

  test('has longer expiry than access token', () => {
    const access = generateAccessToken(TEST_USER.userId, TEST_USER.role, TEST_USER.email);
    const refresh = generateRefreshToken(TEST_USER.userId, TEST_USER.role, TEST_USER.email);
    const decodedAccess = jwt.verify(access, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
    const decodedRefresh = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
    expect(decodedRefresh.exp!).toBeGreaterThan(decodedAccess.exp!);
  });
});

describe('verifyRefreshToken()', () => {
  test('successfully verifies a valid refresh token', () => {
    const token = generateRefreshToken(TEST_USER.userId, TEST_USER.role, TEST_USER.email);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(TEST_USER.userId);
  });

  test('throws for tampered token', () => {
    const token = generateRefreshToken(TEST_USER.userId, TEST_USER.role, TEST_USER.email);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyRefreshToken(tampered)).toThrow();
  });

  test('throws for token signed with wrong secret', () => {
    const wrongToken = jwt.sign({ userId: 'x' }, 'wrong-secret');
    expect(() => verifyRefreshToken(wrongToken)).toThrow();
  });
});
