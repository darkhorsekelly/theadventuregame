/**
 * Combat State Management
 * Tracks active battles by user ID
 */

const activeBattles = new Map<string, NodeJS.Timeout>();

export interface ActiveBattle {
  userId: string;
  socketId: string;
  enemyId: string;
  interval: NodeJS.Timeout;
}

const battleData = new Map<string, ActiveBattle>();

/**
 * Check if a user is currently in combat
 */
export function isInCombat(userId: string): boolean {
  return activeBattles.has(userId);
}

/**
 * Start a combat battle
 */
export function startBattle(userId: string, socketId: string, enemyId: string, interval: NodeJS.Timeout): void {
  activeBattles.set(userId, interval);
  battleData.set(userId, {
    userId,
    socketId,
    enemyId,
    interval,
  });
}

/**
 * End a combat battle and clear the interval
 */
export function endBattle(userId: string): void {
  const battle = battleData.get(userId);
  if (battle) {
    clearInterval(battle.interval);
    battleData.delete(userId);
  }
  activeBattles.delete(userId);
}

/**
 * Get battle data for a user
 */
export function getBattle(userId: string): ActiveBattle | undefined {
  return battleData.get(userId);
}

