export interface User {
  id: string;
  handle: string;
  server_code: string;
  strength: number;
  hp: number;
  max_hp: number;
  gold: number;
  current_q: number;
  current_r: number;
  state: 'IDLE' | 'CREATING_ROOM_TITLE' | 'CREATING_ROOM_DESC' | 'CREATING_ROOM_SHROUD' | 'COMBAT';
}

export interface Room {
  id: string;
  q: number;
  r: number;
  server_code: string;
  title: string;
  description: string;
  shroud_level: number;
  created_by: string;
  symbol?: string;
}

export interface Item {
  id: string;
  room_id: string | null;
  owner_id: string | null;
  server_code: string;
  name: string;
  description: string;
  success_message: string;
  interact_verb: string;
  effect_type: 'GOLD' | 'HEAL' | 'DAMAGE' | 'NONE' | 'ITEM';
  effect_value: number;
  is_hidden: number;
  required_item_id: string | null;
  enemy_hp?: number;
  enemy_max_hp?: number;
  enemy_attack?: number;
  xp_value?: number;
  is_infinite?: number;
}

export interface Animation {
  id: string;
  room_id: string | null;
  object_id: string | null;
  type: 'TAPESTRY' | 'INTERACTION' | 'COMBAT_DURING' | 'COMBAT_VICTORY' | 'COMBAT_RETREAT';
  frames: string[];
  fps: number;
}

export interface StateUpdatePayload {
  player: User;
  room: Room;
  visibleRooms: Room[];
  roomItems: Item[];
  playersInRoom?: string[];
  inventory?: Item[];
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

export interface CombatEndPayload {
  result: 'win' | 'loss' | 'retreat';
  loot?: { gold: number };
}


