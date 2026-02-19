/**
 * Safe card transfer utilities to prevent race conditions.
 *
 * Two distinct issues are addressed:
 *
 * 1. Multi-player concurrency: card IDs are resolved client-side from potentially
 *    stale state, then sent to the server. If another client has already moved
 *    those cards, the server throws "card with document id is not present".
 *
 * 2. Single-player state desync: after a pass() completes on the server, the
 *    local EmbeddedCollection may not yet reflect the changes when the next
 *    operation (e.g. draw()) reads from it. This causes "card not present"
 *    errors even with a single player.
 *
 * These wrappers add retry logic with fresh validation on each attempt,
 * plus a brief backoff delay to allow local state to sync with the server.
 */

const MAX_RETRIES = 3;

/**
 * Safely pass cards from one collection to another with retry logic.
 * Filters out card IDs that are no longer present in the source before each attempt.
 *
 * @param {Cards} source - Source card collection (e.g., deck)
 * @param {Cards} target - Target card collection (e.g., pile)
 * @param {string[]} cardIds - Array of card document IDs to transfer
 * @param {object} [options={}] - Options passed to Cards#pass()
 * @returns {Promise<Card[]>} Array of transferred Card documents (may be empty)
 */
export async function safePass(source, target, cardIds, options = {}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Re-validate card IDs against current source state each attempt
    const validIds = cardIds.filter((id) => source.cards.has(id));
    if (!validIds.length) {
      console.warn(
        `DoD | safePass: no valid card IDs remaining in "${source.name}" after filtering`
      );
      return [];
    }
    try {
      return await source.pass(target, validIds, options);
    } catch (err) {
      if (attempt < MAX_RETRIES && isCardNotPresentError(err)) {
        console.warn(
          `DoD | safePass attempt ${
            attempt + 1
          } failed (concurrent modification), retrying...`,
          err.message
        );
        // Brief backoff to allow local state to sync with server
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      console.error(`DoD | safePass failed after ${MAX_RETRIES + 1} attempts`, err);
      ui.notifications.error('Failed to pass cards. Please try again.');
      throw err;
    }
  }
  return [];
}

/**
 * Safely draw cards from a source collection with retry logic.
 * Adjusts the draw count to the actual available cards before each attempt.
 *
 * @param {Cards} hand - Target hand collection to draw into
 * @param {Cards} source - Source collection to draw from (e.g., pile)
 * @param {number} count - Number of cards to draw
 * @param {object} [options={}] - Options passed to Cards#draw()
 * @returns {Promise<Card[]>} Array of drawn Card documents (may be empty)
 */
export async function safeDraw(hand, source, count, options = {}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const available = source.cards.size;
    if (available === 0) {
      console.warn(`DoD | safeDraw: source "${source.name}" is empty, nothing to draw`);
      return [];
    }
    const safeCount = Math.min(count, available);
    try {
      return await hand.draw(source, safeCount, options);
    } catch (err) {
      if (attempt < MAX_RETRIES && isCardNotPresentError(err)) {
        console.warn(
          `DoD | safeDraw attempt ${
            attempt + 1
          } failed (concurrent modification), retrying...`,
          err.message
        );
        // Brief backoff to allow local state to sync with server
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      console.error(`DoD | safeDraw failed after ${MAX_RETRIES + 1} attempts`, err);
      ui.notifications.error('Failed to draw cards. Please try again.');
      throw err;
    }
  }
  return [];
}

/**
 * Safely pass cards by suit counts with retry logic.
 * Re-selects available cards from the source on each attempt, so even if
 * specific card IDs became stale, other cards of the same suit can be used.
 *
 * @param {Cards} source - Source card collection (e.g., deck)
 * @param {Cards} target - Target card collection (e.g., pile)
 * @param {Object<string, number>} suitCounts - Map of suit name to count
 *   e.g. { success: 2, failure: 1, white: 5 }
 * @param {object} [options={}] - Options passed to Cards#pass()
 * @returns {Promise<Card[]>} Array of transferred Card documents (may be empty)
 */
export async function safePassBySuit(source, target, suitCounts, options = {}) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const cardIds = [];
    for (const [suit, count] of Object.entries(suitCounts)) {
      if (count <= 0) continue;
      const available = source.cards.filter((c) => c.suit === suit && !c.drawn);
      cardIds.push(...available.slice(0, count).map((c) => c.id));
    }
    if (!cardIds.length) {
      console.warn(
        `DoD | safePassBySuit: no available cards in "${source.name}" for requested suits`
      );
      return [];
    }
    try {
      return await source.pass(target, cardIds, options);
    } catch (err) {
      if (attempt < MAX_RETRIES && isCardNotPresentError(err)) {
        console.warn(
          `DoD | safePassBySuit attempt ${
            attempt + 1
          } failed (concurrent modification), retrying...`,
          err.message
        );
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      console.error(
        `DoD | safePassBySuit failed after ${MAX_RETRIES + 1} attempts`,
        err
      );
      ui.notifications.error('Failed to pass cards. Please try again.');
      throw err;
    }
  }
  return [];
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
 * Convenience wrapper: pass cards then wait for the target collection to sync.
 * Returns the passed cards array.
 *
 * @param {Cards} source - Source card collection
 * @param {Cards} target - Target card collection
 * @param {Object<string, number>} suitCounts - Map of suit name to count
 * @param {object} [options={}] - Options passed to Cards#pass()
 * @returns {Promise<Card[]>} Array of transferred Card documents
 */
export async function safePassBySuitAndSync(source, target, suitCounts, options = {}) {
  const passed = await safePassBySuit(source, target, suitCounts, options);
  if (passed?.length) {
    const ids = passed.map((c) => c.id);
    await waitForCardsSync(target, ids);
  }
  return passed;
}

/**
 * Convenience wrapper: pass cards by IDs then wait for the target to sync.
 *
 * @param {Cards} source - Source card collection
 * @param {Cards} target - Target card collection
 * @param {string[]} cardIds - Card document IDs to transfer
 * @param {object} [options={}] - Options passed to Cards#pass()
 * @returns {Promise<Card[]>} Array of transferred Card documents
 */
export async function safePassAndSync(source, target, cardIds, options = {}) {
  const passed = await safePass(source, target, cardIds, options);
  if (passed?.length) {
    const ids = passed.map((c) => c.id);
    await waitForCardsSync(target, ids);
  }
  return passed;
}

/**
 * Check if an error is the "card not present" concurrency error.
 * Matches both v12 "not present" and v13 "does not exist" messages.
 * @param {Error} err
 * @returns {boolean}
 */
function isCardNotPresentError(err) {
  return /not present|does not exist/i.test(err?.message);
}
