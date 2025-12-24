import type { Socket } from 'socket.io';
import type { User, Item } from '../types/index.js';
import * as repo from '../db/repo.js';
import * as combatState from '../game/combatState.js';

export interface StateUpdatePayload {
  player: User;
  room: import('../types/index.js').Room;
  visibleRooms: import('../types/index.js').Room[];
  roomItems: Item[];
  inventory?: Item[];
}

export interface CombatResult {
  handled: boolean;
  shouldEmitState?: StateUpdatePayload;
}

export interface CombatUpdatePayload {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  playerRoll: number;
  enemyRoll: number;
  damage: number;
  source: 'player' | 'enemy' | 'tie';
}

/**
 * Handle player death - respawn at origin with zero gold loss
 */
function handlePlayerDeath(user: User, socket: Socket): void {
  // Log death message
  socket.emit('game:log', {
    text: 'You have fallen. The world fades...',
    type: 'error' as const,
  });

  // Zero gold loss - keep all gold
  // Restore HP to max
  repo.updateUserStats(user.id, { hp: user.max_hp });
  
  // Respawn at origin (0, 0)
  repo.updateUserPosition(user.id, 0, 0);
  repo.updateUserState(user.id, 'IDLE');

  // Get updated user and room
  const updatedUser = repo.getUser(user.id)!;
  const serverCode = user.server_code;
  const genesisRoom = repo.getRoom(0, 0, serverCode)!;
  const visibleRooms = repo.getVisibleRooms(0, 0, serverCode);
  const roomItems = repo.getRoomItems(genesisRoom.id, serverCode);
  const inventory = repo.getUserInventory(user.id, serverCode);

  // Emit state update (teleports player back to start)
  socket.emit('state:update', {
    player: updatedUser,
    room: genesisRoom,
    visibleRooms,
    roomItems,
    inventory,
  });

  socket.emit('game:log', {
    text: `You awaken at The Crash Site. You have ${user.gold} gold remaining.`,
    type: 'info' as const,
  });
}

/**
 * Handle fight command - starts real-time auto-battler
 */
export function handleFight(
  socket: Socket,
  user: User,
  targetName: string,
): CombatResult {
  // Check if user is already in combat
  if (combatState.isInCombat(user.id)) {
    socket.emit('game:log', {
      text: 'You are already in combat! Use "retreat" to escape.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Check if user is in a valid state
  if (user.state !== 'IDLE' && user.state !== 'COMBAT') {
    socket.emit('game:log', {
      text: `Cannot fight while in ${user.state} state.`,
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Get current room
  const serverCode = user.server_code;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, serverCode);
  if (!currentRoom || currentRoom.id.startsWith('void-')) {
    socket.emit('game:log', {
      text: 'You are in undefined space. There is nothing to fight here.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Find target item in room
  const roomItems = repo.getRoomItems(currentRoom.id, serverCode);
  let target = roomItems.find(
    (item) => item.name.toLowerCase() === targetName.toLowerCase(),
  );

  if (!target) {
    socket.emit('game:log', {
      text: `You don't see "${targetName}" here.`,
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Check if target is an enemy (has HP > 0)
  if (!target.enemy_hp || target.enemy_hp <= 0) {
    socket.emit('game:log', {
      text: 'That is peaceful.',
      type: 'info' as const,
    });
    return { handled: true };
  }

  // Set user to combat state
  repo.updateUserState(user.id, 'COMBAT');

  // Log combat start
  socket.emit('game:log', {
    text: `Combat begins with ${target.name}!`,
    type: 'info' as const,
  });

  // Start combat loop (every 1500ms)
  const interval = setInterval(() => {
    // Refresh user and enemy data from database
    const currentUser = repo.getUser(user.id);
    if (!currentUser) {
      clearInterval(interval);
      combatState.endBattle(user.id);
      return;
    }

    const currentRoom = repo.getRoom(currentUser.current_q, currentUser.current_r, currentUser.server_code);
    if (!currentRoom) {
      clearInterval(interval);
      combatState.endBattle(user.id);
      return;
    }

    const currentRoomItems = repo.getRoomItems(currentRoom.id, currentUser.server_code);
    const currentEnemy = currentRoomItems.find((item) => item.id === target.id);

    // Check if enemy still exists and has HP
    if (!currentEnemy || !currentEnemy.enemy_hp || currentEnemy.enemy_hp <= 0) {
      // Enemy already defeated (shouldn't happen, but handle it)
      clearInterval(interval);
      combatState.endBattle(user.id);
      repo.updateUserState(user.id, 'IDLE');
      return;
    }

    // === ROLL PHASE ===
    const playerRoll = Math.floor(Math.random() * 6) + 1 + (currentUser.strength || 0);
    const enemyRoll = Math.floor(Math.random() * 6) + 1 + currentEnemy.enemy_attack;

    // === RESOLVE PHASE ===
    const delta = Math.abs(playerRoll - enemyRoll);
    let damage = 0;
    let source: 'player' | 'enemy' | 'tie' = 'tie';

    if (playerRoll > enemyRoll) {
      // Player wins
      damage = Math.ceil(delta / 2) + 1;
      const newEnemyHp = Math.max(0, currentEnemy.enemy_hp - damage);
      repo.updateItemEnemyHp(currentEnemy.id, newEnemyHp);
      source = 'player';
    } else if (enemyRoll > playerRoll) {
      // Enemy wins
      damage = Math.ceil(delta / 2);
      const newPlayerHp = Math.max(0, currentUser.hp - damage);
      repo.updateUserStats(currentUser.id, { hp: newPlayerHp });
      source = 'enemy';
    } else {
      // Tie - no damage
      source = 'tie';
    }

    // Refresh enemy data after update
    const updatedEnemy = repo.getItem(currentEnemy.id);
    const updatedUser = repo.getUser(user.id)!;

    // === EMIT UPDATE ===
    socket.emit('combat:update', {
      playerHp: updatedUser.hp,
      playerMaxHp: updatedUser.max_hp,
      enemyHp: updatedEnemy?.enemy_hp || 0,
      enemyMaxHp: updatedEnemy?.enemy_max_hp || 0,
      playerRoll,
      enemyRoll,
      damage,
      source,
    } as CombatUpdatePayload);

    // === CHECK OUTCOMES ===
    if (updatedEnemy && updatedEnemy.enemy_hp <= 0) {
      // VICTORY
      clearInterval(interval);
      combatState.endBattle(user.id);

      // Use dynamic xp_value from database
      const xpReward = currentEnemy.xp_value || 10;
      
      socket.emit('game:log', {
        text: `You defeated the ${currentEnemy.name}! Gained ${xpReward} gold.`,
        type: 'info' as const,
      });

      // Award gold
      const newGold = updatedUser.gold + xpReward;
      repo.updateUserStats(user.id, { gold: newGold });

      // Delete the enemy (removes it for this player only)
      repo.deleteItem(currentEnemy.id);

      // Return to idle
      repo.updateUserState(user.id, 'IDLE');

      // Emit combat end
      socket.emit('combat:end', {
        result: 'win',
        loot: { gold: xpReward },
      });

      // Emit updated state
      const finalUser = repo.getUser(user.id)!;
      const finalRoom = repo.getRoom(finalUser.current_q, finalUser.current_r, finalUser.server_code)!;
      const finalVisibleRooms = repo.getVisibleRooms(finalUser.current_q, finalUser.current_r, finalUser.server_code);
      const finalRoomItems = repo.getRoomItems(finalRoom.id, finalUser.server_code);
      const inventory = repo.getUserInventory(user.id, finalUser.server_code);

      socket.emit('state:update', {
        player: finalUser,
        room: finalRoom,
        visibleRooms: finalVisibleRooms,
        roomItems: finalRoomItems,
        inventory,
      });
    } else if (updatedUser.hp <= 0) {
      // DEFEAT
      clearInterval(interval);
      combatState.endBattle(user.id);

      // Emit combat end
      socket.emit('combat:end', {
        result: 'loss',
      });

      handlePlayerDeath(updatedUser, socket);
    }
  }, 1500);

  // Store the battle
  combatState.startBattle(user.id, socket.id, target.id, interval);

  return { handled: true };
}

/**
 * Handle retreat command - escape from combat
 */
export function handleRetreat(socket: Socket, user: User): CombatResult {
  if (!combatState.isInCombat(user.id)) {
    socket.emit('game:log', {
      text: 'You are not in combat.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  // End the battle
  combatState.endBattle(user.id);

  // Return to idle
  repo.updateUserState(user.id, 'IDLE');

  // Emit combat end
  socket.emit('combat:end', {
    result: 'retreat',
  });

  socket.emit('game:log', {
    text: 'You escaped with your life.',
    type: 'info' as const,
  });

  // Emit updated state
  const updatedUser = repo.getUser(user.id)!;
  const serverCode = user.server_code;
  const updatedRoom = repo.getRoom(user.current_q, user.current_r, serverCode)!;
  const updatedVisibleRooms = repo.getVisibleRooms(user.current_q, user.current_r, serverCode);
  const updatedRoomItems = repo.getRoomItems(updatedRoom.id, serverCode);
  const inventory = repo.getUserInventory(user.id, serverCode);

  return {
    handled: true,
    shouldEmitState: {
      player: updatedUser,
      room: updatedRoom,
      visibleRooms: updatedVisibleRooms,
      roomItems: updatedRoomItems,
      inventory,
    },
  };
}

