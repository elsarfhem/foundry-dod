/**
 * Unit tests for draw-round.mjs
 * Tests all 82 test cases from the test strategy, plus actor-based
 * round-tracking regressions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadRoundState,
  saveRoundState,
  clearRoundState,
  initializeRoundState,
  canActorDraw,
  hasActorAdded,
  isRoundComplete,
  calculateDrawCount,
  countBySuit,
  recordActorAdded,
  unrecordActorAdded,
  executeActorDraw,
  generateSummary
} from '../../src/module/helpers/draw-round.mjs';
import {
  createEmptyRoundState,
  createRoundWithActorsAdded,
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
  createCardsMap,
  createHandPile
} from '../mocks/foundry.mjs';
import { withCardLock } from '../../src/module/globals.mjs';

describe('draw-round: Pure Query Functions', () => {
  describe('canActorDraw', () => {
    it('should return false if state is null', () => {
      expect(canActorDraw(null, 'actor1')).toBe(false);
    });

    it('should return false if actor has not added cards', () => {
      const state = createRoundWithActorsAdded(['actor2', 'actor3']);
      expect(canActorDraw(state, 'actor1')).toBe(false);
    });

    it('should return false if actor has already drawn', () => {
      const state = createRoundWithSomeDrawn(['actor1', 'actor2'], ['actor1']);
      expect(canActorDraw(state, 'actor1')).toBe(false);
    });

    it('should return true if actor added but has not drawn', () => {
      const state = createRoundWithActorsAdded(['actor1', 'actor2']);
      expect(canActorDraw(state, 'actor1')).toBe(true);
    });

    it('should handle multiple actors correctly', () => {
      const state = createRoundWithSomeDrawn(['actor1', 'actor2', 'actor3'], ['actor1']);
      expect(canActorDraw(state, 'actor1')).toBe(false);
      expect(canActorDraw(state, 'actor2')).toBe(true);
      expect(canActorDraw(state, 'actor3')).toBe(true);
    });
  });

  describe('hasActorAdded', () => {
    it('should return false if state is null', () => {
      expect(hasActorAdded(null, 'actor1')).toBe(false);
    });

    it('should return false if actor has not added', () => {
      const state = createRoundWithActorsAdded(['actor2']);
      expect(hasActorAdded(state, 'actor1')).toBe(false);
    });

    it('should return true if actor has added', () => {
      const state = createRoundWithActorsAdded(['actor1', 'actor2']);
      expect(hasActorAdded(state, 'actor1')).toBe(true);
    });

    it('should work for empty state', () => {
      const state = createEmptyRoundState();
      expect(hasActorAdded(state, 'actor1')).toBe(false);
    });
  });

  describe('isRoundComplete', () => {
    it('should return false if state is null', () => {
      expect(isRoundComplete(null)).toBe(false);
    });

    it('should return false if no actors have added', () => {
      const state = createEmptyRoundState();
      expect(isRoundComplete(state)).toBe(false);
    });

    it('should return false if not all actors have drawn', () => {
      const state = createRoundWithSomeDrawn(['actor1', 'actor2', 'actor3'], ['actor1']);
      expect(isRoundComplete(state)).toBe(false);
    });

    it('should return true if all actors have drawn', () => {
      const state = createCompletedRoundState(['actor1', 'actor2']);
      expect(isRoundComplete(state)).toBe(true);
    });

    it('should handle single actor round', () => {
      const state = createCompletedRoundState(['actor1']);
      expect(isRoundComplete(state)).toBe(true);
    });
  });

  describe('calculateDrawCount', () => {
    // calculateDrawCount(pileSize, actorCount, actorIndex) returns ONE
    // actor's share of the round's total draw (see draw-round.mjs). Total
    // for the round = max(actorCount, floor(pileSize / (4 + actorCount))),
    // split evenly with the first `total % actorCount` actors getting one
    // extra card.
    it('should split an evenly-divisible total equally for a 3-actor game', () => {
      // total = max(3, floor(21/7)) = 3; base = 1, extra = 0
      expect(calculateDrawCount(21, 3, 0)).toBe(1);
      expect(calculateDrawCount(21, 3, 1)).toBe(1);
      expect(calculateDrawCount(21, 3, 2)).toBe(1);
    });

    it('should split an evenly-divisible total equally for a 4-actor game', () => {
      // total = max(4, floor(24/8)) = 4; base = 1, extra = 0
      expect(calculateDrawCount(24, 4, 0)).toBe(1);
      expect(calculateDrawCount(24, 4, 3)).toBe(1);
    });

    it('should return at least 1 card per actor for small piles', () => {
      // total = max(3, floor(5/7)) = max(3, 1) = 3; base = 1, extra = 0
      expect(calculateDrawCount(5, 3, 0)).toBe(1);
      // total = max(5, floor(1/9)) = max(5, 1) = 5; base = 1, extra = 0
      expect(calculateDrawCount(1, 5, 4)).toBe(1);
    });

    it('should distribute the remainder to the first actors for large piles', () => {
      // total = max(3, floor(100/7)) = 14; base = 4, extra = 2
      expect(calculateDrawCount(100, 3, 0)).toBe(5);
      expect(calculateDrawCount(100, 3, 1)).toBe(5);
      expect(calculateDrawCount(100, 3, 2)).toBe(4);
    });

    it('should distribute the remainder to the first actor in a 2-actor game', () => {
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
        actorsAdded: [],
        actorsDrawn: [],
        drawResults: []
      });
    });

    it('should create independent state objects', () => {
      const state1 = initializeRoundState();
      const state2 = initializeRoundState();
      state1.actorsAdded.push('actor1');
      expect(state2.actorsAdded).toEqual([]);
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
      const state = createRoundWithActorsAdded(['actor1', 'actor2']);
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
        actorsAdded: 'not-an-array',
        actorsDrawn: [],
        drawResults: []
      });

      expect(loadRoundState()).toBe(null);
    });

    it('should clear an old (pre-actor-rename) schema instead of loading it', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      await pile.setFlag('dod', 'currentRound', {
        playersAdded: ['user1'],
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
      const state = createRoundWithSomeDrawn(['actor1', 'actor2'], ['actor1']);

      await saveRoundState(state);
      const loaded = loadRoundState();

      expect(loaded.actorsAdded).toEqual(state.actorsAdded);
      expect(loaded.actorsDrawn).toEqual(state.actorsDrawn);
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
  describe('recordActorAdded', () => {
    it('should initialize state if none exists', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      const result = await recordActorAdded('actor1');
      expect(result.success).toBe(true);

      const state = loadRoundState();
      expect(state.actorsAdded).toContain('actor1');
    });

    it('should add actor to existing state', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      const initialState = createRoundWithActorsAdded(['actor1']);
      await pile.setFlag('dod', 'currentRound', initialState);

      const result = await recordActorAdded('actor2');
      expect(result.success).toBe(true);

      const state = loadRoundState();
      expect(state.actorsAdded).toEqual(['actor1', 'actor2']);
    });

    it('should be idempotent (no duplicate entries)', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      await recordActorAdded('actor1');
      await recordActorAdded('actor1');

      const state = loadRoundState();
      expect(state.actorsAdded.filter((id) => id === 'actor1').length).toBe(1);
    });

    it('should count two actors controlled by the same user as two participants', async () => {
      // The motivating scenario: one Foundry User opens two actor sheets
      // (their own character, plus another player's or an NPC they're
      // helping) and adds cards from both. Both actors must be recorded,
      // even though the underlying caller is the same person both times.
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      await recordActorAdded('actorA');
      await recordActorAdded('actorB');

      const state = loadRoundState();
      expect(state.actorsAdded).toEqual(['actorA', 'actorB']);
    });
  });

  describe('unrecordActorAdded', () => {
    it('removes the actor from actorsAdded and saves', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithActorsAdded(['actor1', 'actor2'])
      );

      const result = await unrecordActorAdded('actor1');
      expect(result.success).toBe(true);

      const state = loadRoundState();
      expect(state.actorsAdded).toEqual(['actor2']);
    });

    it('is a no-op success if no round state exists', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      const result = await unrecordActorAdded('actor1');
      expect(result).toEqual({ success: true });
    });

    it('is a no-op success if the actor was never added', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);
      await pile.setFlag('dod', 'currentRound', createRoundWithActorsAdded(['actor2']));

      const result = await unrecordActorAdded('actor1');
      expect(result).toEqual({ success: true });

      const state = loadRoundState();
      expect(state.actorsAdded).toEqual(['actor2']);
    });
  });

  describe('recordActorAdded (concurrent calls)', () => {
    // MockCardsPile#setFlag now yields to the event loop once before
    // writing (mirrors the real network round-trip - see test/mocks/
    // foundry.mjs), so two calls racing on the SAME flag can genuinely
    // interleave here instead of running to completion one after another.
    it('loses an actor when two adds race unserialized (reproduces the bug)', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      const [resultA, resultB] = await Promise.all([
        recordActorAdded('actorA'),
        recordActorAdded('actorB')
      ]);

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);
      const state = loadRoundState();
      // Both calls "succeeded" individually, but they raced on the same
      // read-modify-write of the currentRound flag - last write wins, so
      // one of the two additions is silently gone.
      expect(state.actorsAdded.length).toBeLessThan(2);
    });

    it('never loses an actor when both calls are serialized (post-fix, via withCardLock)', async () => {
      const pile = new MockCardsPile();
      game.cards = createCardsMap([['pile1', pile]]);

      // Simulates both requests landing on the GM's shared queue (see
      // gm-card-actions.mjs#gmAddCardsToPile), instead of racing
      // unserialized on two different clients.
      const [resultA, resultB] = await Promise.all([
        withCardLock(() => recordActorAdded('actorA')),
        withCardLock(() => recordActorAdded('actorB'))
      ]);

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);
      const state = loadRoundState();
      expect(state.actorsAdded.sort()).toEqual(['actorA', 'actorB']);
    });
  });

  describe('executeActorDraw', () => {
    beforeEach(() => {
      // Set up a complete game environment for draw tests
      const pile = new MockCardsPile(createLargePile(21));
      const hand = createHandPile();

      game.cards = createCardsMap([
        ['pile1', pile],
        ['hand1', hand]
      ]);
    });

    it('should error if actor has not added cards', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithActorsAdded(['actor2']));

      const result = await executeActorDraw('actor1', 'Actor1', 'user1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('DECK_OF_DESTINY.messages.DrawRound.Error.NotAdded');
    });

    it('should error if actor has already drawn', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithSomeDrawn(['actor1'], ['actor1'])
      );

      const result = await executeActorDraw('actor1', 'Actor1', 'user1');
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
        createRoundWithActorsAdded(['actor1', 'actor2', 'actor3'])
      );

      const result = await executeActorDraw('actor1', 'Actor1', 'user1');
      expect(result.success).toBe(true);
      expect(result.data.drawnCount).toBeGreaterThan(0);

      const state = loadRoundState();
      expect(state.actorsDrawn).toContain('actor1');
      expect(state.drawResults.length).toBe(1);
    });

    it('should calculate correct draw count based on actors', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithActorsAdded(['actor1', 'actor2', 'actor3'])
      );

      const result = await executeActorDraw('actor1', 'Actor1', 'user1');
      expect(result.success).toBe(true);
      // total = max(3, floor(21/7)) = 3; base = 1, extra = 0; first drawer gets 1
      expect(result.data.drawnCount).toBe(1);
    });

    it('should store draw result with card data, keyed by actor', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag('dod', 'currentRound', createRoundWithActorsAdded(['actor1']));

      await executeActorDraw('actor1', 'TestActor', 'user1');

      const state = loadRoundState();
      const drawResult = state.drawResults[0];

      expect(drawResult.actorId).toBe('actor1');
      expect(drawResult.actorName).toBe('TestActor');
      expect(drawResult.cards).toBeDefined();
      expect(drawResult.cards.length).toBeGreaterThan(0);
      expect(drawResult.suits).toBeDefined();
      // The caller's userId is used only to author the chat message (see
      // generatePlayerDrawMessage) - it must NOT leak into the persisted
      // round state's drawResults, which only needs actor identity.
      expect(drawResult.userId).toBeUndefined();
    });

    it('should indicate round complete when last actor draws', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithSomeDrawn(['actor1', 'actor2'], ['actor2'])
      );

      const result = await executeActorDraw('actor1', 'Actor1', 'user1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(true);
    });

    it('should indicate round not complete when actors remain', async () => {
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithActorsAdded(['actor1', 'actor2', 'actor3'])
      );

      const result = await executeActorDraw('actor1', 'Actor1', 'user1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);
    });

    it('counts two actors owned by the same caller as two separate draws', async () => {
      // Same motivating scenario as recordActorAdded's test, carried
      // through to the draw step: one user, two actors, two independent
      // draws and two entries in drawResults.
      const pile = Array.from(game.cards.values())[0];
      await pile.setFlag(
        'dod',
        'currentRound',
        createRoundWithActorsAdded(['actorA', 'actorB'])
      );

      const first = await executeActorDraw('actorA', 'ActorA', 'sameUser');
      expect(first.success).toBe(true);
      expect(first.data.roundComplete).toBe(false);

      const second = await executeActorDraw('actorB', 'ActorB', 'sameUser');
      expect(second.success).toBe(true);
      expect(second.data.roundComplete).toBe(true);

      const state = loadRoundState();
      expect(state.actorsDrawn.sort()).toEqual(['actorA', 'actorB']);
      expect(state.drawResults.map((r) => r.actorId).sort()).toEqual([
        'actorA',
        'actorB'
      ]);
    });
  });
});

describe('draw-round: Integration Tests', () => {
  describe('Full round lifecycle', () => {
    beforeEach(() => {
      const pile = new MockCardsPile(createLargePile(30));
      const hand = createHandPile();

      game.cards = createCardsMap([
        ['pile1', pile],
        ['hand1', hand]
      ]);
    });

    it('should complete a 3-actor round successfully', async () => {
      // Actor 1 adds
      await recordActorAdded('actor1');
      // Actor 2 adds
      await recordActorAdded('actor2');
      // Actor 3 adds
      await recordActorAdded('actor3');

      // Verify state
      let state = loadRoundState();
      expect(state.actorsAdded.length).toBe(3);

      // Actor 1 draws
      let result = await executeActorDraw('actor1', 'Actor1', 'user1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);

      // Actor 2 draws
      result = await executeActorDraw('actor2', 'Actor2', 'user1');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);

      // Actor 3 draws (completes round)
      result = await executeActorDraw('actor3', 'Actor3', 'user2');
      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(true);

      // Verify final state
      state = loadRoundState();
      expect(state.actorsDrawn.length).toBe(3);
      expect(state.drawResults.length).toBe(3);
    });

    it('should handle partial round correctly', async () => {
      await recordActorAdded('actor1');
      await recordActorAdded('actor2');

      // Only actor1 draws
      const result = await executeActorDraw('actor1', 'Actor1', 'user1');

      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(false);

      const state = loadRoundState();
      expect(state.actorsDrawn).toEqual(['actor1']);
      expect(state.drawResults.length).toBe(1);
    });

    it('should handle round reset via clearRoundState', async () => {
      await recordActorAdded('actor1');
      await executeActorDraw('actor1', 'Actor1', 'user1');

      await clearRoundState();

      const state = loadRoundState();
      expect(state).toBe(null);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty pile gracefully', async () => {
      const pile = new MockCardsPile([]);
      const hand = createHandPile();

      game.cards = createCardsMap([
        ['pile1', pile],
        ['hand1', hand]
      ]);

      await pile.setFlag('dod', 'currentRound', createRoundWithActorsAdded(['actor1']));

      const result = await executeActorDraw('actor1', 'Actor1', 'user1');
      expect(result.success).toBe(false);
    });

    it('should handle single-actor round', async () => {
      const pile = new MockCardsPile(createLargePile(10));
      const hand = createHandPile();

      game.cards = createCardsMap([
        ['pile1', pile],
        ['hand1', hand]
      ]);

      await recordActorAdded('actor1');
      const result = await executeActorDraw('actor1', 'Actor1', 'user1');

      expect(result.success).toBe(true);
      expect(result.data.roundComplete).toBe(true);
    });

    it('should handle maximum actors (8 actors)', async () => {
      const pile = new MockCardsPile(createLargePile(48));
      game.cards = createCardsMap([['pile1', pile]]);

      const actorIds = Array.from({ length: 8 }, (_, i) => `actor${i + 1}`);

      for (const actorId of actorIds) {
        await recordActorAdded(actorId);
      }

      const state = loadRoundState();
      expect(state.actorsAdded.length).toBe(8);

      // Verify per-actor draw count: 48/(4+8)=4 baseline total, but the
      // "at least 1 card per actor" floor raises the total to 8, so each
      // of the 8 actors gets exactly 1 card.
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
      actorsAdded: ['actor1'],
      actorsDrawn: ['actor1'],
      drawResults: [
        {
          actorId: 'actor1',
          actorName: 'Actor1',
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
