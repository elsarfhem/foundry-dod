/**
 * Test fixtures for draw round states
 * Provides factory functions to create various round state scenarios
 */

/**
 * Create an empty initial round state
 */
export function createEmptyRoundState() {
  return {
    actorsAdded: [],
    actorsDrawn: [],
    drawResults: [],
  };
}

/**
 * Create a round state with actors who have added cards
 */
export function createRoundWithActorsAdded(actorIds = ['actor1', 'actor2', 'actor3']) {
  return {
    actorsAdded: actorIds,
    actorsDrawn: [],
    drawResults: [],
  };
}

/**
 * Create a round state with some actors who have drawn
 */
export function createRoundWithSomeDrawn(addedActors = ['actor1', 'actor2', 'actor3'], drawnActors = ['actor1']) {
  return {
    actorsAdded: addedActors,
    actorsDrawn: drawnActors,
    drawResults: drawnActors.map((actorId) => ({
      actorId,
      actorName: `Actor${actorId.slice(-1)}`,
      cards: [],
      suits: {},
    })),
  };
}

/**
 * Create a completed round state (all actors drawn)
 */
export function createCompletedRoundState(actorIds = ['actor1', 'actor2', 'actor3']) {
  return {
    actorsAdded: actorIds,
    actorsDrawn: actorIds,
    drawResults: actorIds.map((actorId) => ({
      actorId,
      actorName: `Actor${actorId.slice(-1)}`,
      cards: [],
      suits: {},
    })),
  };
}

/**
 * Create a round state with draw results
 */
export function createRoundWithDrawResults(results) {
  return {
    actorsAdded: results.map((r) => r.actorId),
    actorsDrawn: results.map((r) => r.actorId),
    drawResults: results,
  };
}

/**
 * Create invalid round states for error testing
 */
export function createInvalidRoundState(type = 'missing-arrays') {
  switch (type) {
    case 'missing-arrays':
      return { actorsAdded: null };
    case 'wrong-type':
      return { actorsAdded: 'not-an-array', actorsDrawn: [], drawResults: [] };
    case 'missing-fields':
      return { actorsAdded: [] };
    case 'malformed-results':
      return {
        actorsAdded: ['actor1'],
        actorsDrawn: ['actor1'],
        drawResults: [{ actorId: 'actor1' }], // Missing required fields
      };
    default:
      return null;
  }
}
