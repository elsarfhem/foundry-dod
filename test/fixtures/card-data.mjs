/**
 * Test fixtures for card data
 * Provides factory functions to create mock cards
 */

import { MockCard } from '../mocks/foundry.mjs';

/**
 * Create a mock card with given properties
 */
export function createCard(options = {}) {
  return new MockCard({
    id: options.id || `card-${Math.random().toString(36).substr(2, 9)}`,
    name: options.name || 'Test Card',
    suit: options.suit || 'hearts',
    value: options.value || 5,
  });
}

/**
 * Create multiple cards with different suits.
 * @param {Object<string, number>} counts - Map of suit name to how many to create.
 * @param {string} [idPrefix=''] - Prefix for generated ids. Pass distinct
 *   prefixes when building cards for two collections that will exchange
 *   cards in the same test (e.g. a deck and a pile) so their ids don't
 *   collide once cards move between them.
 */
export function createCardsBySuit(counts = { hearts: 2, spades: 2, diamonds: 1 }, idPrefix = '') {
  const cards = [];
  let idCounter = 1;

  for (const [suit, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      cards.push(
        createCard({
          id: `${idPrefix}card${idCounter++}`,
          suit,
          name: `${suit} ${i + 1}`,
        })
      );
    }
  }

  return cards;
}

/**
 * Create a standard set of cards for testing
 */
export function createStandardTestCards() {
  return [
    createCard({ id: 'c1', suit: 'hearts', value: 5, name: 'Hearts 5' }),
    createCard({ id: 'c2', suit: 'spades', value: 8, name: 'Spades 8' }),
    createCard({ id: 'c3', suit: 'diamonds', value: 3, name: 'Diamonds 3' }),
    createCard({ id: 'c4', suit: 'hearts', value: 10, name: 'Hearts 10' }),
    createCard({ id: 'c5', suit: 'clubs', value: 2, name: 'Clubs 2' }),
  ];
}

/**
 * Create cards for a large pile test
 */
export function createLargePile(size = 20) {
  const suits = ['hearts', 'spades', 'diamonds', 'clubs'];
  const cards = [];

  for (let i = 0; i < size; i++) {
    cards.push(
      createCard({
        id: `card${i + 1}`,
        suit: suits[i % suits.length],
        value: (i % 10) + 1,
        name: `Card ${i + 1}`,
      })
    );
  }

  return cards;
}

/**
 * Create a draw result for a user
 */
export function createDrawResult(userId, cards, userName = null) {
  const suits = {};

  for (const card of cards) {
    suits[card.suit] = (suits[card.suit] || 0) + 1;
  }

  return {
    userId,
    userName: userName || `Player ${userId.slice(-1)}`,
    cards: cards.map((c) => ({
      id: c.id,
      name: c.name,
      suit: c.suit,
    })),
    suits,
  };
}
