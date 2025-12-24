import type { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type { User, Room, Item } from '../types/index.js';
import * as repo from '../db/repo.js';
import * as store from '../state/store.js';
import * as aiService from '../services/ai.js';

export interface StateUpdatePayload {
  player: User;
  room: Room;
  visibleRooms: Room[];
  roomItems: Item[];
  inventory?: Item[];
}

export function handleInput(
  socket: Socket,
  user: User,
  input: string,
): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  // Room creation wizard states
  if (user.state === 'CREATING_ROOM_TITLE') {
    return handleRoomTitle(socket, user, input);
  }

  if (user.state === 'CREATING_ROOM_DESC') {
    return handleRoomDesc(socket, user, input);
  }

  if (user.state === 'CREATING_ROOM_MOOD') {
    return handleRoomMood(socket, user, input);
  }

  if (user.state === 'CREATING_ROOM_SHROUD') {
    return handleRoomShroud(socket, user, input);
  }

  // Object creation wizard states
  if (user.state === 'CREATING_OBJ_CONFIRM') {
    return handleObjConfirm(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_NAME') {
    return handleObjName(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_DESC') {
    return handleObjDesc(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_VERB') {
    return handleObjVerb(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_SUCCESS_MSG') {
    return handleObjSuccessMsg(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_TYPE') {
    return handleObjType(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_VALUE') {
    return handleObjValue(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_CONTENTS') {
    return handleObjContents(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_ENEMY_STATS') {
    return handleObjEnemyStats(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_REQUIREMENT') {
    return handleObjRequirement(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_SUPPLY_TYPE') {
    return handleObjSupplyType(socket, user, input);
  }

  if (user.state === 'CREATING_OBJ_VERB_CONFIRM') {
    return handleObjVerbConfirm(socket, user, input);
  }

  if (user.state === 'GENERATING_ANIMATIONS') {
    // User should not be able to input during generation
    return { handled: true };
  }

  return { handled: false };
}

function handleRoomTitle(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempData = store.getTempRoomData(user.id) || { q: user.current_q, r: user.current_r };
  tempData.title = input.trim();
  store.setTempRoomData(user.id, tempData);

  repo.updateUserState(user.id, 'CREATING_ROOM_DESC');

  socket.emit('game:log', {
    text: 'Describe the surroundings.',
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code);
  const voidRoom: Room = currentRoom ?? {
    id: `void-${user.current_q},${user.current_r}`,
    q: user.current_q,
    r: user.current_r,
    server_code: user.server_code,
    title: 'Unknown Wilds',
    description: "You are the first to wander here.",
    shroud_level: 0,
    created_by: user.id,
  };

  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems: Item[] = [];
  const inventory = repo.getUserInventory(user.id, user.server_code);

  return {
    handled: true,
    shouldEmitState: {
      player: updatedUser,
      room: voidRoom,
      visibleRooms,
      roomItems,
      inventory,
    },
  };
}

function handleRoomDesc(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempData = store.getTempRoomData(user.id);
  if (!tempData) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    return { handled: true };
  }

  tempData.description = input.trim();
  store.setTempRoomData(user.id, tempData);

  repo.updateUserState(user.id, 'CREATING_ROOM_MOOD');

  socket.emit('game:log', {
    text: 'Choose a Mood:\n1. Neutral\n2. Mysterious\n3. Dangerous\n4. Peaceful\n5. Ancient\n6. Whimsical',
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code);
  const voidRoom: Room = currentRoom ?? {
    id: `void-${user.current_q},${user.current_r}`,
    q: user.current_q,
    r: user.current_r,
    server_code: user.server_code,
    title: 'Unknown Wilds',
    description: "You are the first to wander here.",
    shroud_level: 0,
    created_by: user.id,
  };

  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems: Item[] = [];
  const inventory = repo.getUserInventory(user.id, user.server_code);

  return {
    handled: true,
    shouldEmitState: {
      player: updatedUser,
      room: voidRoom,
      visibleRooms,
      roomItems,
      inventory,
    },
  };
}

function handleRoomMood(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempData = store.getTempRoomData(user.id);
  if (!tempData) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    return { handled: true };
  }

  const moodNumber = parseInt(input.trim(), 10);
  const moodMap: Record<number, string> = {
    1: 'Neutral',
    2: 'Mysterious',
    3: 'Dangerous',
    4: 'Peaceful',
    5: 'Ancient',
    6: 'Whimsical',
  };

  if (isNaN(moodNumber) || moodNumber < 1 || moodNumber > 6) {
    socket.emit('game:log', {
      text: 'Invalid selection. Please enter a number between 1 and 6.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  tempData.mood = moodMap[moodNumber]!;
  store.setTempRoomData(user.id, tempData);

  repo.updateUserState(user.id, 'CREATING_ROOM_SHROUD');

  socket.emit('game:log', {
    text: 'How mysterious is this place? (0-5)',
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code);
  const voidRoom: Room = currentRoom ?? {
    id: `void-${user.current_q},${user.current_r}`,
    q: user.current_q,
    r: user.current_r,
    server_code: user.server_code,
    title: 'Unknown Wilds',
    description: "You are the first to wander here.",
    shroud_level: 0,
    created_by: user.id,
  };

  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems: Item[] = [];
  const inventory = repo.getUserInventory(user.id, user.server_code);

  return {
    handled: true,
    shouldEmitState: {
      player: updatedUser,
      room: voidRoom,
      visibleRooms,
      roomItems,
      inventory,
    },
  };
}

function handleRoomShroud(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempData = store.getTempRoomData(user.id);
  if (!tempData || !tempData.title || !tempData.description || !tempData.mood) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempRoomData(user.id);
    return { handled: true };
  }

  const shroudLevel = parseInt(input.trim(), 10);
  if (isNaN(shroudLevel) || shroudLevel < 0 || shroudLevel > 5) {
    socket.emit('game:log', {
      text: 'Invalid shroud level. Please enter a number between 0 and 5.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Commit room to database
  const newRoom = repo.createRoom({
    q: tempData.q,
    r: tempData.r,
    server_code: user.server_code,
    title: tempData.title,
    description: tempData.description,
    shroud_level: shroudLevel,
    created_by: user.id,
  });

  // Keep tempRoomData for animation generation (don't delete yet)

  const updatedUser = repo.getUser(user.id)!;

  socket.emit('game:log', {
    text: 'The world takes shape around you.',
    type: 'info' as const,
  });

  // Transition to object creation wizard
  repo.updateUserState(user.id, 'CREATING_OBJ_CONFIRM');
  store.setTempItemData(user.id, { roomId: newRoom.id });

  socket.emit('game:log', {
    text: 'Add an object? (y/n)',
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(newRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

  return {
    handled: true,
    shouldEmitState: {
      player: updatedUser,
      room: newRoom,
      visibleRooms,
      roomItems,
      inventory,
    },
  };
}

function handleObjConfirm(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const response = input.trim().toLowerCase();
  if (response === 'n' || response === 'no') {
    // Finish creation - trigger animation generation
    const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
    const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
    const tempRoomData = store.getTempRoomData(user.id);

    // Set state to generating
    repo.updateUserState(user.id, 'GENERATING_ANIMATIONS');

    socket.emit('game:log', {
      text: 'Weaving the threads of reality... (Generating Animations)',
      type: 'info' as const,
    });

    // Generate animations asynchronously
    generateAndSaveAnimations(socket, user, currentRoom, roomItems, tempRoomData?.mood || 'Mysterious')
      .then(() => {
        // Cleanup and complete
        store.deleteTempRoomData(user.id);
        store.deleteTempItemData(user.id);
        repo.updateUserState(user.id, 'IDLE');

        const updatedUser = repo.getUser(user.id)!;
        // Refresh room to get the updated symbol
        const refreshedRoom = repo.getRoom(updatedUser.current_q, updatedUser.current_r, user.server_code)!;
        const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
        const finalRoomItems = repo.getRoomItems(refreshedRoom.id, user.server_code);

        socket.emit('game:log', {
          text: 'The world is complete. You may explore.',
          type: 'info' as const,
        });

        const inventory = repo.getUserInventory(user.id, user.server_code);
        socket.emit('state:update', {
          player: updatedUser,
          room: refreshedRoom,
          visibleRooms,
          roomItems: finalRoomItems,
          inventory,
        });

        // Send room tapestry animation
        const tapestry = repo.getRoomAnimationByType(refreshedRoom.id, 'TAPESTRY');
        if (tapestry) {
          socket.emit('animation:play', tapestry);
        }
      })
      .catch((error) => {
        console.error('Animation generation failed:', error);
        // Still complete creation even if animations fail
        store.deleteTempRoomData(user.id);
        store.deleteTempItemData(user.id);
        repo.updateUserState(user.id, 'IDLE');

        const updatedUser = repo.getUser(user.id)!;
        const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
        const finalRoomItems = repo.getRoomItems(currentRoom.id, user.server_code);

        socket.emit('game:log', {
          text: 'The world is complete. (Animations could not be generated)',
          type: 'info' as const,
        });

        const inventory = repo.getUserInventory(user.id, user.server_code);
        socket.emit('state:update', {
          player: updatedUser,
          room: currentRoom,
          visibleRooms,
          roomItems: finalRoomItems,
          inventory,
        });
      });

    // Return immediately with generating state
    const updatedUser = repo.getUser(user.id)!;
    const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
    const inventory = repo.getUserInventory(user.id, user.server_code);

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
  } else if (response === 'y' || response === 'yes') {
    // Start object creation
    repo.updateUserState(user.id, 'CREATING_OBJ_NAME');

    socket.emit('game:log', {
      text: 'What is this object called?',
      type: 'prompt' as const,
      label: 'QUESTION',
    });

    const updatedUser = repo.getUser(user.id)!;
    const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
    const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
    const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
    const inventory = repo.getUserInventory(user.id, user.server_code);

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
  } else {
    socket.emit('game:log', {
      text: 'Please answer with "y" or "n".',
      type: 'error' as const,
    });
    return { handled: true };
  }
}

function handleObjName(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    return { handled: true };
  }

  tempItemData.name = input.trim();
  store.setTempItemData(user.id, tempItemData);

  // CRITICAL: Transition to Description, NOT Verb
  repo.updateUserState(user.id, 'CREATING_OBJ_DESC');

  socket.emit('game:log', {
    text: 'Describe this object.',
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

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

function handleObjDesc(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData || !tempItemData.name) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  tempItemData.description = input.trim(); // Allow blank
  store.setTempItemData(user.id, tempItemData);

  // Move Type selection before Verb
  repo.updateUserState(user.id, 'CREATING_OBJ_TYPE');

  socket.emit('game:log', {
    text: 'What type of object?\n1. Flavor\n2. Treasure\n3. Buff/Trap\n4. Pickup\n5. Enemy\n6. Gate',
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

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

function handleObjVerb(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData || !tempItemData.name) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  tempItemData.verb = input.trim().toLowerCase();
  store.setTempItemData(user.id, tempItemData);

  repo.updateUserState(user.id, 'CREATING_OBJ_SUCCESS_MSG');

  socket.emit('game:log', {
    text: `Describe what happens when someone ${tempItemData.verb} ${tempItemData.name}.`,
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);

  return {
    handled: true,
    shouldEmitState: {
      player: updatedUser,
      room: currentRoom,
      visibleRooms,
      roomItems,
    },
  };
}

function handleObjSuccessMsg(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData || !tempItemData.name) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  tempItemData.successMessage = input.trim(); // Allow blank
  store.setTempItemData(user.id, tempItemData);

  // Done - save and loop
  return finishObjectCreation(socket, user, tempItemData);
}

/**
 * Helper function to finish object creation and loop back
 */
function finishObjectCreation(socket: Socket, user: User, tempItemData: import('../state/store.js').TempItemData): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  // Determine effect_type and effect_value based on interaction type
  let effectType: 'GOLD' | 'HEAL' | 'DAMAGE' | 'NONE' | 'ITEM' = 'NONE';
  let effectValue = 0;
  let enemyHp = 0;
  let enemyMaxHp = 0;
  let enemyAttack = 0;
  let requiredItemId: string | null = null;

  if (tempItemData.interactionType === 'FLAVOR') {
    effectType = 'NONE';
    effectValue = 0;
  } else if (tempItemData.interactionType === 'TREASURE') {
    effectType = 'GOLD';
    effectValue = tempItemData.effectValue || 0;
  } else if (tempItemData.interactionType === 'BUFF_TRAP') {
    const value = tempItemData.effectValue || 0;
    effectType = value > 0 ? 'HEAL' : 'DAMAGE';
    effectValue = Math.abs(value);
  } else if (tempItemData.interactionType === 'PICKUP') {
    effectType = 'ITEM';
    effectValue = 0;
  } else if (tempItemData.interactionType === 'ENEMY') {
    effectType = 'NONE';
    effectValue = 0;
    enemyHp = tempItemData.enemyHp || 0;
    enemyMaxHp = tempItemData.enemyMaxHp || 0;
    enemyAttack = tempItemData.enemyAttack || 0;
  } else if (tempItemData.interactionType === 'GATE') {
    effectType = 'NONE';
    effectValue = 0;
    requiredItemId = tempItemData.requiredItemId || null;
  }

  // Insert item into database
  repo.createItem({
    room_id: tempItemData.roomId,
    owner_id: null,
    server_code: user.server_code,
    name: tempItemData.name!,
    description: tempItemData.description || '',
    success_message: tempItemData.successMessage || '',
    interact_verb: tempItemData.verb!,
    effect_type: effectType,
    effect_value: effectValue,
    is_hidden: 0,
    required_item_id: requiredItemId,
    enemy_hp: enemyHp,
    enemy_max_hp: enemyMaxHp,
    enemy_attack: enemyAttack,
    xp_value: tempItemData.interactionType === 'ENEMY' ? (tempItemData.xpValue || 10) : 10,
    is_infinite: tempItemData.isInfinite ? 1 : 0,
  });

  socket.emit('game:log', {
    text: `Object "${tempItemData.name}" created!`,
    type: 'info' as const,
  });

  // Loop back to object confirmation
  repo.updateUserState(user.id, 'CREATING_OBJ_CONFIRM');
  store.setTempItemData(user.id, { roomId: tempItemData.roomId });

  socket.emit('game:log', {
    text: 'Add an object? (y/n)',
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

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

/**
 * Step 1: The Type Menu (CREATING_OBJ_TYPE) - Now comes before Verb
 */
function handleObjType(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData || !tempItemData.name) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  const choice = parseInt(input.trim(), 10);
  if (isNaN(choice) || choice < 1 || choice > 6) {
    socket.emit('game:log', {
      text: 'Invalid selection. Please enter a number between 1 and 6.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  const typeMap: Record<number, 'FLAVOR' | 'TREASURE' | 'BUFF_TRAP' | 'PICKUP' | 'ENEMY' | 'GATE'> = {
    1: 'FLAVOR',
    2: 'TREASURE',
    3: 'BUFF_TRAP',
    4: 'PICKUP',
    5: 'ENEMY',
    6: 'GATE',
  };

  const interactionType = typeMap[choice];
  if (!interactionType) {
    socket.emit('game:log', {
      text: 'Invalid selection. Please enter a number between 1 and 6.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  tempItemData.interactionType = interactionType;
  
  // Auto-set verb based on type
  if (interactionType === 'ENEMY') {
    tempItemData.verb = 'fight';
    tempItemData.effectType = 'COMBAT';
  } else if (interactionType === 'TREASURE') {
    tempItemData.verb = 'search';
  }
  
  store.setTempItemData(user.id, tempItemData);

  // Branch based on type
  if (tempItemData.interactionType === 'FLAVOR') {
    // Type 1 (Flavor): Need verb
    repo.updateUserState(user.id, 'CREATING_OBJ_VERB');
    socket.emit('game:log', {
      text: 'What is the interaction verb? (e.g., "read", "touch", "examine")',
      type: 'prompt' as const,
      label: 'QUESTION',
    });
  } else if (tempItemData.interactionType === 'TREASURE') {
    // Type 2 (Treasure): Verb already set to 'search', ask for gold amount
    repo.updateUserState(user.id, 'CREATING_OBJ_VALUE');
    socket.emit('game:log', {
      text: 'How much Gold?',
      type: 'prompt' as const,
      label: 'QUESTION',
    });
  } else if (tempItemData.interactionType === 'BUFF_TRAP') {
    // Type 3 (Buff/Trap): Need verb, then value
    tempItemData.verb = 'touch';
    store.setTempItemData(user.id, tempItemData);
    repo.updateUserState(user.id, 'CREATING_OBJ_VALUE');
    socket.emit('game:log', {
      text: 'HP Change? (Positive/Negative)',
      type: 'prompt' as const,
      label: 'QUESTION',
    });
  } else if (tempItemData.interactionType === 'PICKUP') {
    // Type 4 (Pickup): Verb already set to 'take', ask about supply type
    if (!tempItemData.verb) {
      tempItemData.verb = 'take';
      store.setTempItemData(user.id, tempItemData);
    }
    repo.updateUserState(user.id, 'CREATING_OBJ_SUPPLY_TYPE');
    socket.emit('game:log', {
      text: 'Is this item Unique (disappears when taken) or Infinite (everyone can take one)? (1. Unique, 2. Infinite)',
      type: 'prompt' as const,
      label: 'QUESTION',
    });
  } else if (tempItemData.interactionType === 'ENEMY') {
    // Type 5 (Enemy): Verb already set to 'fight', ask for enemy stats
    repo.updateUserState(user.id, 'CREATING_OBJ_ENEMY_STATS');
    socket.emit('game:log', {
      text: 'Enter HP Attack XP (e.g., "20 4 50"):',
      type: 'prompt' as const,
      label: 'QUESTION',
    });
  } else if (tempItemData.interactionType === 'GATE') {
    // Type 6 (Gate): Verb already set to 'open', ask for requirement
    if (!tempItemData.verb) {
      tempItemData.verb = 'open';
      store.setTempItemData(user.id, tempItemData);
    }
    repo.updateUserState(user.id, 'CREATING_OBJ_REQUIREMENT');
    socket.emit('game:log', {
      text: 'Name of required Key?',
      type: 'prompt' as const,
      label: 'QUESTION',
    });
  }

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

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

/**
 * Step 2: Handle Value Input (CREATING_OBJ_VALUE)
 */
function handleObjValue(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData || !tempItemData.name || !tempItemData.interactionType) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  // Handle both positive and negative values for BUFF_TRAP
  const trimmedInput = input.trim();
  const isNegative = trimmedInput.startsWith('-');
  const value = parseInt(trimmedInput, 10);
  
  if (isNaN(value)) {
    socket.emit('game:log', {
      text: 'Invalid number. Please enter a valid integer (positive or negative).',
      type: 'error' as const,
    });
    return { handled: true };
  }

  tempItemData.effectValue = value; // Store as-is (negative for damage, positive for heal)
  store.setTempItemData(user.id, tempItemData);

  // Ask for verb confirmation (for Treasure and Buff/Trap)
  const defaultVerb = tempItemData.verb || 'interact';
  repo.updateUserState(user.id, 'CREATING_OBJ_VERB_CONFIRM');
  socket.emit('game:log', {
    text: `Default verb is '${defaultVerb}'. Press 'Y' to confirm or type a custom verb.`,
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

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

/**
 * Step 3: Handle Enemy Stats (CREATING_OBJ_ENEMY_STATS)
 */
function handleObjEnemyStats(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData || !tempItemData.name || !tempItemData.interactionType) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  const parts = input.trim().split(/\s+/);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    socket.emit('game:log', {
      text: 'Invalid format. Please enter "HP ATTACK XP" (e.g., "20 4 10").',
      type: 'error' as const,
    });
    return { handled: true };
  }

  const hp = parseInt(parts[0], 10);
  const attack = parseInt(parts[1], 10);
  const xp = parseInt(parts[2], 10);

  if (isNaN(hp) || isNaN(attack) || isNaN(xp) || hp <= 0 || attack <= 0 || xp <= 0) {
    socket.emit('game:log', {
      text: 'Invalid values. HP, Attack, and XP must be positive integers.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  tempItemData.enemyHp = hp;
  tempItemData.enemyMaxHp = hp;
  tempItemData.enemyAttack = attack;
  tempItemData.xpValue = xp;
  store.setTempItemData(user.id, tempItemData);

  // Ask for success message
  repo.updateUserState(user.id, 'CREATING_OBJ_SUCCESS_MSG');
  socket.emit('game:log', {
    text: `Describe what happens when someone ${tempItemData.verb} ${tempItemData.name}.`,
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

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

/**
 * Step 4: Handle Supply Type (CREATING_OBJ_SUPPLY_TYPE) - For Pickup items
 */
function handleObjSupplyType(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData || !tempItemData.name || !tempItemData.interactionType) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  const choice = parseInt(input.trim(), 10);
  if (isNaN(choice) || (choice !== 1 && choice !== 2)) {
    socket.emit('game:log', {
      text: 'Invalid selection. Please enter 1 for Unique or 2 for Infinite.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Set isInfinite based on choice
  tempItemData.isInfinite = choice === 2;
  store.setTempItemData(user.id, tempItemData);

  // Ask for verb confirmation (for Pickup)
  const defaultVerb = tempItemData.verb || 'take';
  repo.updateUserState(user.id, 'CREATING_OBJ_VERB_CONFIRM');
  socket.emit('game:log', {
    text: `Default verb is '${defaultVerb}'. Press 'Y' to confirm or type a custom verb.`,
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

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

/**
 * Step 5: Handle Requirement (CREATING_OBJ_REQUIREMENT)
 */
function handleObjRequirement(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData || !tempItemData.name || !tempItemData.interactionType) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  const requiredItemName = input.trim();
  if (!requiredItemName) {
    socket.emit('game:log', {
      text: 'Item name cannot be empty.',
      type: 'error' as const,
    });
    return { handled: true };
  }

  // Search for item by name (fuzzy match - case insensitive)
  const allItems = repo.getRoomItems(tempItemData.roomId, user.server_code);
  const matchingItem = allItems.find(
    (item) => item.name.toLowerCase() === requiredItemName.toLowerCase(),
  );

  if (matchingItem) {
    tempItemData.requiredItemId = matchingItem.id;
    tempItemData.requiredItemName = matchingItem.name;
    socket.emit('game:log', {
      text: `Found item: "${matchingItem.name}". Gate will require this item.`,
      type: 'info' as const,
    });
  } else {
    // Warn but allow it (item might be created later)
    tempItemData.requiredItemId = null;
    tempItemData.requiredItemName = requiredItemName;
    socket.emit('game:log', {
      text: `Warning: Item "${requiredItemName}" not found in this room. Gate will be created but may not work until the item exists.`,
      type: 'error' as const,
    });
  }

  store.setTempItemData(user.id, tempItemData);

  // Ask for verb confirmation (for Gate)
  const defaultVerb = tempItemData.verb || 'open';
  repo.updateUserState(user.id, 'CREATING_OBJ_VERB_CONFIRM');
  socket.emit('game:log', {
    text: `Default verb is '${defaultVerb}'. Press 'Y' to confirm or type a custom verb.`,
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

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

/**
 * Step 5: Handle Verb Confirmation (CREATING_OBJ_VERB_CONFIRM)
 */
function handleObjVerbConfirm(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData || !tempItemData.name || !tempItemData.interactionType) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  const trimmedInput = input.trim().toLowerCase();
  
  // If user confirms with 'y', use the default verb
  if (trimmedInput === 'y' || trimmedInput === 'yes') {
    // Verb is already set in tempItemData, keep it
  } else {
    // User provided a custom verb
    tempItemData.verb = trimmedInput;
  }
  
  store.setTempItemData(user.id, tempItemData);

  // Proceed to success message
  repo.updateUserState(user.id, 'CREATING_OBJ_SUCCESS_MSG');
  socket.emit('game:log', {
    text: `Describe what happens when someone ${tempItemData.verb} ${tempItemData.name}.`,
    type: 'prompt' as const,
    label: 'QUESTION',
  });

  const updatedUser = repo.getUser(user.id)!;
  const currentRoom = repo.getRoom(user.current_q, user.current_r, user.server_code)!;
  const visibleRooms = repo.getVisibleRooms(updatedUser.current_q, updatedUser.current_r, user.server_code);
  const roomItems = repo.getRoomItems(currentRoom.id, user.server_code);
  const inventory = repo.getUserInventory(user.id, user.server_code);

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

/**
 * Step 6: Handle Contents (CREATING_OBJ_CONTENTS) - For future container logic
 */
function handleObjContents(socket: Socket, user: User, input: string): { handled: boolean; shouldEmitState?: StateUpdatePayload } {
  // Placeholder for future container/contents logic
  // For now, just finish creation
  const tempItemData = store.getTempItemData(user.id);
  if (!tempItemData) {
    socket.emit('game:log', {
      text: 'Creation session expired. Please try again.',
      type: 'error' as const,
    });
    repo.updateUserState(user.id, 'IDLE');
    store.deleteTempItemData(user.id);
    return { handled: true };
  }

  return finishObjectCreation(socket, user, tempItemData);
}

/**
 * Generate and save animations for a room and its items
 */
async function generateAndSaveAnimations(
  socket: Socket,
  user: User,
  room: Room,
  items: Item[],
  mood: string,
): Promise<void> {
  try {
    // Generate room symbol
    const symbol = await aiService.generateRoomSymbol(room, mood);
    repo.updateRoomSymbol(room.id, symbol);

    // Generate room tapestry
    const roomFrames = await aiService.generateRoomTapestry(room, items, mood);
    repo.createAnimation({
      room_id: room.id,
      object_id: null,
      type: 'TAPESTRY',
      frames: roomFrames,
      fps: 2,
    });

    // Generate interaction animations for each item in parallel
    const itemAnimationPromises = items.map(async (item) => {
      try {
        const frames = await aiService.generateObjectInteraction(item);
        repo.createAnimation({
          room_id: room.id,
          object_id: item.id,
          type: 'INTERACTION',
          frames,
          fps: 2,
        });
      } catch (error) {
        console.error(`Failed to generate animation for item ${item.id}:`, error);
        // Continue with other items even if one fails
      }
    });

    await Promise.all(itemAnimationPromises);
  } catch (error) {
    console.error('Animation generation error:', error);
    throw error; // Re-throw to be handled by caller
  }
}

