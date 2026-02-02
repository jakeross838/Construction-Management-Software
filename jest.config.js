/**
 * Jest Configuration for Server Tests
 *
 * Focuses on testing business logic with mocked database calls.
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/server/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/client/'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/server/setup.js'
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/client/'
  ],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/index.js',
    '!server/scripts/**',
    '!server/documents/restamp.js'
  ],
  coverageDirectory: 'coverage/server',
  testTimeout: 10000,
  verbose: true
};
