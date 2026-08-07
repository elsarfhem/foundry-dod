/**
 * GM-side handlers for cross-client card actions.
 *
 * These run exclusively on the GM's own client - either directly (the
 * acting user IS the GM, see gm-relay.mjs's local fast path) or via a
 * socketlib relay from another player's client. Each wraps its mutation in
 * `withCardLock` (globals.mjs), which is what actually serializes these
 * against each other and against any macro the GM runs directly - one
 * shared queue per GM process.
 *
 * None of these read `game.user` for identity: the acting player's
 * `{userId, displayName}` always arrives explicitly in the payload,
 * captured on their own client before the relay (see
 * gm-relay.mjs#getRequesterIdentity). On the GM's client, `game.user`
 * would always resolve to the GM, never the original caller.
 *
 * Most of these don't post ChatMessages - the calling client posts its own,
 * using the data returned here, since it has a correct, non-fakeable
 * game.user for itself. Where the caller's own copy of a shared document
 * could be stale right after a relay (pile totals, drawn cards), the data
 * needed is returned explicitly instead of expecting the caller to re-read
 * the document locally. The exception is executePlayerDrawCore, which posts
 * both the individual draw message and (once the round completes) the
 * summary itself, GM-side, in that order - so two players' draws can never
 * post out of order the way a caller-side network round-trip could cause.
 * Only the individual draw message is attributed to the drawing player via
 * an explicit `user` id (see chat.mjs#showChatRequest); the round summary
 * stays GM-attributed, as it always has, since it's a narrated recap of
 * everyone's draws rather than one player's own message.
 */

import { withCardLock } from '../globals.mjs';
import {
  drawCards,
  addCardsReplacingWhite,
  refillPileWithWhite,
  getCardsToDraw
} from './card-utils.mjs';
import {
  recordPlayerAdded as recordPlayerAddedCore,
  executePlayerDraw as executePlayerDrawCore,
  clearRoundState
} from './draw-round.mjs';
import { assertKnownUser } from './gm-relay.mjs';
import {
  isSpecialSuit,
  createSpecialCardDefinition,
  updateSpecialCardDefinition,
  adjustSpecialCardCopies,
  deleteSpecialCardDefinition
} from './special-cards.mjs';

function getDeck() {
  return game.cards.getName('DoD - lista carte');
}
function getPile() {
  return game.cards.getName('Mazzo');
}
function getHand() {
  return game.cards.getName('Mano');
}

/**
 * @param {{userId: string, suitCounts: Object<string, number>}} payload
 * @returns {Promise<{success: boolean, error?: string, data?: {pileSnapshot: object}}>}
 */
export async function gmAddCardsToPile({ userId, suitCounts }) {
  if (!assertKnownUser(userId)) {
    return { success: false, error: 'DECK_OF_DESTINY.messages.errors.unknownUser' };
  }
  return withCardLock(async () => {
    const deck = getDeck();
    const pile = getPile();
    await addCardsReplacingWhite(deck, pile, suitCounts, { chatNotification: false });
    const recordResult = await recordPlayerAddedCore(userId);
    if (!recordResult.success) return recordResult;
    return { success: true, data: { pileSnapshot: buildPileSnapshot(pile) } };
  });
}

/**
 * GM dialog counterpart of gmAddCardsToPile (aggiungiAlMazzo): add
 * arbitrary suit/special counts to the pile, replacing white filler first.
 * @param {{counts: Object<string, number>, specialCounts: Object<string, number>}} payload
 * @returns {Promise<{success: boolean}>}
 */
export async function gmAddToDeck({ counts, specialCounts }) {
  return withCardLock(async () => {
    const deck = getDeck();
    const pile = getPile();
    await addCardsReplacingWhite(
      deck,
      pile,
      { ...counts, ...specialCounts },
      { chatNotification: false }
    );
    return { success: true };
  });
}

/**
 * Reset the pile for a new round: recall everything to the deck, refill
 * with white filler up to the minimum size, and (optionally) clear stale
 * draw-round state. Shared by componiIlMazzoEPesca (clearRound: false,
 * matching its current behavior) and richiediProva (clearRound: true).
 * @param {{clearRound?: boolean}} [payload]
 * @returns {Promise<{success: boolean}>}
 */
export async function gmResetPileForNewRound({ clearRound = false } = {}) {
  return withCardLock(async () => {
    const deck = getDeck();
    const pile = getPile();
    await deck.recall({ chatNotification: false });
    await refillPileWithWhite(deck, pile);
    if (clearRound) await clearRoundState();
    return { success: true };
  });
}

/**
 * Special card definitions (create/update/delete) live in the master deck,
 * so they're mutations just like any other and have to serialize through
 * the same GM queue - a second GM editing special cards locally would race
 * against a relayed addCardsToPile/composeAndDraw exactly like svuotaMazzo
 * did before it moved behind runOnGM (see globals.mjs).
 *
 * Unlike the other handlers in this file, these three DO check the caller's
 * identity: they're only ever reached through gestisciCarteSpeciali, which
 * is GM-only in its own UI - but that UI check runs on the calling client
 * and doesn't stop a client from invoking the underlying socketlib action
 * directly (socketlib is globally accessible, not gated by this system's
 * UI at all). Without this check, any connected client could create/edit/
 * delete special card definitions by calling the action directly, executing
 * with the target GM's own permissions regardless of who's actually asking.
 * @param {{userId: string, name: string, description: string, img: string|null, copies: number}} payload
 * @returns {Promise<{success: boolean, error?: string, data?: {suit: string}}>}
 */
export async function gmCreateSpecialCard({ userId, name, description, img, copies }) {
  if (!game.users.get(userId)?.isGM) {
    return { success: false, error: 'DECK_OF_DESTINY.messages.errors.unknownUser' };
  }
  return withCardLock(async () => {
    const deck = getDeck();
    const suit = await createSpecialCardDefinition(deck, {
      name,
      description,
      img,
      copies
    });
    return { success: true, data: { suit } };
  });
}

/**
 * @param {{userId: string, suit: string, name: string, description: string, img: string|null, copies: number}} payload
 * @returns {Promise<{success: boolean, error?: string, data?: {shortfall: number}}>}
 */
export async function gmUpdateSpecialCard({
  userId,
  suit,
  name,
  description,
  img,
  copies
}) {
  if (!game.users.get(userId)?.isGM) {
    return { success: false, error: 'DECK_OF_DESTINY.messages.errors.unknownUser' };
  }
  return withCardLock(async () => {
    const deck = getDeck();
    const pile = getPile();
    const hand = getHand();
    await updateSpecialCardDefinition([deck, pile, hand], suit, {
      name,
      description,
      img
    });
    const { shortfall } = await adjustSpecialCardCopies(deck, suit, copies, {
      name,
      description,
      img
    });
    return { success: true, data: { shortfall } };
  });
}

/**
 * @param {{userId: string, suit: string}} payload
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function gmDeleteSpecialCard({ userId, suit }) {
  if (!game.users.get(userId)?.isGM) {
    return { success: false, error: 'DECK_OF_DESTINY.messages.errors.unknownUser' };
  }
  return withCardLock(async () => {
    const deck = getDeck();
    const pile = getPile();
    const hand = getHand();
    await deleteSpecialCardDefinition([deck, pile, hand], suit);
    return { success: true };
  });
}

/**
 * componiIlMazzoEPesca's confirm step: add the requested composition to the
 * pile, then draw for playersNum. Drawn cards come back as plain objects
 * (never Foundry Document instances - those aren't safe to send over a
 * socket).
 * @param {{playersNum: number, counts: object, specialCounts: object}} payload
 * @returns {Promise<{success: boolean, data: {drawnCards: object[]}}>}
 */
export async function gmComposeAndDraw({ playersNum, counts, specialCounts }) {
  return withCardLock(async () => {
    const deck = getDeck();
    const pile = getPile();
    const hand = getHand();

    const totalCards =
      Object.values(counts).reduce((a, b) => a + Math.max(0, b), 0) +
      Object.values(specialCounts).reduce((a, b) => a + Math.max(0, b), 0);
    if (totalCards > 0) {
      await addCardsReplacingWhite(
        deck,
        pile,
        { ...counts, ...specialCounts },
        { chatNotification: false }
      );
    }

    if (pile.cards.size === 0) return { success: true, data: { drawnCards: [] } };
    const drawn = await drawCards(
      hand,
      pile,
      getCardsToDraw(pile.cards.size, playersNum),
      {
        how: CONST.CARD_DRAW_MODES.RANDOM,
        chatNotification: false
      }
    );
    return { success: true, data: { drawnCards: serializeCards(drawn) } };
  });
}

/**
 * pesca's confirm step: draw playersNum's share from the pile. The
 * pile-suit summary shown before this call is a read-only snapshot the
 * caller already took locally - only the draw itself needs to be
 * serialized on the GM.
 * @param {{playersNum: number}} payload
 * @returns {Promise<{success: boolean, data: {drawnCards: object[]}}>}
 */
export async function gmDrawFromPile({ playersNum }) {
  return withCardLock(async () => {
    const pile = getPile();
    const hand = getHand();
    if (pile.cards.size === 0) return { success: true, data: { drawnCards: [] } };
    const drawn = await drawCards(
      hand,
      pile,
      getCardsToDraw(pile.cards.size, playersNum),
      {
        how: CONST.CARD_DRAW_MODES.RANDOM,
        chatNotification: false
      }
    );
    return { success: true, data: { drawnCards: serializeCards(drawn) } };
  });
}

/**
 * @param {{userId: string, displayName: string}} payload
 * @returns {Promise<{success: boolean, error?: string, data?: object}>}
 */
export async function gmExecutePlayerDraw({ userId, displayName }) {
  if (!assertKnownUser(userId)) {
    return { success: false, error: 'DECK_OF_DESTINY.messages.errors.unknownUser' };
  }
  return withCardLock(() => executePlayerDrawCore(userId, displayName));
}

/**
 * The caller passes a `{userId, displayName}` identity payload for a
 * uniform runOnGM contract, but this handler doesn't need it: none of
 * riskCore's outcomes are attributed to a specific person, and the calling
 * client posts its own chat message either way (see rischia() in
 * globals.mjs).
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function gmRisk() {
  return withCardLock(() => riskCore());
}

/**
 * Draw one card at a time from the pile into the hand until a success or
 * failure is drawn (or the pile empties). Requires an equal count of
 * success/failure cards already in hand. Mutation body extracted from the
 * former rischia() (globals.mjs) - identical logic, but returns a data
 * payload for the caller's own client to render instead of building chat
 * messages/notifications itself (those need the caller's own game.user).
 * @returns {Promise<{success: true, data: object}>}
 */
async function riskCore() {
  const pile = getPile();
  const hand = getHand();

  const numFailure = hand.cards.filter((card) => card.suit === 'failure').length;
  const numSuccess = hand.cards.filter((card) => card.suit === 'success').length;

  if (pile.cards.size === 0) {
    return { success: true, data: { outcome: 'noDeckCards' } };
  }

  if (numSuccess !== numFailure) {
    return { success: true, data: { outcome: 'unequalCards', numSuccess, numFailure } };
  }

  let drawCard;
  const drawnCards = [];
  do {
    if (pile.cards.size === 0) {
      return { success: true, data: { outcome: 'noCardsForRisk' } };
    }
    const drawn = await drawCards(hand, pile, 1, {
      how: CONST.CARD_DRAW_MODES.RANDOM,
      chatNotification: false
    });
    [drawCard] = drawn || [];
    if (!drawCard) break;
    drawnCards.push(drawCard);
  } while (drawCard.suit !== 'success' && drawCard.suit !== 'failure');

  if (!drawCard) {
    return { success: true, data: { outcome: 'noSuccessOrFailure' } };
  }

  return {
    success: true,
    data: {
      outcome: 'resolved',
      finalSuit: drawCard.suit,
      finalName: drawCard.name,
      drawnCards: serializeCards(drawnCards)
    }
  };
}

/**
 * Map drawn Card documents to plain, socket-safe objects.
 * @param {Card[]} cards
 * @returns {Array<{id: string, name: string, suit: string, img: string}>}
 */
function serializeCards(cards) {
  return cards.map((c) => ({ id: c.id, name: c.name, suit: c.suit, img: c.img }));
}

/**
 * Snapshot the pile's suit/special-card totals, computed fresh on the GM's
 * own client right after a mutation. Callers on other clients shouldn't
 * re-derive this from their own (possibly not-yet-synced) local copy of
 * the pile.
 * @param {Cards} pile
 * @returns {{pileSuits: Object<string, number>, pileSpecials: Array<{suit: string, name: string, count: number}>}}
 */
function buildPileSnapshot(pile) {
  const pileSuits = {
    success: 0,
    failure: 0,
    issue: 0,
    fortune: 0,
    destiny: 0,
    white: 0
  };
  const specialsBySuit = new Map();
  for (const card of pile.cards) {
    if (pileSuits[card.suit] !== undefined) {
      pileSuits[card.suit]++;
    } else if (isSpecialSuit(card.suit)) {
      const existing = specialsBySuit.get(card.suit);
      if (existing) {
        existing.count++;
      } else {
        specialsBySuit.set(card.suit, { suit: card.suit, name: card.name, count: 1 });
      }
    }
  }
  return { pileSuits, pileSpecials: Array.from(specialsBySuit.values()) };
}
