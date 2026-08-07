/**
 * Cross-client relay for Cards mutations.
 *
 * `withCardLock` (globals.mjs) only ever serialized calls within a single
 * browser's own JS process - it never protected the shared deck/pile/hand
 * Cards documents from two different players (or a player and the GM)
 * acting at nearly the same time. This module routes those mutations
 * through the GM's own client via socketlib, so a single process is the
 * real point of serialization.
 *
 * Identity flows explicitly through here as data (`{userId, displayName}`),
 * captured once on the calling client via `getRequesterIdentity()` before
 * any relay happens - never re-read from `game.user` on the executing side,
 * since once relayed that's always the GM, not the original caller.
 */

/**
 * Resolve the display name to attribute a card action to.
 * @param {{character?: {name: string}|null, name: string}} user
 * @returns {string}
 */
export function resolveDisplayName(user) {
  return user.character?.name ?? user.name;
}

/**
 * Snapshot the invoking client's identity. Call this once per action, on
 * the client that initiated it, before any relay - never re-derive it
 * afterwards from a `game.user` read on the executing side.
 * @returns {{userId: string, displayName: string}}
 */
export function getRequesterIdentity() {
  return { userId: game.user.id, displayName: resolveDisplayName(game.user) };
}

/**
 * Lightweight plausibility check for a relayed userId. Not a security
 * boundary by itself (the payload isn't cryptographically signed by
 * socketlib) - it just rejects obviously-bogus ids. Real authorization
 * rests on Foundry's own document permissions for the shared Cards stacks.
 * @param {string} userId
 * @returns {boolean}
 */
export function assertKnownUser(userId) {
  return !!game.users.get(userId);
}

/**
 * Deterministically pick the single GM every client should relay through.
 * `socket.executeAsGM` alone doesn't guarantee this: with two GMs online it
 * can route different calls to either one, splitting the serialization
 * queue in two. Picking the lowest-id *active* GM gives every client - GMs
 * included - the same target from the same `game.users` snapshot, so a
 * second online GM relays through this one instead of running locally.
 * @param {Iterable<{id: string, isGM: boolean, active: boolean}>} users
 * @returns {{id: string}|null}
 */
export function pickTargetGM(users) {
  let target = null;
  for (const user of users) {
    if (!user.isGM || !user.active) continue;
    if (!target || user.id < target.id) target = user;
  }
  return target;
}

/**
 * Build a GM-relay dispatcher from an injectable transport. Pure factory -
 * no socketlib import here, so it's testable with a fake transport.
 * @param {{
 *   hasTransport: () => boolean,
 *   getTargetGMId: () => string|null,
 *   isSelf: (userId: string) => boolean,
 *   executeLocal: (actionKey: string, payload: object) => Promise<object>,
 *   executeRemote: (targetId: string, actionKey: string, payload: object) => Promise<object>
 * }} transport
 * @returns {(actionKey: string, payload: object) => Promise<{success: boolean, error?: string, data?: object}>}
 */
export function createGMRelay(transport) {
  return async function runOnGM(actionKey, payload) {
    if (!transport.hasTransport()) {
      return {
        success: false,
        error: 'DECK_OF_DESTINY.messages.errors.socketlibUnavailable'
      };
    }
    const targetId = transport.getTargetGMId();
    if (!targetId) {
      return { success: false, error: 'DECK_OF_DESTINY.messages.errors.noGMOnline' };
    }
    if (transport.isSelf(targetId)) return transport.executeLocal(actionKey, payload);
    try {
      return await transport.executeRemote(targetId, actionKey, payload);
    } catch (error) {
      console.error(`DoD | gm-relay: "${actionKey}" failed`, error);
      return {
        success: false,
        error: 'DECK_OF_DESTINY.messages.errors.gmRequestFailed'
      };
    }
  };
}

/** @type {((actionKey: string, payload: object) => Promise<object>)|null} */
let _runOnGM = null;

/**
 * Install the active relay dispatcher (production wiring calls this once
 * socketlib is ready; tests can install a fake one directly).
 * @param {(actionKey: string, payload: object) => Promise<object>} fn
 */
export function setGMRelay(fn) {
  _runOnGM = fn;
}

/**
 * Run a card-mutating action on the GM, via whichever dispatcher is
 * currently installed. Returns a `relayNotReady` error if socketlib never
 * became ready in this session (e.g. the module is missing or inactive).
 * @param {string} actionKey
 * @param {object} payload
 * @returns {Promise<{success: boolean, error?: string, data?: object}>}
 */
export async function runOnGM(actionKey, payload) {
  if (!_runOnGM) {
    return { success: false, error: 'DECK_OF_DESTINY.messages.errors.relayNotReady' };
  }
  return _runOnGM(actionKey, payload);
}
