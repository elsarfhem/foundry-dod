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
export async function passCards(source, target, cardIds, options = {}) {
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
export async function passCardsBySuit(source, target, suitCounts, options = {}) {
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
export async function waitForCardsSync(target, expectedIds, timeout = 1000) {
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
export async function passCardsBySuitAndSync(source, target, suitCounts, options = {}) {
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
export async function passCardsAndSync(source, target, cardIds, options = {}) {
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
