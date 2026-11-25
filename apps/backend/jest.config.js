module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  testMatch: ['**/__tests__/**/*.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  roots: ['<rootDir>/src'],
};