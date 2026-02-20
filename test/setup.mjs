/**
 * Vitest global setup file
 * Runs before all tests to set up global mocks and utilities
 */

import { beforeEach, afterEach } from 'vitest';
import { createMockGame, setupGlobalMocks, teardownGlobalMocks } from './mocks/foundry.mjs';

// Set up fresh mocks before each test
beforeEach(() => {
  const game = createMockGame();
  setupGlobalMocks(game);
});

// Clean up after each test
afterEach(() => {
  teardownGlobalMocks();
});
