/**
 * Unit tests for the pure decision helpers in card-utils.mjs that back the
 * "pile stays at 20 cards, white fillers get replaced first" rule.
 */

import { describe, it, expect } from 'vitest';
import {
  MINIMUM_PILE_SIZE,
  getCardsNeededToFillPile,
  getWhiteCardsToReplace,
  refillPileWithWhite,
  addCardsReplacingWhite
} from '../../src/module/helpers/card-utils.mjs';
import { MockCardsPile } from '../mocks/foundry.mjs';
import { createCard, createCardsBySuit } from '../fixtures/card-data.mjs';

describe('card-utils: MINIMUM_PILE_SIZE', () => {
  it('is 20', () => {
    expect(MINIMUM_PILE_SIZE).toBe(20);
  });
});

describe('card-utils: getCardsNeededToFillPile', () => {
  it('returns the gap to the minimum size when pile is under it', () => {
    expect(getCardsNeededToFillPile(0)).toBe(20);
    expect(getCardsNeededToFillPile(12)).toBe(8);
  });

  it('returns 0 when pile already meets the minimum size', () => {
    expect(getCardsNeededToFillPile(20)).toBe(0);
  });

  it('returns 0 when pile already exceeds the minimum size', () => {
    expect(getCardsNeededToFillPile(25)).toBe(0);
  });

  it('respects a custom minSize', () => {
    expect(getCardsNeededToFillPile(5, 10)).toBe(5);
    expect(getCardsNeededToFillPile(10, 10)).toBe(0);
  });
});

describe('card-utils: getWhiteCardsToReplace', () => {
  it('replaces one white card per new card while white cards remain', () => {
    expect(getWhiteCardsToReplace(20, 3)).toBe(3);
  });

  it('caps replacement at the number of white cards actually in the pile', () => {
    expect(getWhiteCardsToReplace(2, 5)).toBe(2);
  });

  it('caps replacement at the number of new cards being added', () => {
    expect(getWhiteCardsToReplace(20, 4)).toBe(4);
  });

  it('replaces nothing when there are no white cards in the pile', () => {
    expect(getWhiteCardsToReplace(0, 5)).toBe(0);
  });

  it('replaces nothing when no new cards are being added', () => {
    expect(getWhiteCardsToReplace(20, 0)).toBe(0);
  });
});

describe('card-utils: refillPileWithWhite (integration)', () => {
  it('fills an empty pile up to the minimum size with white cards from the deck', async () => {
    const deck = new MockCardsPile(createCardsBySuit({ white: 20 }));
    const pile = new MockCardsPile([]);

    await refillPileWithWhite(deck, pile);

    expect(pile.cards.size).toBe(20);
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(20);
    expect(deck.cards.size).toBe(0);
  });

  it('tops up only the missing amount when the pile already holds cards', async () => {
    const deck = new MockCardsPile(createCardsBySuit({ white: 20 }, 'deck-'));
    const pile = new MockCardsPile(createCardsBySuit({ success: 15 }, 'pile-'));

    await refillPileWithWhite(deck, pile);

    expect(pile.cards.size).toBe(20);
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(5);
    expect(deck.cards.size).toBe(15);
  });

  it('does nothing when the pile already meets the minimum size', async () => {
    const deck = new MockCardsPile(createCardsBySuit({ white: 20 }, 'deck-'));
    const pile = new MockCardsPile(createCardsBySuit({ success: 20 }, 'pile-'));

    await refillPileWithWhite(deck, pile);

    expect(pile.cards.size).toBe(20);
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(0);
    expect(deck.cards.size).toBe(20);
  });

  it('moves only as many white cards as the deck actually has', async () => {
    const deck = new MockCardsPile(createCardsBySuit({ white: 3 }));
    const pile = new MockCardsPile([]);

    await refillPileWithWhite(deck, pile);

    expect(pile.cards.size).toBe(3);
    expect(deck.cards.size).toBe(0);
  });
});

describe('card-utils: addCardsReplacingWhite (integration)', () => {
  it('replaces white cards that arrived in the pile via pass() (drawn=true)', async () => {
    // Regression test: `drawn` means "no longer in its origin deck", so any
    // card that reached the pile through refillPileWithWhite (a real
    // pass()) is drawn=true - it is NOT "already drawn" in the gameplay
    // sense of having been dealt to a player. A filter that excludes drawn
    // cards here would never find the white filler again, so nothing ever
    // gets replaced (this reproduces the bug: cards added to the pile
    // stopped displacing white fillers).
    const deck = new MockCardsPile(
      createCardsBySuit({ white: 20, success: 4 }, 'deck-')
    );
    const pile = new MockCardsPile([]);
    await refillPileWithWhite(deck, pile);
    expect(pile.cards.filter((c) => c.drawn).length).toBe(20);

    await addCardsReplacingWhite(deck, pile, { success: 4 });

    expect(pile.cards.size).toBe(20);
    expect(pile.cards.filter((c) => c.suit === 'success').length).toBe(4);
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(16);
  });

  it('replaces white filler cards one-for-one while enough remain', async () => {
    const pile = new MockCardsPile(createCardsBySuit({ white: 20 }, 'pile-'));
    const deck = new MockCardsPile(createCardsBySuit({ success: 5 }, 'deck-'));

    await addCardsReplacingWhite(deck, pile, { success: 3 });

    expect(pile.cards.size).toBe(20);
    expect(pile.cards.filter((c) => c.suit === 'success').length).toBe(3);
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(17);
    // The 3 replaced white cards went back to the deck.
    expect(deck.cards.filter((c) => c.suit === 'white').length).toBe(3);
  });

  it('consumes all available white cards then adds the remainder on top', async () => {
    const pile = new MockCardsPile(createCardsBySuit({ white: 2 }, 'pile-'));
    const deck = new MockCardsPile(createCardsBySuit({ success: 5 }, 'deck-'));

    await addCardsReplacingWhite(deck, pile, { success: 5 });

    expect(pile.cards.size).toBe(5);
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(0);
    expect(pile.cards.filter((c) => c.suit === 'success').length).toBe(5);
    expect(deck.cards.filter((c) => c.suit === 'white').length).toBe(2);
  });

  it('just adds cards on top when the pile has no white cards left', async () => {
    const pile = new MockCardsPile(createCardsBySuit({ success: 3 }, 'pile-'));
    const deck = new MockCardsPile(createCardsBySuit({ failure: 2 }, 'deck-'));

    await addCardsReplacingWhite(deck, pile, { failure: 2 });

    expect(pile.cards.size).toBe(5);
    expect(pile.cards.filter((c) => c.suit === 'failure').length).toBe(2);
  });

  it('replaces white cards using the combined total across every suit being added', async () => {
    const pile = new MockCardsPile(createCardsBySuit({ white: 4 }, 'pile-'));
    const deck = new MockCardsPile(
      createCardsBySuit({ success: 2, failure: 3 }, 'deck-')
    );

    await addCardsReplacingWhite(deck, pile, { success: 2, failure: 3 });

    // 5 new cards vs. 4 white fillers: all 4 whites are consumed, the 5th
    // card just grows the pile by one instead of replacing anything.
    expect(pile.cards.size).toBe(5);
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(0);
    expect(deck.cards.filter((c) => c.suit === 'white').length).toBe(4);
  });

  it('does not touch the deck-side white pool when nothing is being added', async () => {
    const pile = new MockCardsPile(createCardsBySuit({ white: 4 }, 'pile-'));
    const deck = new MockCardsPile(createCardsBySuit({ success: 5 }, 'deck-'));

    await addCardsReplacingWhite(deck, pile, { success: 0 });

    expect(pile.cards.size).toBe(4);
    expect(deck.cards.filter((c) => c.suit === 'white').length).toBe(0);
  });
});

/**
 * addCardsReplacingWhite is a read-then-act sequence: it reads the pile's
 * current white cards, then performs two *separate* Cards#pass() calls (the
 * white-card removal, then the real-card addition). Cards#pass() is a real
 * network round-trip in production - MockCardsPile#pass() simulates that by
 * yielding to the event loop once before mutating (see the mock's comment).
 * That gap is exactly the window where two overlapping callers (e.g. two
 * players clicking "add cards" at once) can both read the *same* pile state
 * before either has written back.
 *
 * These tests don't assert a single "correct" outcome for the racing pair -
 * with no lock, there isn't one. They assert the invariants that must hold
 * regardless of interleaving (nothing thrown, no card duplicated or lost),
 * and then demonstrate the concrete, real consequence of the missing lock:
 * the pile can overshoot the size a serialized run would have produced.
 */
describe('card-utils: addCardsReplacingWhite (concurrent calls, no lock)', () => {
  it('keeps the pile at its target size when the same additions run one after another', async () => {
    const pile = new MockCardsPile(createCardsBySuit({ white: 10 }, 'pile-'));
    const deck = new MockCardsPile(
      createCardsBySuit({ success: 3, failure: 3 }, 'deck-')
    );

    await addCardsReplacingWhite(deck, pile, { success: 3 });
    await addCardsReplacingWhite(deck, pile, { failure: 3 });

    // 6 real cards vs. 10 white fillers: fully absorbed, pile size unchanged.
    expect(pile.cards.size).toBe(10);
    expect(pile.cards.filter((c) => c.suit === 'white').length).toBe(4);
  });

  it('never throws, loses, or duplicates a card when two calls race on the same pile', async () => {
    const pile = new MockCardsPile(createCardsBySuit({ white: 10 }, 'pile-'));
    const deck = new MockCardsPile(
      createCardsBySuit({ success: 3, failure: 3 }, 'deck-')
    );
    const totalBefore = pile.cards.size + deck.cards.size;

    await expect(
      Promise.all([
        addCardsReplacingWhite(deck, pile, { success: 3 }),
        addCardsReplacingWhite(deck, pile, { failure: 3 })
      ])
    ).resolves.toBeDefined();

    // Conservation: every card is accounted for exactly once, split across
    // the two collections - none vanished, none got cloned into both.
    expect(pile.cards.size + deck.cards.size).toBe(totalBefore);
    for (const id of pile.cards.keys()) {
      expect(deck.cards.has(id)).toBe(false);
    }

    // All 6 real cards always land in the pile - that half of the work
    // doesn't depend on the racy white-card read.
    expect(pile.cards.filter((c) => c.suit === 'success').length).toBe(3);
    expect(pile.cards.filter((c) => c.suit === 'failure').length).toBe(3);
  });

  it('can overshoot the target pile size under a race, unlike the serialized run', async () => {
    const pile = new MockCardsPile(createCardsBySuit({ white: 10 }, 'pile-'));
    const deck = new MockCardsPile(
      createCardsBySuit({ success: 3, failure: 3 }, 'deck-')
    );

    await Promise.all([
      addCardsReplacingWhite(deck, pile, { success: 3 }),
      addCardsReplacingWhite(deck, pile, { failure: 3 })
    ]);

    // Both calls read the pile's white cards before either wrote back, so
    // they can both "claim" the same white cards to replace. Whichever call
    // loses that race adds its cards on top instead of replacing anything,
    // growing the pile past the 10 a serialized run keeps it at (see the
    // "one after another" test above). This is the concrete failure mode a
    // caller-side lock (withCardLock, now applied to addCardsToPile) exists
    // to prevent for same-client callers.
    expect(pile.cards.size).toBeGreaterThan(10);
  });
});
