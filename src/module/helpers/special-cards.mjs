/**
 * Special card definitions.
 *
 * Special cards are ordinary Card documents living in the master deck
 * ("DoD - lista carte"), each identified by a unique `suit` value of the
 * form `special:<randomId>` generated once at creation and never changed
 * (even if the card is later renamed). Because every card-pipeline helper
 * (passCardsBySuit, the rischia draw loop, createDrawChat, etc.) already
 * treats `suit` as a generic matching key, special cards work with those
 * helpers unmodified — they're just another suit value as far as the
 * pipeline is concerned.
 */

export const SPECIAL_SUIT_PREFIX = 'special:';

/**
 * Generate a new unique suit value for a special card definition.
 * @returns {string}
 */
export function generateSpecialSuit() {
  const randomPart = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(
    36
  )}`;
  return `${SPECIAL_SUIT_PREFIX}${randomPart}`;
}

/**
 * Whether a suit value identifies a special card definition.
 * @param {string} suit
 * @returns {boolean}
 */
export function isSpecialSuit(suit) {
  return typeof suit === 'string' && suit.startsWith(SPECIAL_SUIT_PREFIX);
}

/**
 * List every distinct special card definition currently present in a Cards
 * document, along with how many un-drawn copies are available.
 * @param {Cards} deck
 * @returns {Array<{suit: string, name: string, description: string, img: string|null, available: number}>}
 */
export function getSpecialCardDefinitions(deck) {
  const bySuit = new Map();
  for (const card of deck.cards.values()) {
    if (!isSpecialSuit(card.suit)) continue;
    if (!bySuit.has(card.suit)) {
      bySuit.set(card.suit, {
        suit: card.suit,
        name: card.name,
        description: card.description,
        img: card.faces?.[0]?.img ?? null,
        available: 0
      });
    }
    if (!card.drawn) {
      bySuit.get(card.suit).available++;
    }
  }
  return Array.from(bySuit.values());
}

/**
 * Build the Card creation data for one copy of a special card.
 * @param {{suit: string, name: string, description: string, img: string|null}} definition
 * @returns {object}
 */
export function buildSpecialCardData({ suit, name, description, img }) {
  return {
    name,
    type: 'base',
    description,
    suit,
    value: 0,
    back: { name: '', text: '', img: 'systems/dod/assets/cards/back.png' },
    faces: [{ name, img: img || null, text: description }],
    face: 0,
    drawn: false
  };
}

/**
 * Create a brand-new special card definition with the given number of
 * copies in the master deck.
 * @param {Cards} deck
 * @param {{name: string, description: string, img: string|null, copies: number}} data
 * @returns {Promise<string>} the generated suit
 */
export async function createSpecialCardDefinition(
  deck,
  { name, description, img, copies }
) {
  const suit = generateSpecialSuit();
  const cardsData = Array.from({ length: copies }, () =>
    buildSpecialCardData({ suit, name, description, img })
  );
  await deck.createEmbeddedDocuments('Card', cardsData);
  return suit;
}

/**
 * Update name/description/image on every copy of a special card definition,
 * across every Cards document it currently appears in (master deck, pile,
 * hand).
 * @param {Cards[]} cardsDocuments
 * @param {string} suit
 * @param {{name: string, description: string, img: string|null}} data
 * @returns {Promise<void>}
 */
export async function updateSpecialCardDefinition(
  cardsDocuments,
  suit,
  { name, description, img }
) {
  for (const doc of cardsDocuments) {
    const matches = Array.from(doc.cards.values()).filter((c) => c.suit === suit);
    if (!matches.length) continue;
    const updates = matches.map((card) => ({
      _id: card.id,
      name,
      description,
      faces: [{ name, img: img || null, text: description }]
    }));
    await doc.updateEmbeddedDocuments('Card', updates);
  }
}

/**
 * Increase or decrease the number of copies of a special card definition in
 * the master deck. Decreasing never removes copies that are already drawn
 * (out in the pile or a hand) — if fewer un-drawn copies exist than
 * requested, deletes what's available and reports the shortfall.
 * @param {Cards} deck
 * @param {string} suit
 * @param {number} desiredCount
 * @param {{name: string, description: string, img: string|null}} template
 * @returns {Promise<{created: number, deleted: number, shortfall: number}>}
 */
export async function adjustSpecialCardCopies(deck, suit, desiredCount, template) {
  const current = Array.from(deck.cards.values()).filter((c) => c.suit === suit);
  const currentAvailable = current.filter((c) => !c.drawn);
  const delta = desiredCount - current.length;

  if (delta > 0) {
    const cardsData = Array.from({ length: delta }, () =>
      buildSpecialCardData({ suit, ...template })
    );
    await deck.createEmbeddedDocuments('Card', cardsData);
    return { created: delta, deleted: 0, shortfall: 0 };
  }

  if (delta < 0) {
    const requestedDeletion = -delta;
    const toDelete = currentAvailable.slice(0, requestedDeletion);
    if (toDelete.length) {
      await deck.deleteEmbeddedDocuments(
        'Card',
        toDelete.map((c) => c.id)
      );
    }
    return {
      created: 0,
      deleted: toDelete.length,
      shortfall: requestedDeletion - toDelete.length
    };
  }

  return { created: 0, deleted: 0, shortfall: 0 };
}

/**
 * Delete every copy of a special card definition, across every Cards
 * document it currently appears in (master deck, pile, hand).
 * @param {Cards[]} cardsDocuments
 * @param {string} suit
 * @returns {Promise<void>}
 */
export async function deleteSpecialCardDefinition(cardsDocuments, suit) {
  for (const doc of cardsDocuments) {
    const ids = Array.from(doc.cards.values())
      .filter((c) => c.suit === suit)
      .map((c) => c.id);
    if (ids.length) {
      await doc.deleteEmbeddedDocuments('Card', ids);
    }
  }
}
