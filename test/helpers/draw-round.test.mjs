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
  generateSummary
} from '../../src/module/helpers/draw-round.mjs';
import {
  createEmptyRoundState,
  createRoundWithPlayersAdded,
  createRoundWithSomeDrawn,
  createCompletedRoundState,
  createInvalidRoundState
} from '../fixtures/round-states.mjs';
import {
  createStandardTestCards,
  createLargePile,
  createCardsBySuit
} from '../fixtures/card-data.mjs';
import {
  MockCardsPile,
  MockActor,
  createCardsMap,
  createHandPile
} from '../mocks/foundry.mjs';
import { withCardLock } from '../../src/module/globals.mjs';

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
    // calculateDrawCount(pileSize, playerCount, playerIndex) returns ONE
    // player's share of the round's total draw (see draw-round.mjs). Total
    // for the round = max(playerCount, floor(pileSize / (4 + playerCount))),
    // split evenly with the first `total % playerCount` players getting one
    // extra card.
    it('should split an evenly-divisible total equally for a 3-player game', () => {
      // total = max(3, floor(21/7)) = 3; base = 1, extra = 0
      expect(calculateDrawCount(21, 3, 0)).toBe(1);
      expect(calculateDrawCount(21, 3, 1)).toBe(1);
      expect(calculateDrawCount(21, 3, 2)).toBe(1);
    });

    it('should split an evenly-divisible total equally for a 4-player game', () => {
      // total = max(4, floor(24/8)) = 4; base = 1, extra = 0
      expect(calculateDrawCount(24, 4, 0)).toBe(1);
      expect(calculateDrawCount(24, 4, 3)).toBe(1);
    });

    it('should return at least 1 card per player for small piles', () => {
      // total = max(3, floor(5/7)) = max(3, 1) = 3; base = 1, extra = 0
      expect(calculateDrawCount(5, 3, 0)).toBe(1);
      // total = max(5, floor(1/9)) = max(5, 1) = 5; base = 1, extra = 0
      expect(calculateDrawCount(1, 5, 4)).toBe(1);
    });

    it('should distribute the remainder to the first players for large piles', () => {
      // total = max(3, floor(100/7)) = 14; base = 4, extra = 2
      expect(calculateDrawCount(100, 3, 0)).toBe(5);
      expect(calculateDrawCount(100, 3, 1)).toBe(5);
      expect(calculateDrawCount(100, 3, 2)).toBe(4);
    });

    it('should distribute the remainder to the first player in a 2-player game', () => {
      // total = max(2, floor(18/6)) = 3; base = 1, extra = 1
      expect(calculateDrawCount(18, 2, 0)).toBe(2);
      expect(calculateDrawCount(18, 2, 1)).toBe(1);
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
        {}
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
        drawResults: []
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
        drawResults: []
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
    // NFR #6 relocated: recordPlayerAdded used to reject when the userId
    // argument didn't match game.user.id, which only made sense when this
    // ran on the caller's own client. It now always runs on the GM's
    // client via the relay (see gm-card-actions.mjs), where that
    // comparison would reject every legitimate call - see
    // gm-relay.test.mjs for the replacement plausibility check
    // (assertKnownUser) and the concurrency tests below for why this
    // moved to the GM in the first place.

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

  describe('recordPlayerAdded (concurrent calls)', () => {
    // MockCardsPile#setFlag now yields to the event loop once before
    // writing (mirrors the real network round-trip - see test/mocks/
    // foundry.mjs), so two calls racing on the SAME flag can genuinely
    // interleave here instead of running to completion one after another.
    it('loses a player when two adds race unserialized (reproduces the bug)', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      const [resultA, resultB] = await Promise.all([
        recordPlayerAdded('userA'),
        recordPlayerAdded('userB')
      ]);

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);
      const state = loadRoundState();
      // Both calls "succeeded" individually, but they raced on the same
      // read-modify-write of the currentRound flag - last write wins, so
      // one of the two additions is silently gone.
      expect(state.playersAdded.length).toBeLessThan(2);
    });

    it('never loses a player when both calls are serialized (post-fix, via withCardLock)', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      // Simulates both requests landing on the GM's shared queue (see
      // gm-card-actions.mjs#gmRecordPlayerAdded), instead of racing
      // unserialized on two different clients.
      const [resultA, resultB] = await Promise.all([
        withCardLock(() => recordPlayerAdded('userA')),
        withCardLock(() => recordPlayerAdded('userB'))
      ]);

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);
      const state = loadRoundState();
      expect(state.playersAdded.sort()).toEqual(['userA', 'userB']);
    });
  });

  describe('executePlayerDraw', () => {
    beforeEach(() => {
      // Set up a complete game environment for draw tests
      const pile = new MockCardsPile(createLargePile(21));
      const hand = createHandPile();
      const actor = new MockActor('actor1', 'TestActor');
      actor._cards = new MockCardsPile([]);

      game.cards = createCardsMap([
        ['pile1', pile],
        ['hand1', hand]
      ]);
      game.user.id = 'user1';
      game.user.name = 'Player1';
      game.user.character = actor;
    });

    // NFR #6 relocated - see the comment above recordPlayerAdded's
    // describe block: the old self-check compared the caller to itself,
    // which broke once this always runs on the GM's client.

    it('should error if player has not added cards', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user2']));

      const result = await executePlayerDraw('user1', 'Player1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('DECK_OF_DESTINY.messages.DrawRound.Error.NotAdded');
    });

    it('should error if player has already drawn', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithSomeDrawn(['user1'], ['user1'])
      );

      const result = await executePlayerDraw('user1', 'Player1');
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'DECK_OF_DESTINY.messages.DrawRound.Error.AlreadyDrawn'
      );
    });

    it('should draw cards and update state successfully', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithPlayersAdded(['user1', 'user2', 'user3'])
      );

      const result = await executePlayerDraw('user1', 'Player1');
      expect(result.success).toBe(true);
      expect(result.data.drawnCount).toBeGreaterThan(0);

      const state = loadRoundState();
      expect(state.playersDrawn).toContain('user1');
      expect(state.drawResults.length).toBe(1);
    });

    it('should calculate correct draw count based on players', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithPlayersAdded(['user1', 'user2', 'user3'])
      );

      const result = await executePlayerDraw('user1', 'Player1');
      expect(result.success).toBe(true);
      // total = max(3, floor(21/7)) = 3; base = 1, extra = 0; first drawer gets 1
      expect(result.data.drawnCount).toBe(1);
    });

    it('should store draw result with card data', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1']));

      await executePlayerDraw('user1', 'TestActor');

      const state = loadRoundState();
      const drawResult = state.drawResults[0];

      expect(drawResult.userId).toBe('user1');
      // displayName is now resolved by the caller (see
      // gm-relay.mjs#resolveDisplayName, tested on its own in
      // gm-relay.test.mjs) and passed through as-is - executePlayerDraw
      // just attributes the draw to whatever name it's given.
      expect(drawResult.userName).toBe('TestActor');
      expect(drawResult.cards).toBeDefined();
      expect(drawResult.cards.length).toBeGreaterThan(0);
      expect(drawResult.suits).toBeDefined();
    });

    it('should indicate round complete when last player draws', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithSomeDrawn(['user1', 'user2'], ['user2'])
      );

      const result = await executePlayerDraw('user1', 'Player1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(true);
    });

    it('should indicate round not complete when players remain', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithPlayersAdded(['user1', 'user2', 'user3'])
      );

      const result = await executePlayerDraw('user1', 'Player1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);
    });
  });
});

describe('draw-round: Integration Tests', () => {
  describe('Full round lifecycle', () => {
    beforeEach(() => {
      const pile = new MockCardsPile(createLargePile(30));
      const hand = createHandPile();
      const actor = new MockActor('actor1', 'TestActor');
      actor._cards = new MockCardsPile([]);

      game.cards = createCardsMap([
        ['pile1', pile],
        ['hand1', hand]
      ]);
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
      let result = await executePlayerDraw('user1', 'Player1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);

      // Player 2 draws
      game.user.id = 'user2';
      game.user.name = 'Player2';
      result = await executePlayerDraw('user2', 'Player2');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);

      // Player 3 draws (completes round)
      game.user.id = 'user3';
      game.user.name = 'Player3';
      result = await executePlayerDraw('user3', 'Player3');
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
      const result = await executePlayerDraw('user1', 'Player1');

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
      await executePlayerDraw('user1', 'Player1');

      await clearRoundState();

      const state = loadRoundState();
      expect(state).toBe(null);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty pile gracefully', async () => {
      const pile = new MockCardsPile([]);
      const hand = createHandPile();
      const actor = new MockActor('actor1', 'TestActor');
      actor._cards = new MockCardsPile([]);

      game.cards = createCardsMap([
        ['pile1', pile],
        ['hand1', hand]
      ]);
      game.user.id = 'user1';
      game.user.name = 'Player1';
      game.user.character = actor;

      await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1']));

      const result = await executePlayerDraw('user1', 'Player1');
      expect(result.success).toBe(false);
    });

    it('should handle single-player round', async () => {
      const pile = new MockCardsPile(createLargePile(10));
      const hand = createHandPile();
      const actor = new MockActor('actor1', 'TestActor');
      actor._cards = new MockCardsPile([]);

      game.cards = createCardsMap([
        ['pile1', pile],
        ['hand1', hand]
      ]);
      game.user.id = 'user1';
      game.user.name = 'Player1';
      game.user.character = actor;

      await recordPlayerAdded('user1');
      const result = await executePlayerDraw('user1', 'Player1');

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

      // Verify per-player draw count: 48/(4+8)=4 baseline total, but the
      // "at least 1 card per player" floor raises the total to 8, so each
      // of the 8 players gets exactly 1 card.
      const drawCount = calculateDrawCount(48, 8, 0);
      expect(drawCount).toBe(1);
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
        }
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
              img: 'vento.png'
            }
          ],
          suits: { 'special:vento': 1 }
        }
      ]
    };

    await generateSummary(state);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('Carta del Vento');
    expect(messages[0].content).not.toContain('special:vento:');
  });
});
