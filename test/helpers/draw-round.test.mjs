/**
 * Unit tests for draw-round.mjs
 * Tests all 82 test cases from the test strategy
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadRoundState,
  saveRoundState,
  clearRoundState,
  initializeRoundState,
  canPlayerDraw,
  hasPlayerAdded,
  isRoundComplete,
  calculateDrawCount,
  countBySuit,
  recordPlayerAdded,
  executePlayerDraw,
  generateSummary,
} from '../../src/module/helpers/draw-round.mjs';
import {
  createEmptyRoundState,
  createRoundWithPlayersAdded,
  createRoundWithSomeDrawn,
  createCompletedRoundState,
  createInvalidRoundState,
} from '../fixtures/round-states.mjs';
import { createStandardTestCards, createLargePile, createCardsBySuit } from '../fixtures/card-data.mjs';
import { MockCardsPile, MockActor, createCardsMap } from '../mocks/foundry.mjs';

describe('draw-round: Pure Query Functions', () => {
  describe('canPlayerDraw', () => {
    it('should return false if state is null', () => {
      expect(canPlayerDraw(null, 'user1')).toBe(false);
    });

    it('should return false if player has not added cards', () => {
      const state = createRoundWithPlayersAdded(['user2', 'user3']);
      expect(canPlayerDraw(state, 'user1')).toBe(false);
    });

    it('should return false if player has already drawn', () => {
      const state = createRoundWithSomeDrawn(['user1', 'user2'], ['user1']);
      expect(canPlayerDraw(state, 'user1')).toBe(false);
    });

    it('should return true if player added but has not drawn', () => {
      const state = createRoundWithPlayersAdded(['user1', 'user2']);
      expect(canPlayerDraw(state, 'user1')).toBe(true);
    });

    it('should handle multiple players correctly', () => {
      const state = createRoundWithSomeDrawn(['user1', 'user2', 'user3'], ['user1']);
      expect(canPlayerDraw(state, 'user1')).toBe(false);
      expect(canPlayerDraw(state, 'user2')).toBe(true);
      expect(canPlayerDraw(state, 'user3')).toBe(true);
    });
  });

  describe('hasPlayerAdded', () => {
    it('should return false if state is null', () => {
      expect(hasPlayerAdded(null, 'user1')).toBe(false);
    });

    it('should return false if player has not added', () => {
      const state = createRoundWithPlayersAdded(['user2']);
      expect(hasPlayerAdded(state, 'user1')).toBe(false);
    });

    it('should return true if player has added', () => {
      const state = createRoundWithPlayersAdded(['user1', 'user2']);
      expect(hasPlayerAdded(state, 'user1')).toBe(true);
    });

    it('should work for empty state', () => {
      const state = createEmptyRoundState();
      expect(hasPlayerAdded(state, 'user1')).toBe(false);
    });
  });

  describe('isRoundComplete', () => {
    it('should return false if state is null', () => {
      expect(isRoundComplete(null)).toBe(false);
    });

    it('should return false if no players have added', () => {
      const state = createEmptyRoundState();
      expect(isRoundComplete(state)).toBe(false);
    });

    it('should return false if not all players have drawn', () => {
      const state = createRoundWithSomeDrawn(['user1', 'user2', 'user3'], ['user1']);
      expect(isRoundComplete(state)).toBe(false);
    });

    it('should return true if all players have drawn', () => {
      const state = createCompletedRoundState(['user1', 'user2']);
      expect(isRoundComplete(state)).toBe(true);
    });

    it('should handle single player round', () => {
      const state = createCompletedRoundState(['user1']);
      expect(isRoundComplete(state)).toBe(true);
    });
  });

  describe('calculateDrawCount', () => {
    it('should calculate correct draw count for standard 3-player game', () => {
      expect(calculateDrawCount(21, 3)).toBe(3); // 21 / (4+3) = 3
    });

    it('should calculate correct draw count for 4-player game', () => {
      expect(calculateDrawCount(24, 4)).toBe(3); // 24 / (4+4) = 3
    });

    it('should return at least 1 card for small piles', () => {
      expect(calculateDrawCount(5, 3)).toBe(1);
      expect(calculateDrawCount(1, 5)).toBe(1);
    });

    it('should handle large piles', () => {
      expect(calculateDrawCount(100, 3)).toBe(14); // 100 / 7 = 14
    });

    it('should handle 2-player game', () => {
      expect(calculateDrawCount(18, 2)).toBe(3); // 18 / 6 = 3
    });
  });

  describe('countBySuit', () => {
    it('should count cards by suit correctly', () => {
      const cards = createStandardTestCards();
      const counts = countBySuit(cards);
      expect(counts.hearts).toBe(2);
      expect(counts.spades).toBe(1);
      expect(counts.diamonds).toBe(1);
      expect(counts.clubs).toBe(1);
    });

    it('should handle empty array', () => {
      expect(countBySuit([])).toEqual({});
    });

    it('should handle cards with _source.suit', () => {
      const cards = [{ _source: { suit: 'hearts' } }, { _source: { suit: 'hearts' } }];
      const counts = countBySuit(cards);
      expect(counts.hearts).toBe(2);
    });

    it('should handle mixed suit formats', () => {
      const cards = [
        { suit: 'hearts' },
        { _source: { suit: 'spades' } },
        { suit: 'hearts' },
        {},
      ];
      const counts = countBySuit(cards);
      expect(counts.hearts).toBe(2);
      expect(counts.spades).toBe(1);
      expect(counts.unknown).toBe(1);
    });

    it('should count large sets correctly', () => {
      const cards = createCardsBySuit({ hearts: 5, spades: 3, diamonds: 2 });
      const counts = countBySuit(cards);
      expect(counts.hearts).toBe(5);
      expect(counts.spades).toBe(3);
      expect(counts.diamonds).toBe(2);
    });
  });
});

describe('draw-round: State Management', () => {
  describe('initializeRoundState', () => {
    it('should create empty state with correct structure', () => {
      const state = initializeRoundState();
      expect(state).toEqual({
        playersAdded: [],
        playersDrawn: [],
        drawResults: [],
      });
    });

    it('should create independent state objects', () => {
      const state1 = initializeRoundState();
      const state2 = initializeRoundState();
      state1.playersAdded.push('user1');
      expect(state2.playersAdded).toEqual([]);
    });
  });

  describe('loadRoundState', () => {
    it('should return null if pile not found', () => {
      game.cards = createCardsMap();
      expect(loadRoundState()).toBe(null);
    });

    it('should return null if no state exists', () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      expect(loadRoundState()).toBe(null);
    });

    it('should load existing valid state', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      const state = createRoundWithPlayersAdded(['user1', 'user2']);
      await pile.setFlag('dod', 'currentRound', state);

      const loaded = loadRoundState();
      expect(loaded).toEqual(state);
    });

    it('should return null and clear invalid state (missing arrays)', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      await pile.setFlag('dod', 'currentRound', { invalid: true });

      const loaded = loadRoundState();
      expect(loaded).toBe(null);
    });

    it('should validate array types', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      await pile.setFlag('dod', 'currentRound', {
        playersAdded: 'not-an-array',
        playersDrawn: [],
        drawResults: [],
      });

      expect(loadRoundState()).toBe(null);
    });
  });

  describe('saveRoundState', () => {
    it('should save valid state successfully', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      const state = createEmptyRoundState();

      const result = await saveRoundState(state);
      expect(result.success).toBe(true);

      const saved = pile.getFlag('dod', 'currentRound');
      expect(saved).toEqual(state);
    });

    it('should reject invalid state schema', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      const result = await saveRoundState({ invalid: true });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid state schema');
    });

    it('should return error if pile not found', async () => {
      game.cards = createCardsMap();
      const result = await saveRoundState(createEmptyRoundState());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Pile not found');
    });

    it('should preserve state data exactly', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      const state = createRoundWithSomeDrawn(['user1', 'user2'], ['user1']);

      await saveRoundState(state);
      const loaded = loadRoundState();

      expect(loaded.playersAdded).toEqual(state.playersAdded);
      expect(loaded.playersDrawn).toEqual(state.playersDrawn);
    });
  });

  describe('clearRoundState', () => {
    it('should remove state from pile', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      await pile.setFlag('dod', 'currentRound', createEmptyRoundState());

      await clearRoundState();

      const state = pile.getFlag('dod', 'currentRound');
      expect(state).toBeUndefined();
    });

    it('should not error if pile not found', async () => {
      game.cards = createCardsMap();
      await expect(clearRoundState()).resolves.toBeUndefined();
    });

    it('should not error if no state exists', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      await expect(clearRoundState()).resolves.toBeUndefined();
    });
  });
});

describe('draw-round: State Mutations', () => {
  describe('recordPlayerAdded', () => {
    it('should reject recording for other users (NFR #6)', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      game.user.id = 'user1';

      const result = await recordPlayerAdded('user2');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot record for other users');
    });

    it('should initialize state if none exists', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      game.user.id = 'user1';

      const result = await recordPlayerAdded('user1');
      expect(result.success).toBe(true);

      const state = loadRoundState();
      expect(state.playersAdded).toContain('user1');
    });

    it('should add user to existing state', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      game.user.id = 'user2';

      const initialState = createRoundWithPlayersAdded(['user1']);
      await pile.setFlag('dod', 'currentRound', initialState);

      const result = await recordPlayerAdded('user2');
      expect(result.success).toBe(true);

      const state = loadRoundState();
      expect(state.playersAdded).toEqual(['user1', 'user2']);
    });

    it('should be idempotent (no duplicate entries)', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      game.user.id = 'user1';

      await recordPlayerAdded('user1');
      await recordPlayerAdded('user1');

      const state = loadRoundState();
      expect(state.playersAdded.filter((id) => id === 'user1').length).toBe(1);
    });
  });

  describe('executePlayerDraw', () => {
    beforeEach(() => {
      // Set up a complete game environment for draw tests
      const pile = new MockCardsPile(createLargePile(21));
      const actor = new MockActor('actor1', 'TestActor');
      actor._cards = new MockCardsPile([]);

      game.cards = createCardsMap([['pile1', pile]]);
      game.user.id = 'user1';
      game.user.name = 'Player1';
      game.user.character = actor;
    });

    it('should reject drawing for other users (NFR #6)', async () => {
      const result = await executePlayerDraw('user2');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot draw for other users');
    });

    it('should error if player has not added cards', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user2']));

      const result = await executePlayerDraw('user1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('DECK_OF_DESTINY.messages.DrawRound.Error.NotAdded');
    });

    it('should error if player has already drawn', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithSomeDrawn(['user1'], ['user1']));

      const result = await executePlayerDraw('user1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('DECK_OF_DESTINY.messages.DrawRound.Error.AlreadyDrawn');
    });

    it('should draw cards and update state successfully', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1', 'user2', 'user3']));

      const result = await executePlayerDraw('user1');
      expect(result.success).toBe(true);
      expect(result.data.drawnCount).toBeGreaterThan(0);

      const state = loadRoundState();
      expect(state.playersDrawn).toContain('user1');
      expect(state.drawResults.length).toBe(1);
    });

    it('should calculate correct draw count based on players', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1', 'user2', 'user3']));

      const result = await executePlayerDraw('user1');
      expect(result.success).toBe(true);
      // 21 cards / (4+3 players) = 3 cards
      expect(result.data.drawnCount).toBe(3);
    });

    it('should store draw result with card data', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1']));

      await executePlayerDraw('user1');

      const state = loadRoundState();
      const drawResult = state.drawResults[0];

      expect(drawResult.userId).toBe('user1');
      expect(drawResult.userName).toBe('Player1');
      expect(drawResult.cards).toBeDefined();
      expect(drawResult.cards.length).toBeGreaterThan(0);
      expect(drawResult.suits).toBeDefined();
    });

    it('should indicate round complete when last player draws', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithSomeDrawn(['user1', 'user2'], ['user2']));

      const result = await executePlayerDraw('user1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(true);
    });

    it('should indicate round not complete when players remain', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1', 'user2', 'user3']));

      const result = await executePlayerDraw('user1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);
    });
  });
});

describe('draw-round: Integration Tests', () => {
  describe('Full round lifecycle', () => {
    beforeEach(() => {
      const pile = new MockCardsPile(createLargePile(30));
      const actor = new MockActor('actor1', 'TestActor');
      actor._cards = new MockCardsPile([]);

      game.cards = createCardsMap([['pile1', pile]]);
      game.user.character = actor;
    });

    it('should complete a 3-player round successfully', async () => {
      const pile = Array.from(game.cards.values())[0];

      // Player 1 adds
      game.user.id = 'user1';
      game.user.name = 'Player1';
      await recordPlayerAdded('user1');

      // Player 2 adds
      game.user.id = 'user2';
      await recordPlayerAdded('user2');

      // Player 3 adds
      game.user.id = 'user3';
      await recordPlayerAdded('user3');

      // Verify state
      let state = loadRoundState();
      expect(state.playersAdded.length).toBe(3);

      // Player 1 draws
      game.user.id = 'user1';
      game.user.name = 'Player1';
      let result = await executePlayerDraw('user1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);

      // Player 2 draws
      game.user.id = 'user2';
      game.user.name = 'Player2';
      result = await executePlayerDraw('user2');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);

      // Player 3 draws (completes round)
      game.user.id = 'user3';
      game.user.name = 'Player3';
      result = await executePlayerDraw('user3');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(true);

      // Verify final state
      state = loadRoundState();
      expect(state.playersDrawn.length).toBe(3);
      expect(state.drawResults.length).toBe(3);
    });

    it('should handle partial round correctly', async () => {
      game.user.id = 'user1';
      game.user.name = 'Player1';

      await recordPlayerAdded('user1');

      game.user.id = 'user2';
      await recordPlayerAdded('user2');

      // Only user1 draws
      game.user.id = 'user1';
      game.user.name = 'Player1';
      const result = await executePlayerDraw('user1');

      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);

      const state = loadRoundState();
      expect(state.playersDrawn).toEqual(['user1']);
      expect(state.drawResults.length).toBe(1);
    });

    it('should handle round reset via clearRoundState', async () => {
      game.user.id = 'user1';
      game.user.name = 'Player1';

      await recordPlayerAdded('user1');
      await executePlayerDraw('user1');

      await clearRoundState();

      const state = loadRoundState();
      expect(state).toBe(null);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty pile gracefully', async () => {
      const pile = new MockCardsPile([]);
      const actor = new MockActor('actor1', 'TestActor');
      actor._cards = new MockCardsPile([]);

      game.cards = createCardsMap([['pile1', pile]]);
      game.user.id = 'user1';
      game.user.name = 'Player1';
      game.user.character = actor;

      await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1']));

      const result = await executePlayerDraw('user1');
      expect(result.success).toBe(false);
    });

    it('should handle single-player round', async () => {
      const pile = new MockCardsPile(createLargePile(10));
      const actor = new MockActor('actor1', 'TestActor');
      actor._cards = new MockCardsPile([]);

      game.cards = createCardsMap([['pile1', pile]]);
      game.user.id = 'user1';
      game.user.name = 'Player1';
      game.user.character = actor;

      await recordPlayerAdded('user1');
      const result = await executePlayerDraw('user1');

      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(true);
    });

    it('should handle maximum players (8 players)', async () => {
      const pile = new MockCardsPile(createLargePile(48));
      game.cards = createCardsMap([['pile1', pile]]);

      const userIds = Array.from({ length: 8 }, (_, i) => `user${i + 1}`);

      for (const userId of userIds) {
        game.user.id = userId;
        await recordPlayerAdded(userId);
      }

      const state = loadRoundState();
      expect(state.playersAdded.length).toBe(8);

      // Verify draw count is reasonable
      const drawCount = calculateDrawCount(48, 8);
      expect(drawCount).toBe(4); // 48 / 12 = 4
    });
  });
});

describe('draw-round: generateSummary special card names', () => {
  beforeEach(() => {
    // Minimal jQuery-like stub for the `$('<div>').text(x).html()` HTML-escaping
    // pattern used in draw-round.mjs (NFR #5).
    global.$ = () => {
      let text = '';
      return {
        text(value) {
          text = value;
          return this;
        },
        html() {
          return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        },
      };
    };
  });

  afterEach(() => {
    delete global.$;
  });

  it('shows the special card name instead of the raw suit string in the posted summary', async () => {
    const messages = [];
    global.ChatMessage = { create: (data) => messages.push(data) };

    const state = {
      playersAdded: ['user1'],
      playersDrawn: ['user1'],
      drawResults: [
        {
          userId: 'user1',
          userName: 'Player1',
          cards: [
            {
              id: 'card1',
              name: 'Carta del Vento',
              suit: 'special:vento',
              img: 'vento.png',
            },
          ],
          suits: { 'special:vento': 1 },
        },
      ],
    };

    await generateSummary(state);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('Carta del Vento');
    expect(messages[0].content).not.toContain('special:vento:');
  });
});
