/**
 * Unit tests for gm-card-actions.mjs - the GM-side handlers relayed via
 * gm-relay.mjs. These run against MockCardsPile directly (no socketlib
 * involved at all): the relay dispatcher is a separate, already-tested
 * concern (gm-relay.test.mjs).
 */

import { describe, it, expect } from 'vitest';
import {
  gmAddCardsToPile,
  gmAddToDeck,
  gmResetPileForNewRound,
  gmComposeAndDraw,
  gmDrawFromPile,
  gmExecutePlayerDraw,
  gmRisk,
  gmCreateSpecialCard,
  gmUpdateSpecialCard,
  gmDeleteSpecialCard
} from '../../src/module/helpers/gm-card-actions.mjs';
import { loadRoundState } from '../../src/module/helpers/draw-round.mjs';
import { createRoundWithPlayersAdded } from '../fixtures/round-states.mjs';
import { createLargePile, createCardsBySuit } from '../fixtures/card-data.mjs';
import {
  MockCard,
  MockCardsPile,
  createCardsMap,
  createHandPile
} from '../mocks/foundry.mjs';

function setUpDeckAndPile(deckCounts, pileCounts) {
  const deck = new MockCardsPile(createCardsBySuit(deckCounts, 'deck-'));
  deck.name = 'DoD - lista carte';
  const pile = new MockCardsPile(createCardsBySuit(pileCounts, 'pile-'));
  game.cards = createCardsMap([
    ['deck1', deck],
    ['pile1', pile]
  ]);
  return { deck, pile };
}

describe('gm-card-actions: gmAddCardsToPile', () => {
  it('rejects an unknown userId without touching the pile or round state', async () => {
    const { pile } = setUpDeckAndPile({ success: 5 }, { white: 20 });

    const result = await gmAddCardsToPile({
      userId: 'ghost',
      suitCounts: { success: 3 }
    });

    expect(result).toEqual({
      success: false,
      error: 'DECK_OF_DESTINY.messages.errors.unknownUser'
    });
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(20);
    expect(loadRoundState()).toBeNull();
  });

  it('replaces white filler, records the player, and returns a fresh pile snapshot', async () => {
    setUpDeckAndPile({ success: 5 }, { white: 20 });

    const result = await gmAddCardsToPile({
      userId: 'user1',
      suitCounts: { success: 3 }
    });

    expect(result.success).toBe(true);
    expect(result.data.pileSnapshot.pileSuits.success).toBe(3);
    expect(result.data.pileSnapshot.pileSuits.white).toBe(17);
    expect(loadRoundState().playersAdded).toContain('user1');
  });
});

describe('gm-card-actions: gmAddToDeck', () => {
  it('adds the requested suit/special counts to the pile, replacing white filler first', async () => {
    const { pile } = setUpDeckAndPile({ success: 5 }, { white: 20 });

    const result = await gmAddToDeck({ counts: { success: 3 }, specialCounts: {} });

    expect(result).toEqual({ success: true });
    expect(pile.cards.filter((c) => c.suit === 'success').length).toBe(3);
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(17);
  });
});

describe('gm-card-actions: gmResetPileForNewRound', () => {
  it('recalls and refills the pile with white filler up to the minimum size', async () => {
    const { pile } = setUpDeckAndPile({ white: 20 }, {});

    const result = await gmResetPileForNewRound({});

    expect(result).toEqual({ success: true });
    expect(pile.cards.size).toBe(20);
  });

  it('leaves the round state untouched by default (matches componiIlMazzoEPesca)', async () => {
    const { pile } = setUpDeckAndPile({ white: 20 }, {});
    await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1']));

    await gmResetPileForNewRound({});

    expect(loadRoundState()).not.toBeNull();
  });

  it('clears the round state when clearRound is true (richiediProva)', async () => {
    const { pile } = setUpDeckAndPile({ white: 20 }, {});
    await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1']));

    await gmResetPileForNewRound({ clearRound: true });

    expect(loadRoundState()).toBeNull();
  });
});

describe('gm-card-actions: gmComposeAndDraw', () => {
  it("adds the composition then draws playersNum's share, returning plain-object cards", async () => {
    const { pile } = setUpDeckAndPile({ success: 10 }, { white: 20 });
    const hand = createHandPile();
    game.cards.set('hand1', hand);

    const result = await gmComposeAndDraw({
      playersNum: 1,
      counts: { success: 5 },
      specialCounts: {}
    });

    expect(result.success).toBe(true);
    expect(pile.cards.filter((c) => c.suit === 'success').length).toBeGreaterThan(0);
    expect(result.data.drawnCards.length).toBeGreaterThan(0);
    for (const card of result.data.drawnCards) {
      expect(Object.keys(card).sort()).toEqual(['id', 'img', 'name', 'suit']);
    }
  });

  it('draws nothing (empty array, no throw) when the pile ends up empty', async () => {
    setUpDeckAndPile({}, {});
    game.cards.set('hand1', createHandPile());

    const result = await gmComposeAndDraw({
      playersNum: 1,
      counts: {},
      specialCounts: {}
    });

    expect(result).toEqual({ success: true, data: { drawnCards: [] } });
  });
});

describe('gm-card-actions: gmDrawFromPile', () => {
  it("draws playersNum's share from the pile", async () => {
    const pile = new MockCardsPile(createLargePile(21));
    const hand = createHandPile();
    game.cards = createCardsMap([
      ['pile1', pile],
      ['hand1', hand]
    ]);

    const result = await gmDrawFromPile({ playersNum: 1 });

    expect(result.success).toBe(true);
    expect(result.data.drawnCards.length).toBeGreaterThan(0);
  });

  it('draws nothing when the pile is empty', async () => {
    const pile = new MockCardsPile([]);
    const hand = createHandPile();
    game.cards = createCardsMap([
      ['pile1', pile],
      ['hand1', hand]
    ]);

    const result = await gmDrawFromPile({ playersNum: 1 });

    expect(result).toEqual({ success: true, data: { drawnCards: [] } });
  });
});

describe('gm-card-actions: gmExecutePlayerDraw', () => {
  function setUpDrawEnvironment() {
    const pile = new MockCardsPile(createLargePile(21));
    const hand = createHandPile();
    game.cards = createCardsMap([
      ['pile1', pile],
      ['hand1', hand]
    ]);
    return { pile, hand };
  }

  it('rejects an unknown userId', async () => {
    setUpDrawEnvironment();
    const result = await gmExecutePlayerDraw({ userId: 'ghost', displayName: 'Ghost' });
    expect(result).toEqual({
      success: false,
      error: 'DECK_OF_DESTINY.messages.errors.unknownUser'
    });
  });

  it('draws for a known user and attributes the result to the given displayName', async () => {
    const { pile } = setUpDrawEnvironment();
    await pile.setFlag('dod', 'currentRound', createRoundWithPlayersAdded(['user1']));

    const result = await gmExecutePlayerDraw({ userId: 'user1', displayName: 'Hero' });

    expect(result.success).toBe(true);
    expect(result.data.drawResult.userId).toBe('user1');
    expect(result.data.drawResult.userName).toBe('Hero');
    expect(result.data.playersAddedCount).toBe(1);
  });
});

describe('gm-card-actions: gmRisk', () => {
  it('reports noDeckCards when the pile is empty', async () => {
    const pile = new MockCardsPile([]);
    const hand = createHandPile();
    game.cards = createCardsMap([
      ['pile1', pile],
      ['hand1', hand]
    ]);

    const result = await gmRisk({ userId: 'user1', displayName: 'Player1' });

    expect(result).toEqual({ success: true, data: { outcome: 'noDeckCards' } });
  });

  it('reports unequalCards when hand success/failure counts differ', async () => {
    const pile = new MockCardsPile(createLargePile(5));
    const hand = createHandPile(createCardsBySuit({ success: 2, failure: 1 }, 'hand-'));
    game.cards = createCardsMap([
      ['pile1', pile],
      ['hand1', hand]
    ]);

    const result = await gmRisk({ userId: 'user1', displayName: 'Player1' });

    expect(result).toEqual({
      success: true,
      data: { outcome: 'unequalCards', numSuccess: 2, numFailure: 1 }
    });
  });

  it('reports noCardsForRisk when the pile empties before a success/failure is drawn', async () => {
    const pile = new MockCardsPile(createCardsBySuit({ white: 2 }, 'pile-'));
    const hand = createHandPile(createCardsBySuit({ success: 1, failure: 1 }, 'hand-'));
    game.cards = createCardsMap([
      ['pile1', pile],
      ['hand1', hand]
    ]);

    const result = await gmRisk({ userId: 'user1', displayName: 'Player1' });

    expect(result).toEqual({ success: true, data: { outcome: 'noCardsForRisk' } });
  });

  it('resolves once a success/failure card is drawn, returning plain-object cards', async () => {
    const pile = new MockCardsPile(
      createCardsBySuit({ white: 3, success: 1 }, 'pile-')
    );
    const hand = createHandPile(createCardsBySuit({ success: 1, failure: 1 }, 'hand-'));
    game.cards = createCardsMap([
      ['pile1', pile],
      ['hand1', hand]
    ]);

    const result = await gmRisk({ userId: 'user1', displayName: 'Player1' });

    expect(result.success).toBe(true);
    expect(result.data.outcome).toBe('resolved');
    expect(result.data.finalSuit).toBe('success');
    expect(result.data.drawnCards.length).toBeGreaterThan(0);
    // Every drawn card is a plain {id, name, suit, img} object, never a
    // Foundry Document instance (those aren't safe to send over a socket).
    for (const card of result.data.drawnCards) {
      expect(Object.keys(card).sort()).toEqual(['id', 'img', 'name', 'suit']);
    }
  });
});

describe('gm-card-actions: gmCreateSpecialCard', () => {
  it('creates the requested number of copies of a new special card in the deck', async () => {
    const { deck } = setUpDeckAndPile({}, {});

    const result = await gmCreateSpecialCard({
      name: 'Carta del Vento',
      description: 'Il vento cambia direzione.',
      img: null,
      copies: 2
    });

    expect(result.success).toBe(true);
    const suit = result.data.suit;
    expect(suit.startsWith('special:')).toBe(true);
    expect(deck.cards.filter((c) => c.suit === suit).length).toBe(2);
  });
});

describe('gm-card-actions: gmUpdateSpecialCard', () => {
  it('renames every copy across deck/pile/hand and reports zero shortfall when copies match', async () => {
    const { deck } = setUpDeckAndPile({}, {});
    game.cards.set('hand1', createHandPile());
    const { data } = await gmCreateSpecialCard({
      name: 'Old Name',
      description: 'd',
      img: null,
      copies: 1
    });

    const result = await gmUpdateSpecialCard({
      suit: data.suit,
      name: 'New Name',
      description: 'd2',
      img: null,
      copies: 1
    });

    expect(result).toEqual({ success: true, data: { shortfall: 0 } });
    expect(deck.cards.filter((c) => c.suit === data.suit)[0].name).toBe('New Name');
  });

  it('reports a shortfall when asked to remove more copies than are undrawn', async () => {
    const { deck } = setUpDeckAndPile({}, {});
    game.cards.set('hand1', createHandPile());
    const { data } = await gmCreateSpecialCard({
      name: 'Carta',
      description: '',
      img: null,
      copies: 1
    });
    // A drawn copy still resident in the deck's own collection can't be
    // removed by adjustSpecialCardCopies (see its doc comment) - inject one
    // directly to force a shortfall deleting both requested copies.
    deck.cards.set(
      'drawn-copy',
      new MockCard({ id: 'drawn-copy', suit: data.suit, drawn: true })
    );

    const result = await gmUpdateSpecialCard({
      suit: data.suit,
      name: 'Carta',
      description: '',
      img: null,
      copies: 0
    });

    expect(result).toEqual({ success: true, data: { shortfall: 1 } });
  });
});

describe('gm-card-actions: gmDeleteSpecialCard', () => {
  it('removes every copy of the special card from the deck', async () => {
    const { deck } = setUpDeckAndPile({}, {});
    game.cards.set('hand1', createHandPile());
    const { data } = await gmCreateSpecialCard({
      name: 'Carta',
      description: '',
      img: null,
      copies: 3
    });

    const result = await gmDeleteSpecialCard({ suit: data.suit });

    expect(result).toEqual({ success: true });
    expect(deck.cards.filter((c) => c.suit === data.suit).length).toBe(0);
  });
});
