// Test environment setup — mock external dependencies
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-that-is-long-enough';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-that-is-long-enough';
process.env.NODE_ENV = 'test';
