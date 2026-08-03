/**
 * Card transfer utilities with state synchronization.
 *
 * Concurrency is handled by the operation lock (withCardLock) in globals.mjs,
 * which prevents multiple card operations from running simultaneously.
 * These utilities provide:
 *
 * 1. Pre-validation: card IDs / counts are checked against current state
 *    before each operation to avoid sending stale requests.
 *
 * 2. Post-sync: after a pass() completes on the server, the local
 *    EmbeddedCollection may lag behind. waitForCardsSync() polls until
 *    the target reflects the transferred cards.
 */

/**
 * Pass cards from one collection to another.
 * Filters out card IDs that are no longer present in the source before
 * attempting the transfer.
 *
 * @param {Cards} source - Source card collection (e.g., deck)
 * @param {Cards} target - Target card collection (e.g., pile)
 * @param {string[]} cardIds - Array of card document IDs to transfer
 * @param {object} [options={}] - Options passed to Cards#pass()
 * @returns {Promise<Card[]>} Array of transferred Card documents (may be empty)
 */
async function passCards(source, target, cardIds, options = {}) {
  const validIds = cardIds.filter((id) => source.cards.has(id));
  if (!validIds.length) {
    console.warn(
      `DoD | passCards: no valid card IDs remaining in "${source.name}" after filtering`
    );
    return [];
  }
  return await source.pass(target, validIds, options);
}

/**
 * Draw cards from a source collection.
 * Adjusts the draw count to the actual available cards.
 *
 * @param {Cards} hand - Target hand collection to draw into
 * @param {Cards} source - Source collection to draw from (e.g., pile)
 * @param {number} count - Number of cards to draw
 * @param {object} [options={}] - Options passed to Cards#draw()
 * @returns {Promise<Card[]>} Array of drawn Card documents (may be empty)
 */
export async function drawCards(hand, source, count, options = {}) {
  const available = source.cards.size;
  if (available === 0) {
    console.warn(`DoD | drawCards: source "${source.name}" is empty, nothing to draw`);
    return [];
  }
  const safeCount = Math.min(count, available);
  return await hand.draw(source, safeCount, options);
}

/**
 * Pass cards by suit counts.
 * Selects available cards from the source matching the requested suits.
 *
 * @param {Cards} source - Source card collection (e.g., deck)
 * @param {Cards} target - Target card collection (e.g., pile)
 * @param {Object<string, number>} suitCounts - Map of suit name to count
 *   e.g. { success: 2, failure: 1, white: 5 }
 * @param {object} [options={}] - Options passed to Cards#pass()
 * @returns {Promise<Card[]>} Array of transferred Card documents (may be empty)
 */
async function passCardsBySuit(source, target, suitCounts, options = {}) {
  const cardIds = [];
  for (const [suit, count] of Object.entries(suitCounts)) {
    if (count <= 0) continue;
    const available = source.cards.filter((c) => c.suit === suit && !c.drawn);
    cardIds.push(...available.slice(0, count).map((c) => c.id));
  }
  if (!cardIds.length) {
    console.warn(
      `DoD | passCardsBySuit: no available cards in "${source.name}" for requested suits`
    );
    return [];
  }
  return await source.pass(target, cardIds, options);
}

/**
 * Wait for a Cards collection's local EmbeddedCollection to reflect expected
 * cards after a pass/transfer operation.
 *
 * After Cards#pass() resolves, the server has committed the transfer but the
 * calling client's local EmbeddedCollection updates asynchronously via
 * WebSocket. A subsequent draw() that reads from the stale local state can
 * reference card IDs the server no longer associates with that collection.
 *
 * This helper polls the target collection until the expected card IDs appear
 * locally, with a short timeout fallback.
 *
 * @param {Cards} target - The card collection that should contain the cards
 * @param {string[]} expectedIds - Card IDs expected to be present after the pass
 * @param {number} [timeout=1000] - Maximum time to wait in ms
 * @returns {Promise<void>}
 */
async function waitForCardsSync(target, expectedIds, timeout = 1000) {
  if (!expectedIds?.length) return;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const allPresent = expectedIds.every((id) => target.cards.has(id));
    if (allPresent) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  console.warn(
    `DoD | waitForCardsSync: timed out waiting for ${expectedIds.length} cards in "${target.name}"`
  );
}

/**
 * Pass cards by suit then wait for the target collection to sync.
 *
 * @param {Cards} source - Source card collection
 * @param {Cards} target - Target card collection
 * @param {Object<string, number>} suitCounts - Map of suit name to count
 * @param {object} [options={}] - Options passed to Cards#pass()
 * @returns {Promise<Card[]>} Array of transferred Card documents
 */
async function passCardsBySuitAndSync(source, target, suitCounts, options = {}) {
  const passed = await passCardsBySuit(source, target, suitCounts, options);
  if (passed?.length) {
    const ids = passed.map((c) => c.id);
    await waitForCardsSync(target, ids);
  }
  return passed;
}

/**
 * Pass cards by IDs then wait for the target collection to sync.
 *
 * @param {Cards} source - Source card collection
 * @param {Cards} target - Target card collection
 * @param {string[]} cardIds - Card document IDs to transfer
 * @param {object} [options={}] - Options passed to Cards#pass()
 * @returns {Promise<Card[]>} Array of transferred Card documents
 */
async function passCardsAndSync(source, target, cardIds, options = {}) {
  const passed = await passCards(source, target, cardIds, options);
  if (passed?.length) {
    const ids = passed.map((c) => c.id);
    await waitForCardsSync(target, ids);
  }
  return passed;
}

/**
 * Calculate the number of cards to draw from the pile based on pile size and number of players.
 * @param {number} pileSize - The number of cards in the pile.
 * @param {number} players - The number of players.
 * @returns {number} The number of cards to draw.
 */
export function getCardsToDraw(pileSize, players) {
  return Math.max(1, Math.floor(pileSize / (4 + players)));
}

/**
 * Minimum number of cards the play pile should hold, topped up with white
 * (blank) filler cards from the deck. Shared by every function that seeds or
 * tops up the pile so the "20 cards" rule lives in a single place.
 */
export const MINIMUM_PILE_SIZE = 20;

/**
 * Pure helper: how many filler cards are needed to bring a pile up to size.
 * @param {number} pileSize - Current number of cards in the pile.
 * @param {number} [minSize=MINIMUM_PILE_SIZE] - Target minimum pile size.
 * @returns {number} Cards needed (never negative).
 */
export function getCardsNeededToFillPile(pileSize, minSize = MINIMUM_PILE_SIZE) {
  return Math.max(0, minSize - pileSize);
}

/**
 * Pure helper: how many white filler cards newly-added cards should replace.
 * Replacement never exceeds either the white cards actually available in the
 * pile or the number of new cards being added.
 * @param {number} whiteCountInPile - White cards currently in the pile.
 * @param {number} newCardsCount - Cards about to be added to the pile.
 * @returns {number} White cards to remove from the pile.
 */
export function getWhiteCardsToReplace(whiteCountInPile, newCardsCount) {
  return Math.max(0, Math.min(whiteCountInPile, newCardsCount));
}

/**
 * Top up the pile with white filler cards from the deck up to minSize.
 * Intended to be called right after the pile is emptied (e.g. after a
 * deck.recall()) so it always starts a new round at the minimum size.
 *
 * @param {Cards} deck - Source deck containing the white filler cards.
 * @param {Cards} pile - Target pile to fill.
 * @param {number} [minSize=MINIMUM_PILE_SIZE] - Target minimum pile size.
 * @returns {Promise<Card[]>} White cards moved into the pile (may be empty).
 */
export async function refillPileWithWhite(deck, pile, minSize = MINIMUM_PILE_SIZE) {
  const needed = getCardsNeededToFillPile(pile.cards.size, minSize);
  if (!needed) return [];
  const whiteCards = deck.availableCards
    .filter((c) => c.suit === 'white')
    .slice(0, needed);
  if (!whiteCards.length) return [];
  return await passCardsAndSync(
    deck,
    pile,
    whiteCards.map((c) => c.id),
    { chatNotification: false }
  );
}

/**
 * Add cards to the pile, replacing white filler cards one-for-one while any
 * remain. Once the pile has no white cards left, further cards are simply
 * added on top (pile grows past its minimum size), matching how a real deck
 * behaves once its blank padding runs out.
 *
 * @param {Cards} deck - Source deck to pull the new cards and (if needed) white cards from.
 * @param {Cards} pile - Target pile receiving the new cards.
 * @param {Object<string, number>} suitCounts - Map of suit name to count to add (e.g. { success: 2, 'special:abc': 1 }).
 * @param {object} [options={}] - Options passed to Cards#pass()
 * @returns {Promise<Card[]>} The newly added (non-white) cards (may be empty).
 */
export async function addCardsReplacingWhite(deck, pile, suitCounts, options = {}) {
  const newCardsCount = Object.values(suitCounts).reduce(
    (sum, count) => sum + Math.max(0, count),
    0
  );
  if (newCardsCount > 0) {
    // Note: no `!c.drawn` check here, unlike passCardsBySuit. `drawn` means
    // "no longer in its origin deck" - every card sitting in the pile got
    // there via pass()/draw() and is therefore always drawn=true. Filtering
    // it out here would always yield zero white cards to replace.
    const whiteInPile = pile.cards.filter((c) => c.suit === 'white');
    const numToReplace = getWhiteCardsToReplace(whiteInPile.length, newCardsCount);
    if (numToReplace > 0) {
      await passCardsAndSync(
        pile,
        deck,
        whiteInPile.slice(0, numToReplace).map((c) => c.id),
        options
      );
    }
  }
  return await passCardsBySuitAndSync(deck, pile, suitCounts, options);
}
