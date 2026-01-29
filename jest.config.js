module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/client/'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/index.js',
    '!server/migrate.js',
    '!server/stop.js',
    '!server/restamp-invoices.js'
  ],
  verbose: true
};
