import type { User, Room } from '../types/index.js';
import * as repo from '../db/repo.js';
import * as store from '../state/store.js';
import type { Socket } from 'socket.io';

/**
 * Send room tapestry animation to client if it exists
 */
function sendRoomTapestry(socket: Socket, roomId: string): void {
  const tapestry = repo.getRoomAnimationByType(roomId, 'TAPESTRY');
  if (tapestry) {
    socket.emit('animation:play', tapestry);
  }
}

export type Direction = 'n' | 's' | 'ne' | 'se' | 'nw' | 'sw';

export interface StateUpdatePayload {
  player: User;
  room: Room;
  visibleRooms: Room[];
  roomItems: import('../types/index.js').Item[];
  inventory?: import('../types/index.js').Item[];
}

export function parseDirection(raw: string): Direction | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  let dir = parts[0];
  if (dir === 'go' && parts[1]) {
    dir = parts[1];
  }

  if (dir === 'n' || dir === 's' || dir === 'ne' || dir === 'se' || dir === 'nw' || dir === 'sw') {
    return dir;
  }

  return null;
}

export function moveAxial(q: number, r: number, dir: Direction): { q: number; r: number } {
  switch (dir) {
    case 'n':
      return { q, r: r - 1 };
    case 's':
      return { q, r: r + 1 };
    case 'ne':
      return { q: q + 1, r: r - 1 };
    case 'sw':
      return { q: q - 1, r: r + 1 };
    case 'nw':
      return { q: q - 1, r };
    case 'se':
      return { q: q + 1, r };
    default:
      return { q, r };
  }
}

export function handleMove(
  socket: Socket,
  user: User,
  input: string,
): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  if (user.state !== 'IDLE') {
    socket.emit('game:log', {
      text: `Cannot move while in ${user.state} state.`,
      type: 'error' as const,
    });
    return { handled: true };
  }

  const direction = parseDirection(input);
  if (!direction) {
    return { handled: false };
  }

  const { q: newQ, r: newR } = moveAxial(user.current_q, user.current_r, direction);
  repo.updateUserPosition(user.id, newQ, newR);

  const serverCode = user.server_code;
  const existingRoom = repo.getRoom(newQ, newR, serverCode);

  // If moving into void space, trigger creation wizard
  if (!existingRoom) {
    repo.updateUserState(user.id, 'CREATING_ROOM_TITLE');
    store.setTempRoomData(user.id, { q: newQ, r: newR });

    socket.emit('game:log', {
      text: 'What is this place called?',
      type: 'prompt' as const,
      label: 'QUESTION',
    });

    const updatedUser = repo.getUser(user.id)!;
    const voidRoom: Room = {
      id: `void-${newQ},${newR}`,
      q: newQ,
      r: newR,
      server_code: serverCode,
      title: 'Unknown Wilds',
      description: "You are the first to wander here.",
      shroud_level: 0,
      created_by: user.id,
    };

    const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, serverCode);
    const roomItems: import('../types/index.js').Item[] = [];

    return {
      handled: true,
      shouldEmitState: {
        player: updatedUser,
        room: voidRoom,
        visibleRooms,
        roomItems,
      },
    };
  }

  // Room exists, just move normally
  const updatedUser = repo.getUser(user.id)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, serverCode);
  const roomItems = repo.getRoomItems(existingRoom.id, serverCode);
  const inventory = repo.getUserInventory(user.id, serverCode);

  // Send room tapestry animation if it exists
  sendRoomTapestry(socket, existingRoom.id);

  return {
    handled: true,
    shouldEmitState: {
      player: updatedUser,
      room: existingRoom,
      visibleRooms,
      roomItems,
      inventory,
    },
  };
}

