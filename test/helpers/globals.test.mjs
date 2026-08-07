/**
 * Unit tests for globals.mjs's withCardLock/isCardOperationLocked.
 *
 * globals.mjs otherwise consists of Dialog-driven macros that aren't
 * meaningfully unit-testable without a real Foundry Application stack -
 * this file covers the one piece of pure infrastructure logic it exports:
 * the FIFO queue that now backs withCardLock (see globals.mjs's module
 * docblock for why it moved off a simple reject-if-busy boolean).
 */

import { describe, it, expect } from 'vitest';
import { withCardLock, isCardOperationLocked } from '../../src/module/globals.mjs';

describe('globals: withCardLock', () => {
  it('reports unlocked when nothing is queued', () => {
    expect(isCardOperationLocked()).toBe(false);
  });

  it('runs a single queued task and returns its result', async () => {
    const result = await withCardLock(async () => 'done');
    expect(result).toBe('done');
    expect(isCardOperationLocked()).toBe(false);
  });

  it('reports locked while a task is in flight', async () => {
    // Build the gate promise/resolver up front, in this scope - fn() itself
    // only runs once the internal queue's `.then()` schedules it (a later
    // microtask), so resolveTask must already exist before that happens.
    let resolveTask;
    const gate = new Promise((resolve) => {
      resolveTask = resolve;
    });
    const task = withCardLock(() => gate);

    expect(isCardOperationLocked()).toBe(true);
    resolveTask();
    await task;
    expect(isCardOperationLocked()).toBe(false);
  });

  it('runs queued tasks strictly in FIFO order, never interleaved', async () => {
    const order = [];
    const first = withCardLock(async () => {
      order.push('first-start');
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push('first-end');
    });
    const second = withCardLock(async () => {
      order.push('second-start');
      order.push('second-end');
    });

    await Promise.all([first, second]);

    expect(order).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
  });

  it('keeps the queue alive for later tasks even if an earlier one throws', async () => {
    const failing = withCardLock(async () => {
      throw new Error('boom');
    });
    const succeeding = withCardLock(async () => 'still runs');

    await expect(failing).rejects.toThrow('boom');
    await expect(succeeding).resolves.toBe('still runs');
  });

  it('propagates a thrown error to its own caller only', async () => {
    await expect(
      withCardLock(async () => {
        throw new Error('specific failure');
      })
    ).rejects.toThrow('specific failure');
    expect(isCardOperationLocked()).toBe(false);
  });
});
