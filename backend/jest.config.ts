import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/db/migrate.ts',
    '!src/db/seed.ts',
    '!src/index.ts',
    '!src/workers/**',
  ],
  coverageThreshold: {
    global: { lines: 60 },
  },
  setupFiles: ['./src/__tests__/setup.ts'],
};

export default config;
