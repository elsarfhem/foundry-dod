/**
 * Test fixtures for draw round states
 * Provides factory functions to create various round state scenarios
 */

/**
 * Create an empty initial round state
 */
export function createEmptyRoundState() {
  return {
    playersAdded: [],
    playersDrawn: [],
    drawResults: [],
  };
}

/**
 * Create a round state with players who have added cards
 */
export function createRoundWithPlayersAdded(userIds = ['user1', 'user2', 'user3']) {
  return {
    playersAdded: userIds,
    playersDrawn: [],
    drawResults: [],
  };
}

/**
 * Create a round state with some players who have drawn
 */
export function createRoundWithSomeDrawn(addedUsers = ['user1', 'user2', 'user3'], drawnUsers = ['user1']) {
  return {
    playersAdded: addedUsers,
    playersDrawn: drawnUsers,
    drawResults: drawnUsers.map((userId) => ({
      userId,
      userName: `Player${userId.slice(-1)}`,
      cards: [],
      suits: {},
    })),
  };
}

/**
 * Create a completed round state (all players drawn)
 */
export function createCompletedRoundState(userIds = ['user1', 'user2', 'user3']) {
  return {
    playersAdded: userIds,
    playersDrawn: userIds,
    drawResults: userIds.map((userId) => ({
      userId,
      userName: `Player${userId.slice(-1)}`,
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
    playersAdded: results.map((r) => r.userId),
    playersDrawn: results.map((r) => r.userId),
    drawResults: results,
  };
}

/**
 * Create invalid round states for error testing
 */
export function createInvalidRoundState(type = 'missing-arrays') {
  switch (type) {
    case 'missing-arrays':
      return { playersAdded: null };
    case 'wrong-type':
      return { playersAdded: 'not-an-array', playersDrawn: [], drawResults: [] };
    case 'missing-fields':
      return { playersAdded: [] };
    case 'malformed-results':
      return {
        playersAdded: ['user1'],
        playersDrawn: ['user1'],
        drawResults: [{ userId: 'user1' }], // Missing required fields
      };
    default:
      return null;
  }
}
