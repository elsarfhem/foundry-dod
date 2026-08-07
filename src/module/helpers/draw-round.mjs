/**
 * Individual actor card drawing functionality
 *
 * Manages a multi-step draw round where:
 * 1. Actors add cards to the pile
 * 2. Each actor draws their share independently
 * 3. System generates a summary when all have drawn
 *
 * Tracking is keyed by Actor id, not Foundry User id: a single user can
 * control more than one participating actor in the same round (their own
 * character plus another player's, or the GM acting on a disconnected
 * player's behalf) - each actor must count as its own participant. See
 * gm-relay.mjs#getRequesterActorIdentity for how the caller resolves which
 * actor is acting, and gm-card-actions.mjs for the GM-side handlers that
 * call into this module.
 *
 * State is stored in pile flags and follows this schema:
 * {
 *   actorsAdded: string[],    // Actor IDs who have added cards
 *   actorsDrawn: string[],    // Actor IDs who have drawn
 *   drawResults: Array<{      // Draw results for summary
 *     actorId: string,
 *     actorName: string,
 *     cards: Array<{id, name, suit}>,
 *     suits: {[suitName]: count}
 *   }>
 * }
 *
 * NFR Compliance:
 * - NFR #3: Race condition mitigation via read-verify-retry
 * - NFR #5: XSS prevention via HTML escaping
 * - NFR #6: Actor ID validation
 * - NFR #7: Error boundaries with try/catch
 * - NFR #8: Schema validation
 * - NFR #9: i18n for all user-facing strings
 */

import { drawCards } from './card-utils.mjs';
import { getCardsToDraw } from './card-utils.mjs';
import { showChatRequest, suitToName, renderCardThumbnail } from './chat.mjs';

/**
 * Get the pile document (cached lookup)
 * @returns {Cards|null} The Mazzo pile or null if not found
 */
function getPile() {
  return game.cards.getName('Mazzo');
}

/**
 * Validate round state schema
 * NFR #8: Schema validation
 * @param {*} state - State to validate
 * @returns {boolean} True if valid
 */
function isValidRoundState(state) {
  if (!state || typeof state !== 'object') return false;
  if (!Array.isArray(state.actorsAdded)) return false;
  if (!Array.isArray(state.actorsDrawn)) return false;
  if (!Array.isArray(state.drawResults)) return false;
  return true;
}

/**
 * Load current round state from pile flags
 * NFR #8: Schema validation
 * @returns {Object|null} Current round state or null if none/invalid
 */
export function loadRoundState() {
  const pile = getPile();
  if (!pile) return null;

  const state = pile.getFlag('dod', 'currentRound');
  if (!state) return null;

  // Validate schema
  if (!isValidRoundState(state)) {
    console.warn('[draw-round] Invalid state detected, clearing', state);
    // Clear invalid state asynchronously (don't block read)
    clearRoundState().catch((e) =>
      console.error('[draw-round] Failed to clear invalid state', e)
    );
    return null;
  }

  return state;
}

/**
 * Save round state to pile flags with race condition mitigation
 * NFR #3: Race condition mitigation - read-verify-retry pattern
 * NFR #7: Error boundary
 * @param {Object} state - State to save
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveRoundState(state) {
  try {
    const pile = getPile();
    if (!pile) {
      return { success: false, error: 'Pile not found' };
    }

    // Validate schema before saving
    if (!isValidRoundState(state)) {
      return { success: false, error: 'Invalid state schema' };
    }

    // Write state
    await pile.setFlag('dod', 'currentRound', state);

    // Verify write succeeded (NFR #3)
    const verified = pile.getFlag('dod', 'currentRound');
    if (!verified) {
      console.warn('[draw-round] Write verification failed, retrying once');
      // Retry once
      await pile.setFlag('dod', 'currentRound', state);
      const verified2 = pile.getFlag('dod', 'currentRound');
      if (!verified2) {
        return { success: false, error: 'Write verification failed after retry' };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[draw-round] saveRoundState failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear round state from pile flags
 * NFR #7: Error boundary
 * @returns {Promise<void>}
 */
export async function clearRoundState() {
  try {
    const pile = getPile();
    if (!pile) return;

    await pile.unsetFlag('dod', 'currentRound');
  } catch (error) {
    console.error('[draw-round] clearRoundState failed:', error);
  }
}

/**
 * Initialize a new round state
 * @returns {Object} New empty round state
 */
export function initializeRoundState() {
  return {
    actorsAdded: [],
    actorsDrawn: [],
    drawResults: []
  };
}

//
// Pure Query Functions (testable without Foundry mocks)
//

/**
 * Check if an actor can draw cards in the current round
 * @param {Object} state - Current round state
 * @param {string} actorId - Actor ID to check
 * @returns {boolean} True if actor can draw
 */
export function canActorDraw(state, actorId) {
  if (!state) return false;
  if (!state.actorsAdded.includes(actorId)) return false;
  if (state.actorsDrawn.includes(actorId)) return false;
  return true;
}

/**
 * Check if an actor has already added cards
 * @param {Object} state - Current round state
 * @param {string} actorId - Actor ID to check
 * @returns {boolean} True if actor has added
 */
export function hasActorAdded(state, actorId) {
  if (!state) return false;
  return state.actorsAdded.includes(actorId);
}

/**
 * Check if the round is complete (all actors who added have drawn)
 * @param {Object} state - Current round state
 * @returns {boolean} True if round is complete
 */
export function isRoundComplete(state) {
  if (!state) return false;
  if (state.actorsAdded.length === 0) return false;
  return state.actorsAdded.length === state.actorsDrawn.length;
}

/**
 * Calculate total cards to draw for all actors combined
 * Ensures at least one card per actor while respecting the base formula
 * @param {number} pileSize - Size of the pile
 * @param {number} actorCount - Number of actors
 * @returns {number} Total cards to draw
 */
function getTotalCardsToDraw(pileSize, actorCount) {
  const baseTotal = getCardsToDraw(pileSize, actorCount);
  // Ensure at least 1 card per actor
  return Math.max(actorCount, baseTotal);
}

/**
 * Calculate how many cards a specific actor should draw
 * @param {number} pileSize - Size of the pile
 * @param {number} actorCount - Total number of actors
 * @param {number} actorIndex - Index of this actor (0-based)
 * @returns {number} Cards for this actor to draw
 */
export function calculateDrawCount(pileSize, actorCount, actorIndex) {
  const totalCards = getTotalCardsToDraw(pileSize, actorCount);
  const baseCards = Math.floor(totalCards / actorCount);
  const extraCards = totalCards % actorCount;

  // First 'extraCards' actors get one extra card
  return actorIndex < extraCards ? baseCards + 1 : baseCards;
}

/**
 * Count cards by suit
 * @param {Array} cards - Array of card objects with 'suit' property
 * @returns {Object} Map of suit name to count
 */
export function countBySuit(cards) {
  const suits = {};
  for (const card of cards) {
    const suit = card.suit || card._source?.suit || 'unknown';
    suits[suit] = (suits[suit] || 0) + 1;
  }
  return suits;
}

//
// State Mutation Functions
//

/**
 * Record that an actor has added cards to the pile.
 * NFR #6: plausibility check happens on the GM handler
 * (gm-relay.mjs#assertKnownActor) before this is ever called - real
 * authorization rests on Foundry's document permissions for the shared
 * Cards stacks.
 * NFR #7: Error boundary
 * @param {string} actorId - Actor ID to record
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function recordActorAdded(actorId) {
  try {
    let state = loadRoundState();

    // Initialize state if needed
    if (!state) {
      state = initializeRoundState();
    }

    // Check if already added
    if (state.actorsAdded.includes(actorId)) {
      return { success: true }; // Idempotent
    }

    // Add actor to list
    state.actorsAdded.push(actorId);

    // Save state
    const result = await saveRoundState(state);
    return result;
  } catch (error) {
    console.error('[draw-round] recordActorAdded failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Undo a `recordActorAdded(actorId)` call - used to roll back the flag
 * update when the pile mutation that's supposed to follow it fails, so a
 * retry doesn't see the actor as already added without any cards to show
 * for it.
 * NFR #7: Error boundary
 * @param {string} actorId - Actor ID to remove from actorsAdded
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function unrecordActorAdded(actorId) {
  try {
    const state = loadRoundState();
    if (!state) return { success: true };

    const index = state.actorsAdded.indexOf(actorId);
    if (index === -1) return { success: true };

    state.actorsAdded.splice(index, 1);
    return await saveRoundState(state);
  } catch (error) {
    console.error('[draw-round] unrecordActorAdded failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute an actor draw operation.
 * NFR #4: Duplicate summary prevention - only this client generates summary
 *   (this always runs on the GM's client, serialized via withCardLock, so
 *   "the last actor to draw" is decided by a single process instead of
 *   racing per-client checks)
 * NFR #6: identity arrives explicitly as parameters instead of being read
 *   from `game.user`/`game.user.character`, which on the GM's client would
 *   always resolve to the GM, never the actual acting actor.
 * NFR #7: Error boundary
 * @param {string} actorId - Actor ID performing the draw
 * @param {string} actorName - Display name to attribute the draw to,
 *   resolved by the calling client before any relay (see
 *   gm-relay.mjs#getRequesterActorIdentity)
 * @param {string} callerUserId - The Foundry User who triggered this draw
 *   (may differ from the actor's owner, e.g. the GM acting on another
 *   player's behalf). Used ONLY to author the resulting chat message - the
 *   player stays the message's owner even though the actor's name is what
 *   gets displayed. Never persisted into `drawResult`/round state.
 * @returns {Promise<{success: boolean, error?: string, data?: Object}>}
 */
export async function executeActorDraw(actorId, actorName, callerUserId) {
  try {
    const pile = getPile();
    if (!pile) {
      return {
        success: false,
        error: 'DECK_OF_DESTINY.messages.DrawRound.Error.PileNotFound'
      };
    }

    const state = loadRoundState();

    // Validation checks
    if (!state) {
      return {
        success: false,
        error: 'DECK_OF_DESTINY.messages.DrawRound.Error.NotAdded'
      };
    }

    if (!state.actorsAdded.includes(actorId)) {
      return {
        success: false,
        error: 'DECK_OF_DESTINY.messages.DrawRound.Error.NotAdded'
      };
    }

    if (state.actorsDrawn.includes(actorId)) {
      return {
        success: false,
        error: 'DECK_OF_DESTINY.messages.DrawRound.Error.AlreadyDrawn'
      };
    }

    // Get the shared hand (uses shared "Mano" cards collection)
    const hand = game.cards.getName('Mano');
    if (!hand) {
      return {
        success: false,
        error: 'DECK_OF_DESTINY.messages.DrawRound.Error.NoHand'
      };
    }

    // Calculate draw count for this actor
    // Find actor index in the list to determine card distribution
    const actorIndex = state.actorsDrawn.length; // Current actor is the Nth to draw
    const drawCount = calculateDrawCount(
      pile.cards.size,
      state.actorsAdded.length,
      actorIndex
    );

    // Draw cards randomly
    const drawnCards = await drawCards(hand, pile, drawCount, {
      how: CONST.CARD_DRAW_MODES.RANDOM,
      chatNotification: false
    });

    if (!drawnCards || drawnCards.length === 0) {
      return {
        success: false,
        error: 'DECK_OF_DESTINY.messages.DrawRound.Error.DrawFailed'
      };
    }

    // Record draw result with the caller-resolved actor identity. The
    // caller's own userId (callerUserId) deliberately does NOT go into this
    // object - it's only needed transiently, to author the chat message
    // below, not as part of the persisted round state.
    const drawResult = {
      actorId,
      actorName,
      cards: drawnCards.map((c) => ({
        id: c.id,
        name: c.name,
        suit: c.suit || c._source?.suit || 'unknown',
        img: c.img
      })),
      suits: countBySuit(drawnCards)
    };

    // Update state
    state.actorsDrawn.push(actorId);
    state.drawResults.push(drawResult);

    // Save state
    const saveResult = await saveRoundState(state);
    if (!saveResult.success) {
      return saveResult;
    }

    // Both chat messages for this draw are posted here, GM-side, in the
    // order they actually happened - not by the calling client after a
    // round-trip back. Two actors' draws are already serialized by
    // withCardLock (see gm-card-actions.mjs#gmExecutePlayerDraw); if the
    // "Player Draw" message were posted by each caller's own client
    // instead, its extra network round-trip could let a later actor's
    // summary (posted immediately, GM-side) land in chat before an earlier
    // actor's own draw message finished posting.
    generatePlayerDrawMessage(drawResult, state.actorsAdded.length, callerUserId);

    // Check if round is complete and generate summary
    // NFR #4: Only this client generates summary (prevents duplicates) -
    // this stays here (GM-side) because only the GM's serialized queue can
    // determine "round complete" exactly-once across every actor.
    const roundComplete = isRoundComplete(state);
    if (roundComplete) {
      await generateSummary(state);
    }

    return {
      success: true,
      data: {
        drawnCount: drawnCards.length,
        roundComplete,
        drawResult,
        actorsAddedCount: state.actorsAdded.length
      }
    };
  } catch (error) {
    console.error('[draw-round] executeActorDraw failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate and post individual actor draw chat message. Always runs on the
 * GM's client (see the comment in executeActorDraw's caller above). The
 * message is authored by `callerUserId` (the player stays the message's
 * owner) but its body displays `drawResult.actorName` - the two can differ,
 * e.g. when the GM draws on behalf of another player's actor.
 * NFR #5: XSS prevention via HTML escaping
 * NFR #9: i18n strings
 * @param {Object} drawResult - Actor draw result {actorId, actorName, cards, suits}
 * @param {number} actorsNum - Number of actors in the round
 * @param {string} callerUserId - Foundry User id to author the ChatMessage as
 * @returns {void}
 */
function generatePlayerDrawMessage(drawResult, actorsNum, callerUserId) {
  try {
    // HTML-escape actor name (NFR #5)
    const safeName = $('<div>').text(drawResult.actorName).html();

    // Build cards info with flex layout
    const lines = [];
    lines.push('<div class="draw-message-content">');
    lines.push(
      `<div class="draw-info-row"><strong>${safeName}</strong> ${game.i18n
        .localize('DECK_OF_DESTINY.messages.DrawRound.YouDrew', {
          count: drawResult.cards.length
        })
        .replace('{count}', drawResult.cards.length)}</div>`
    );

    // Add suit counts (name lookup lets special-card suits display by name)
    const suitNames = new Map();
    drawResult.cards.forEach((c) => {
      if (!suitNames.has(c.suit)) suitNames.set(c.suit, c.name);
    });
    const suitCounts = Object.entries(drawResult.suits)
      .map(([suit, count]) => `${suitToName(suit, suitNames.get(suit))}: ${count}`)
      .join(', ');
    lines.push(`<div class="draw-info-row">${suitCounts}</div>`);

    // Add card thumbnails with zoom effect
    const cardsHtml = drawResult.cards
      .map((card) => renderCardThumbnail(card))
      .join('');
    lines.push(`<div class="card-draw flexrow">${cardsHtml}</div>`);
    lines.push('</div>');

    // Determine button visibility
    const successCount =
      drawResult.suits['success'] || drawResult.suits['Success'] || 0;
    const failureCount =
      drawResult.suits['failure'] || drawResult.suits['Failure'] || 0;
    const fortuneCount =
      drawResult.suits['fortune'] || drawResult.suits['Fortune'] || 0;

    // Build button data (same pattern as summary)
    const buttons = [
      {
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.viewHand'),
        icon: 'fas fa-hand-paper',
        color: '#d9d7c8',
        borderColor: '#b5b3a4',
        actionKey: 'viewHand'
      },
      {
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.viewDeck'),
        icon: 'fas fa-eye',
        color: '#aaaaff',
        borderColor: '#0000cc',
        actionKey: 'viewDeck'
      },
      {
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.emptyDeck'),
        icon: 'fas fa-trash',
        color: '#ffaaaa',
        borderColor: '#cc0000',
        actionKey: 'emptyDeck'
      }
    ];

    // Add conditional buttons
    if (actorsNum > 1 && fortuneCount > 0) {
      buttons.push({
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.divideFortune'),
        icon: 'fas fa-share-alt',
        color: '#b7ffaa',
        borderColor: '#00ff3c',
        actionKey: 'divideFortune'
      });
    }

    if (successCount <= failureCount && failureCount <= successCount + fortuneCount) {
      buttons.push({
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.risk'),
        icon: 'fas fa-dice',
        color: '#ffccaa',
        borderColor: '#ff9900',
        actionKey: 'risk'
      });
    }

    // Use showChatRequest to create message with buttons
    showChatRequest({
      title: game.i18n.localize('DECK_OF_DESTINY.messages.DrawRound.PlayerDraw'),
      description: lines.join(''),
      buttonData: buttons,
      userId: callerUserId
    });
  } catch (error) {
    console.error('[draw-round] generatePlayerDrawMessage failed:', error);
  }
}

/**
 * Generate and post summary chat message for completed round
 * NFR #5: XSS prevention via HTML escaping
 * NFR #9: i18n strings
 * @param {Object} state - Completed round state
 * @returns {Promise<void>}
 */
export async function generateSummary(state) {
  try {
    // Calculate totals by suit (name lookup lets special-card suits display by name)
    const totalSuits = {};
    const suitNames = new Map();
    for (const result of state.drawResults) {
      for (const [suit, count] of Object.entries(result.suits)) {
        totalSuits[suit] = (totalSuits[suit] || 0) + count;
      }
      result.cards.forEach((c) => {
        if (!suitNames.has(c.suit)) suitNames.set(c.suit, c.name);
      });
    }

    const successCount = totalSuits['success'] || totalSuits['Success'] || 0;
    const failureCount = totalSuits['failure'] || totalSuits['Failure'] || 0;
    const fortuneCount = totalSuits['fortune'] || totalSuits['Fortune'] || 0;
    const totalCards = state.drawResults.reduce((sum, r) => sum + r.cards.length, 0);

    // Build actor results with flex layout
    const lines = [];
    lines.push('<div class="draw-summary-content">');

    for (const result of state.drawResults) {
      // HTML-escape actor name (NFR #5)
      const safeName = $('<div>').text(result.actorName).html();

      const suitCounts = Object.entries(result.suits)
        .map(([suit, count]) => `${suitToName(suit, suitNames.get(suit))}: ${count}`)
        .join(', ');

      lines.push('<div class="player-result">');
      lines.push(
        `<div class="player-result-row"><strong>${safeName}</strong>: ${
          result.cards.length
        } ${game.i18n.localize(
          'DECK_OF_DESTINY.messages.DrawRound.Summary.Cards'
        )} - ${suitCounts}</div>`
      );

      // Add card thumbnails for this actor
      const cardsHtml = result.cards.map((card) => renderCardThumbnail(card)).join('');
      lines.push(`<div class="card-draw flexrow">${cardsHtml}</div>`);
      lines.push('</div>');
    }

    lines.push('</div>');

    // Add totals
    lines.push(
      `<p><strong>${game.i18n.localize(
        'DECK_OF_DESTINY.messages.DrawRound.Summary.Total'
      )}:</strong> ${totalCards} ${game.i18n.localize(
        'DECK_OF_DESTINY.messages.DrawRound.Summary.Extracted'
      )}</p>`
    );

    // Format total by suit with localized names
    const totalBySuitFormatted = Object.entries(totalSuits)
      .map(
        ([suit, count]) => `<li>${suitToName(suit, suitNames.get(suit))}: ${count}</li>`
      )
      .join('');

    lines.push(`<ul class="suit-list">${totalBySuitFormatted}</ul>`);

    // Determine test result based on success vs failure
    let resultMessage = '';
    let resultClass = '';

    if (successCount > failureCount) {
      resultMessage = game.i18n.localize(
        'DECK_OF_DESTINY.messages.DrawRound.Summary.TestPassed'
      );
      resultClass = 'test-passed';
    } else if (successCount === failureCount) {
      resultMessage = game.i18n.localize(
        'DECK_OF_DESTINY.messages.DrawRound.Summary.TestDeadlock'
      );
      resultClass = 'test-deadlock';
    } else {
      resultMessage = game.i18n.localize(
        'DECK_OF_DESTINY.messages.DrawRound.Summary.TestFailed'
      );
      resultClass = 'test-failed';
    }

    lines.push(
      `<p class="test-result ${resultClass}"><strong>${resultMessage}</strong></p>`
    );

    // Build button data (same pattern as createDrawChat)
    const buttons = [
      {
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.viewHand'),
        icon: 'fas fa-hand-paper',
        color: '#d9d7c8',
        borderColor: '#b5b3a4',
        actionKey: 'viewHand'
      },
      {
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.viewDeck'),
        icon: 'fas fa-eye',
        color: '#aaaaff',
        borderColor: '#0000cc',
        actionKey: 'viewDeck'
      },
      {
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.emptyDeck'),
        icon: 'fas fa-trash',
        color: '#ffaaaa',
        borderColor: '#cc0000',
        actionKey: 'emptyDeck'
      }
    ];

    // Add conditional buttons based on card results
    const actorsNum = state.actorsAdded.length;

    if (actorsNum > 1 && fortuneCount > 0) {
      buttons.push({
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.divideFortune'),
        icon: 'fas fa-share-alt',
        color: '#b7ffaa',
        borderColor: '#00ff3c',
        actionKey: 'divideFortune'
      });
    }

    if (successCount <= failureCount && failureCount <= successCount + fortuneCount) {
      buttons.push({
        label: game.i18n.localize('DECK_OF_DESTINY.chat.buttons.risk'),
        icon: 'fas fa-dice',
        color: '#ffccaa',
        borderColor: '#ff9900',
        actionKey: 'risk'
      });
    }

    // Use showChatRequest to create message with buttons
    showChatRequest({
      title: game.i18n.localize('DECK_OF_DESTINY.messages.DrawRound.Summary.Title'),
      description: lines.join(''),
      buttonData: buttons
    });
  } catch (error) {
    console.error('[draw-round] generateSummary failed:', error);
  }
}
