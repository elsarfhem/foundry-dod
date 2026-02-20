/**
 * Dummy test to verify Vitest setup
 */

import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have global game object', () => {
    expect(global.game).toBeDefined();
    expect(global.game.user).toBeDefined();
  });

  it('should have mock cards pile', () => {
    const pile = Array.from(global.game.cards.values())[0];
    expect(pile).toBeDefined();
    expect(pile.name).toBe('Mazzo');
    expect(pile.availableCards.length).toBeGreaterThan(0);
  });

  it('should support flag operations', async () => {
    const pile = Array.from(global.game.cards.values())[0];
    await pile.setFlag('dod', 'test', { value: 123 });
    const result = pile.getFlag('dod', 'test');
    expect(result).toEqual({ value: 123 });
  });
});
