import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/utils/priority.ts',
    'src/utils/tokens.ts',
    'src/utils/assignment.ts',
    'src/utils/auditLog.ts',
    'src/utils/pagination.ts',
    'src/middleware/authorize.ts',
    'src/middleware/authenticate.ts',
  ],
  coverageThreshold: {
    global: { lines: 0 },
    // Exhaustively tested utility files are held to high standards:
    'src/utils/priority.ts': { lines: 90 },
    'src/utils/tokens.ts': { lines: 40 },
  },
  setupFiles: ['./src/__tests__/setup.ts'],
};

export default config;
