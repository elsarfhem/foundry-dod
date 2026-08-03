/**
 * Mock Foundry VTT API for unit testing
 * Provides minimal stubs for game objects, cards, and document operations
 */

// Mock user object
export class MockUser {
  constructor(id = 'user1', name = 'TestUser', isGM = false) {
    this.id = id;
    this.name = name;
    this.isGM = isGM;
  }
}

// Mock card object
export class MockCard {
  constructor(data = {}) {
    this.id = data.id || 'card1';
    this.name = data.name || 'Test Card';
    this.suit = data.suit || 'hearts';
    this.value = data.value || 5;
    this.description = data.description || '';
    this.faces = data.faces || [{ name: this.name, img: null, text: '' }];
    this.drawn = data.drawn || false;
    this._source = data._source || { suit: this.suit };
  }

  get system() {
    return {
      suit: this.suit,
      value: this.value
    };
  }
}

/**
 * Mock of Foundry's embedded `Cards#cards` collection. Real Foundry
 * `EmbeddedCollection`s are Map-like (keyed by id, with `.get`/`.has`/`.set`/
 * `.delete`/`.size`) but also iterate and filter like an array of the
 * contained documents rather than [key, value] pairs - card-utils.mjs (e.g.
 * `passCardsBySuit`'s `source.cards.filter(...)`) and cards.mjs's
 * `for (const card of pile.cards)` both rely on that array-like shape.
 */
export class MockCardsCollection extends Map {
  [Symbol.iterator]() {
    return this.values();
  }

  filter(predicate) {
    return Array.from(this.values()).filter(predicate);
  }
}

// Mock cards pile
export class MockCardsPile {
  constructor(cards = []) {
    this.id = 'pile1';
    this.name = 'Mazzo';
    this.cards = new MockCardsCollection(cards.map((c) => [c.id, c]));
    this._flags = {};
  }

  get availableCards() {
    return Array.from(this.cards.values());
  }

  getFlag(scope, key) {
    return this._flags[`${scope}.${key}`];
  }

  async setFlag(scope, key, value) {
    this._flags[`${scope}.${key}`] = structuredClone(value);
    return this;
  }

  async unsetFlag(scope, key) {
    delete this._flags[`${scope}.${key}`];
    return this;
  }

  /**
   * Simulate Cards#pass(to, ids, options): moves the cards with the given
   * ids from this stack into `to`, returning the moved Card documents.
   *
   * The real Cards#pass() is a network round-trip (it awaits a server
   * response before the source/target collections settle), so this yields
   * to the event loop once before mutating anything. Without that, two
   * "concurrent" calls in a test would never actually interleave - the
   * first would run to completion synchronously before the second even
   * started, hiding any race between the read of current state and the
   * mutation.
   *
   * @param {MockCardsPile} to - Destination stack
   * @param {string[]} ids - Card ids to move
   * @param {object} [options={}]
   */
  async pass(to, ids, options = {}) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const transferredCards = [];
    for (const id of ids) {
      const card = this.cards.get(id);
      if (!card) continue;
      this.cards.delete(id);
      to.cards.set(id, card);
      // Real Foundry sets `drawn: true` once a card leaves its origin deck.
      // This mock doesn't track per-card origin, so it simplifies to "true
      // after any pass()", which is what every current call site needs:
      // cards sitting in a pile/hand are always drawn=true, regardless of
      // which stack passed them along.
      card.drawn = true;
      transferredCards.push(card);
    }
    return transferredCards;
  }

  async draw(source, count, options = {}) {
    // Draw cards from source pile
    const drawnCards = [];
    const available = Array.from(source.cards.values());

    for (let i = 0; i < Math.min(count, available.length); i++) {
      const card = available[i];
      source.cards.delete(card.id);
      this.cards.set(card.id, card);
      card.drawn = true;
      drawnCards.push(card);
    }

    return drawnCards;
  }

  async createEmbeddedDocuments(embeddedName, dataArray, options = {}) {
    const created = dataArray.map((data, index) => {
      const card = new MockCard({
        ...data,
        id: data._id || `${this.id}-new-${this.cards.size + index + 1}`
      });
      this.cards.set(card.id, card);
      return card;
    });
    return created;
  }

  async updateEmbeddedDocuments(embeddedName, updatesArray, options = {}) {
    const updated = [];
    for (const update of updatesArray) {
      const card = this.cards.get(update._id);
      if (!card) continue;
      Object.assign(card, update);
      updated.push(card);
    }
    return updated;
  }

  async deleteEmbeddedDocuments(embeddedName, idsArray, options = {}) {
    const deleted = [];
    for (const id of idsArray) {
      if (this.cards.delete(id)) deleted.push(id);
    }
    return deleted;
  }
}

// Mock actor
export class MockActor {
  constructor(id = 'actor1', name = 'Test Actor') {
    this.id = id;
    this.name = name;
    this._cards = [];
  }

  get cards() {
    return this._cards;
  }
}

// Mock game object
export class MockGame {
  constructor(options = {}) {
    this.user = options.user || new MockUser();
    this.users = options.users || [this.user];
    this.cards = options.cards || new Map();
    this.actors = options.actors || new Map();
    this.i18n = {
      localize: (key) => key, // Return key as-is for testing
      format: (key, data) => {
        let str = key;
        for (const [k, v] of Object.entries(data)) {
          str = str.replace(`{${k}}`, v);
        }
        return str;
      }
    };

    // Add getName method to cards collection
    this.cards.getName = (name) => {
      for (const pile of this.cards.values()) {
        if (pile.name === name) return pile;
      }
      return null;
    };
  }

  // Helper to get cards by name
  getCardsPile(name) {
    for (const pile of this.cards.values()) {
      if (pile.name === name) return pile;
    }
    return null;
  }
}

// Mock UI notifications
export const mockUI = {
  notifications: {
    info: (message) => console.log('[INFO]', message),
    warn: (message) => console.warn('[WARN]', message),
    error: (message) => console.error('[ERROR]', message)
  }
};

// Mock ChatMessage
export class MockChatMessage {
  static async create(data, options = {}) {
    return new MockChatMessage(data);
  }

  constructor(data) {
    this.content = data.content;
    this.speaker = data.speaker;
    this.whisper = data.whisper;
  }
}

/**
 * Create a mock game instance with sensible defaults
 */
export function createMockGame(options = {}) {
  const users = options.users || [
    new MockUser('user1', 'Player1', false),
    new MockUser('user2', 'Player2', false),
    new MockUser('user3', 'Player3', false),
    new MockUser('gm', 'GameMaster', true)
  ];

  const cards = options.cards || [
    new MockCard({ id: 'c1', suit: 'hearts', value: 5 }),
    new MockCard({ id: 'c2', suit: 'spades', value: 8 }),
    new MockCard({ id: 'c3', suit: 'diamonds', value: 3 })
  ];

  const pile = new MockCardsPile(cards);
  const cardsMap = new Map([[pile.id, pile]]);

  return new MockGame({
    user: users[0],
    users,
    cards: cardsMap
  });
}

/**
 * Minimal jQuery-like stub supporting the `$('<div>').text(x).html()`
 * HTML-escaping pattern used by draw-round.mjs. Mirrors real browser
 * serialization: escapes `&`, `<`, `>` (element-content escaping) but not
 * `"`, since that's exactly what `.html()` does in a real DOM.
 */
export function mockJQuery() {
  let text = '';
  const wrapper = {
    text(value) {
      text = value == null ? '' : String(value);
      return wrapper;
    },
    html() {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  };
  return wrapper;
}

/**
 * Setup global mocks for tests
 */
export function setupGlobalMocks(game) {
  global.game = game;
  global.ui = mockUI;
  global.ChatMessage = MockChatMessage;
  global.$ = mockJQuery;
  global.CONST = { CARD_DRAW_MODES: { TOP: 0, BOTTOM: 1, RANDOM: 2, SHUFFLE: 3 } };
}

/**
 * Clean up global mocks after tests
 */
export function teardownGlobalMocks() {
  delete global.game;
  delete global.ui;
  delete global.ChatMessage;
  delete global.$;
  delete global.CONST;
}

/**
 * Create a MockCardsPile named "Mano", matching the real hand collection
 * executePlayerDraw looks up via `game.cards.getName('Mano')`.
 */
export function createHandPile(cards = []) {
  const hand = new MockCardsPile(cards);
  hand.id = 'hand1';
  hand.name = 'Mano';
  return hand;
}

/**
 * Create a Map with getName method for cards collection
 */
export function createCardsMap(entries = []) {
  const map = new Map(entries);
  map.getName = (name) => {
    for (const pile of map.values()) {
      if (pile.name === name) return pile;
    }
    return null;
  };
  return map;
}
