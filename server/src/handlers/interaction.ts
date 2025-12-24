import type { Socket } from 'socket.io';
import type { User, Room, Item } from '../types/index.js';
import * as repo from '../db/repo.js';

export interface StateUpdatePayload {
  player: User;
  room: Room;
  visibleRooms: Room[];
  roomItems: Item[];
  inventory?: Item[];
}

export function handleInteraction(
  socket: Socket,
  user: User,
  command: string,
): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  // Parse command: "verb object" or just "verb object name with spaces"
  const parts = command.trim().split(/\s+/);
  if (parts.length < 2 || !parts[0]) {
    return { handled: false };
  }

  const verb = parts[0].toLowerCase();
  
  // Ban "go" and "help" as interaction verbs - these are reserved for movement/help
  const bannedVerbs = ['go', 'help'];
  if (bannedVerbs.includes(verb)) {
    return { handled: false };
  }
  
  const objectName = parts.slice(1).join(' ');

  // Get current room
  const serverCode = user.server_code;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, serverCode);
  if (!currentRoom || currentRoom.id.startsWith('void-')) {
    socket.emit('game:log', {
      text: 'You are not in a valid room.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Find item in room first
  let item = repo.getItemByName(currentRoom.id, objectName, serverCode);

  // If not found in room, check inventory
  if (!item) {
    const inventory = repo.getUserInventory(user.id, serverCode);
    item = inventory.find((invItem) => invItem.name.toLowerCase() === objectName.toLowerCase());
  }

  if (!item) {
    socket.emit('game:log', {
      text: `You don't see "${objectName}" here.`,
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Validate verb matches item's interact_verb
  if (item.interact_verb.toLowerCase() !== verb) {
    socket.emit('game:log', {
      text: `You can't ${verb} the ${item.name}.`,
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Check required item if specified
  if (item.required_item_id) {
    const inventory = repo.getUserInventory(user.id, serverCode);
    const hasRequired = inventory.some((invItem) => invItem.id === item.required_item_id);
    if (!hasRequired) {
      // Try to get the required item name for a hint
      const allItems = [...repo.getRoomItems(currentRoom.id, serverCode), ...inventory];
      const requiredItem = allItems.find((i) => i.id === item.required_item_id);
      const hint = requiredItem ? ` (You need a ${requiredItem.name})` : '';
      socket.emit('game:log', {
        text: `You need a specific item to do that.${hint}`,
        type: 'error' as const,
      });
      return { handled: true };
    }
  }

  // Apply effect
  let updatedUser = repo.getUser(user.id)!;
  let successMessage = '';

  switch (item.effect_type) {
    case 'GOLD':
      const newGold = updatedUser.gold + item.effect_value;
      repo.updateUserStats(user.id, { gold: newGold });
      successMessage = `You gained ${item.effect_value} gold!`;
      break;

    case 'HEAL':
      const newHp = Math.min(updatedUser.max_hp, updatedUser.hp + item.effect_value);
      repo.updateUserStats(user.id, { hp: newHp });
      successMessage = `You recovered ${newHp - updatedUser.hp} HP!`;
      break;

    case 'DAMAGE':
      const damagedHp = Math.max(0, updatedUser.hp - item.effect_value);
      repo.updateUserStats(user.id, { hp: damagedHp });
      successMessage = `You took ${item.effect_value} damage!`;
      if (damagedHp === 0) {
        socket.emit('game:log', {
          text: 'You have been defeated!',
          type: 'error' as const,
        });
      }
      break;

    case 'ITEM':
      // Pick up item: move from room to inventory
      if (item.room_id) {
        if (item.is_infinite) {
          // Clone infinite items instead of moving them
          repo.cloneItemForUser(item, user.id);
          successMessage = `You picked up the ${item.name}.`;
        } else {
          // Move unique items (standard behavior)
          repo.setItemOwner(item.id, user.id, null);
          successMessage = `You picked up the ${item.name}.`;
        }
      } else {
        // Item is already in inventory, can't pick it up again
        socket.emit('game:log', {
          text: `You already have the ${item.name}.`,
          type: 'error' as const,
        });
        return { handled: true };
      }
      break;

    case 'NONE':
      successMessage = `You ${verb} the ${item.name}.`;
      break;

    default:
      successMessage = `You ${verb} the ${item.name}.`;
  }

  // Trigger interaction animation if it exists (play before or simultaneously with message)
  const interactionAnimation = repo.getItemAnimation(item.id, 'INTERACTION');
  if (interactionAnimation) {
    socket.emit('animation:play', interactionAnimation);
  }

  // Emit success message (not description - description is for "look")
  socket.emit('game:log', {
    text: item.success_message || successMessage,
    type: 'info' as const,
  });

  // Get updated user and room state
  updatedUser = repo.getUser(user.id)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, serverCode);
  const roomItems = repo.getRoomItems(currentRoom.id, serverCode);
  const inventory = repo.getUserInventory(user.id, serverCode);

  return {
    handled: true,
    shouldEmitState: {
      player: updatedUser,
      room: currentRoom,
      visibleRooms,
      roomItems,
      inventory,
    },
  };
}

