/**
 * Unit tests for gm-relay.mjs.
 *
 * createGMRelay is tested against a fake transport, not real socketlib -
 * the dispatcher itself has no socketlib import, so a plain object with
 * the 5 expected methods is enough to exercise every branch.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  resolveDisplayName,
  getRequesterIdentity,
  assertKnownUser,
  pickTargetGM,
  createGMRelay,
  setGMRelay,
  runOnGM
} from '../../src/module/helpers/gm-relay.mjs';

function makeTransport(overrides = {}) {
  return {
    hasTransport: () => true,
    getTargetGMId: () => 'gm1',
    isSelf: (userId) => userId === 'not-me',
    executeLocal: vi.fn(async () => ({ success: true, data: { via: 'local' } })),
    executeRemote: vi.fn(async () => ({ success: true, data: { via: 'remote' } })),
    ...overrides
  };
}

describe('gm-relay: resolveDisplayName', () => {
  it('prefers the character name when a character is assigned', () => {
    expect(resolveDisplayName({ character: { name: 'Hero' }, name: 'Player1' })).toBe(
      'Hero'
    );
  });

  it('falls back to the user name when no character is assigned', () => {
    expect(resolveDisplayName({ character: null, name: 'Player1' })).toBe('Player1');
    expect(resolveDisplayName({ name: 'Player1' })).toBe('Player1');
  });
});

describe('gm-relay: getRequesterIdentity', () => {
  it('snapshots the current game.user into {userId, displayName}', () => {
    global.game.user.id = 'user1';
    global.game.user.name = 'Player1';
    global.game.user.character = { name: 'Hero' };

    expect(getRequesterIdentity()).toEqual({ userId: 'user1', displayName: 'Hero' });
  });
});

describe('gm-relay: assertKnownUser', () => {
  it('returns true for a user that exists in game.users', () => {
    // createMockGame()'s default fixture (test/setup.mjs) already seeds
    // 'user1' among game.users.
    expect(assertKnownUser('user1')).toBe(true);
  });

  it('returns false for an unknown id', () => {
    expect(assertKnownUser('ghost')).toBe(false);
  });
});

describe('gm-relay: pickTargetGM', () => {
  it('returns null when no user is an active GM', () => {
    const users = [
      { id: 'gm1', isGM: true, active: false },
      { id: 'player1', isGM: false, active: true }
    ];
    expect(pickTargetGM(users)).toBeNull();
  });

  it('picks the only active GM', () => {
    const users = [
      { id: 'gm1', isGM: true, active: true },
      { id: 'player1', isGM: false, active: true }
    ];
    expect(pickTargetGM(users).id).toBe('gm1');
  });

  it('picks the lowest-id active GM when several are online, ignoring connection order', () => {
    const users = [
      { id: 'gm2', isGM: true, active: true },
      { id: 'gm1', isGM: true, active: true },
      { id: 'gm3', isGM: true, active: true }
    ];
    expect(pickTargetGM(users).id).toBe('gm1');
  });

  it('ignores an inactive GM even if its id would otherwise sort first', () => {
    const users = [
      { id: 'gm0', isGM: true, active: false },
      { id: 'gm1', isGM: true, active: true }
    ];
    expect(pickTargetGM(users).id).toBe('gm1');
  });
});

describe('gm-relay: createGMRelay', () => {
  it('runs locally, without touching the transport, when the caller is the target GM', async () => {
    const transport = makeTransport({ isSelf: (userId) => userId === 'gm1' });
    const dispatch = createGMRelay(transport);

    const result = await dispatch('someAction', { foo: 1 });

    expect(result).toEqual({ success: true, data: { via: 'local' } });
    expect(transport.executeLocal).toHaveBeenCalledWith('someAction', { foo: 1 });
    expect(transport.executeRemote).not.toHaveBeenCalled();
  });

  it('relays through the transport - by target id - when the caller is not the target GM', async () => {
    const transport = makeTransport();
    const dispatch = createGMRelay(transport);

    const result = await dispatch('someAction', { foo: 1 });

    expect(result).toEqual({ success: true, data: { via: 'remote' } });
    expect(transport.executeRemote).toHaveBeenCalledWith('gm1', 'someAction', { foo: 1 });
    expect(transport.executeLocal).not.toHaveBeenCalled();
  });

  it('relays a second, non-target GM through the target GM rather than running locally', async () => {
    // Two GMs online: the caller IS a GM, but not the deterministically
    // chosen target - it must still relay, never execute locally, or the
    // single-queue guarantee splits into two independent queues.
    const transport = makeTransport({ isSelf: (userId) => userId === 'gm2-not-target' });
    const dispatch = createGMRelay(transport);

    const result = await dispatch('someAction', { foo: 1 });

    expect(result).toEqual({ success: true, data: { via: 'remote' } });
    expect(transport.executeRemote).toHaveBeenCalledWith('gm1', 'someAction', { foo: 1 });
    expect(transport.executeLocal).not.toHaveBeenCalled();
  });

  it('fails without calling either executor when socketlib is unavailable', async () => {
    const transport = makeTransport({ hasTransport: () => false });
    const dispatch = createGMRelay(transport);

    const result = await dispatch('someAction', {});

    expect(result).toEqual({
      success: false,
      error: 'DECK_OF_DESTINY.messages.errors.socketlibUnavailable'
    });
    expect(transport.executeLocal).not.toHaveBeenCalled();
    expect(transport.executeRemote).not.toHaveBeenCalled();
  });

  it('fails without calling either executor when no GM is online', async () => {
    const transport = makeTransport({ getTargetGMId: () => null });
    const dispatch = createGMRelay(transport);

    const result = await dispatch('someAction', {});

    expect(result).toEqual({
      success: false,
      error: 'DECK_OF_DESTINY.messages.errors.noGMOnline'
    });
    expect(transport.executeLocal).not.toHaveBeenCalled();
    expect(transport.executeRemote).not.toHaveBeenCalled();
  });

  it('turns a rejected executeRemote into a localized failure result', async () => {
    const transport = makeTransport({
      executeRemote: vi.fn(async () => {
        throw new Error('boom');
      })
    });
    const dispatch = createGMRelay(transport);

    const result = await dispatch('someAction', {});

    expect(result).toEqual({
      success: false,
      error: 'DECK_OF_DESTINY.messages.errors.gmRequestFailed'
    });
  });
});

describe('gm-relay: runOnGM / setGMRelay singleton', () => {
  it('returns relayNotReady when no dispatcher has been installed yet', async () => {
    setGMRelay(null);
    const result = await runOnGM('someAction', {});
    expect(result).toEqual({
      success: false,
      error: 'DECK_OF_DESTINY.messages.errors.relayNotReady'
    });
  });

  it('delegates to whichever dispatcher was installed via setGMRelay', async () => {
    const fakeDispatch = vi.fn(async () => ({ success: true, data: { ok: true } }));
    setGMRelay(fakeDispatch);

    const result = await runOnGM('someAction', { a: 1 });

    expect(fakeDispatch).toHaveBeenCalledWith('someAction', { a: 1 });
    expect(result).toEqual({ success: true, data: { ok: true } });

    setGMRelay(null); // don't leak state into other test files
  });
});
