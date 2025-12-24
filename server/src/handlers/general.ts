import type { Socket } from 'socket.io';
import type { User, Room, Item } from '../types/index.js';
import * as repo from '../db/repo.js';
import * as aiService from '../services/ai.js';

export interface StateUpdatePayload {
  player: User;
  room: Room;
  visibleRooms: Room[];
  roomItems: Item[];
  inventory?: Item[];
}

// Helper function to obfuscate text based on shroud level
function obfuscateText(text: string, shroudLevel: number): string {
  if (shroudLevel === 0) return text;
  const chars = text.split('');
  const numToHide = Math.min(shroudLevel, Math.floor(chars.length / 2));
  const indices = new Set<number>();
  while (indices.size < numToHide) {
    const idx = Math.floor(Math.random() * chars.length);
    if (chars[idx] !== ' ') {
      indices.add(idx);
    }
  }
  indices.forEach((idx) => {
    chars[idx] = '_';
  });
  return chars.join('');
}

export function handleHelp(socket: Socket, user: import('../types/index.js').User): boolean {
  const serverCode = user.server_code;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, serverCode);
  if (!currentRoom || currentRoom.id.startsWith('void-')) {
    socket.emit('game:log', {
      text: 'You are in undefined space. No objects here.',
      type: 'info' as const,
    });
    return true;
  }

  const items = repo.getRoomItems(currentRoom.id, serverCode);
  const verbs = items.map((item) => item.interact_verb);
  if (verbs.length === 0) {
    socket.emit('game:log', {
      text: 'No objects in this room.',
      type: 'info' as const,
    });
    return true;
  }

  // Apply shroud logic
  const shroudedVerbs = verbs.map((verb) => obfuscateText(verb, currentRoom.shroud_level));
  socket.emit('game:log', {
    text: `Verbs: ${shroudedVerbs.join(', ')}`,
    type: 'info' as const,
  });
  return true;
}

export function handleLook(
  socket: Socket,
  user: import('../types/index.js').User,
  target: string,
): boolean {
  const serverCode = user.server_code;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, serverCode);
  if (!currentRoom || currentRoom.id.startsWith('void-')) {
    socket.emit('game:log', {
      text: 'You are in undefined space.',
      type: 'info' as const,
    });
    return true;
  }

  // If no target, show room description
  if (!target || target.trim() === '') {
    socket.emit('game:log', {
      text: currentRoom.title,
      type: 'info' as const,
    });
    socket.emit('game:log', {
      text: currentRoom.description,
      type: 'info' as const,
    });
    return true;
  }

  // Search for item in room
  const roomItems = repo.getRoomItems(currentRoom.id, serverCode);
  let item = roomItems.find((i) => i.name.toLowerCase() === target.trim().toLowerCase());

  // If not found in room, check inventory
  if (!item) {
    const inventory = repo.getUserInventory(user.id, serverCode);
    item = inventory.find((i) => i.name.toLowerCase() === target.trim().toLowerCase());
  }

  if (!item) {
    socket.emit('game:log', {
      text: `You don't see "${target}" here.`,
      type: 'error' as const,
    });
    return true;
  }

  // Show item description
  socket.emit('game:log', {
    text: item.description || 'You don\'t notice anything.',
    type: 'info' as const,
  });
  return true;
}

/**
 * Dev command: Regenerate animations for the current room
 * Usage: /regenerate [mood]
 */
export async function handleRegenerate(
  socket: Socket,
  user: import('../types/index.js').User,
  mood?: string,
): Promise<boolean> {
  const serverCode = user.server_code;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, serverCode);
  if (!currentRoom || currentRoom.id.startsWith('void-')) {
    socket.emit('game:log', {
      text: 'You are in undefined space. Cannot regenerate animations.',
      type: 'error' as const,
    });
    return true;
  }

  // Default mood if not provided
  const targetMood = mood?.trim() || 'Mysterious';

  socket.emit('game:log', {
    text: `Regenerating animations for "${currentRoom.title}" with mood: ${targetMood}...`,
    type: 'info' as const,
  });

  try {
    // Delete existing animations for this room
    repo.deleteRoomAnimations(currentRoom.id);

    // Get room items
    const roomItems = repo.getRoomItems(currentRoom.id, serverCode);

    // Generate new room symbol (emoji)
    try {
      const symbol = await aiService.generateRoomSymbol(currentRoom, targetMood);
      repo.updateRoomSymbol(currentRoom.id, symbol);
      console.log(`Generated new symbol for room ${currentRoom.id}: ${symbol}`);
    } catch (error) {
      console.error(`Failed to generate room symbol:`, error);
      socket.emit('game:log', {
        text: `Warning: Failed to generate room symbol. ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error' as const,
      });
    }

    // Generate new room tapestry
    const roomFrames = await aiService.generateRoomTapestry(currentRoom, roomItems, targetMood);
    if (roomFrames.length > 0) {
      repo.createAnimation({
        room_id: currentRoom.id,
        object_id: null,
        type: 'TAPESTRY',
        frames: roomFrames,
        fps: 2,
      });
    }

    // Generate interaction animations for each item
    const itemAnimationPromises = roomItems.map(async (item) => {
      try {
        const frames = await aiService.generateObjectInteraction(item);
        if (frames.length > 0) {
          repo.createAnimation({
            room_id: currentRoom.id,
            object_id: item.id,
            type: 'INTERACTION',
            frames,
            fps: 2,
          });
        }
      } catch (error) {
        console.error(`Failed to generate animation for item ${item.id}:`, error);
      }
    });

    await Promise.all(itemAnimationPromises);

    socket.emit('game:log', {
      text: 'Animations and room symbol regenerated successfully!',
      type: 'info' as const,
    });

    // Refresh room to get updated symbol
    const refreshedRoom = repo.getRoom(user.current_q, user.current_r, serverCode)!;
    const visibleRooms = repo.getVisibleRooms(user.current_q, user.current_r, serverCode);
    const finalRoomItems = repo.getRoomItems(refreshedRoom.id, serverCode);

    // Debug: Log the symbol to verify it's being retrieved
    console.log(`Refreshed room symbol: ${refreshedRoom.symbol}`);
    console.log(`Visible rooms count: ${visibleRooms.length}`);
    const currentRoomInVisible = visibleRooms.find((r) => r.id === currentRoom.id);
    if (currentRoomInVisible) {
      console.log(`Current room in visibleRooms has symbol: ${currentRoomInVisible.symbol}`);
    } else {
      console.log(`Current room ${currentRoom.id} not found in visibleRooms`);
    }

    // Send state update with refreshed room (includes new symbol)
    socket.emit('state:update', {
      player: user,
      room: refreshedRoom,
      visibleRooms,
      roomItems: finalRoomItems,
    });

    // Send the new tapestry animation
    const tapestry = repo.getRoomAnimationByType(currentRoom.id, 'TAPESTRY');
    if (tapestry) {
      socket.emit('animation:play', tapestry);
    }

    return true;
  } catch (error) {
    console.error('Animation regeneration failed:', error);
    socket.emit('game:log', {
      text: `Failed to regenerate animations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      type: 'error' as const,
    });
    return true;
  }
}

