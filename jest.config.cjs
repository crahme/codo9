// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

const customJestConfig = {
  moduleDirectories: ['node_modules', '<rootDir>/'],
  testEnvironment: 'jest-environment-jsdom',
  // Ignore Netlify's internal build output to prevent Haste module name collisions
  modulePathIgnorePatterns: ['<rootDir>/.netlify/'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.netlify/'],
  watchPathIgnorePatterns: ['<rootDir>/.netlify/'],
}

module.exports = createJestConfig(customJestConfig)
