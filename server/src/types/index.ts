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
  state:
    | 'IDLE'
    | 'CREATING_ROOM_TITLE'
    | 'CREATING_ROOM_DESC'
    | 'CREATING_ROOM_MOOD'
    | 'CREATING_ROOM_SHROUD'
    | 'CREATING_OBJ_CONFIRM'
    | 'CREATING_OBJ_NAME'
    | 'CREATING_OBJ_DESC'
    | 'CREATING_OBJ_VERB'
    | 'CREATING_OBJ_SUCCESS_MSG'
    | 'CREATING_OBJ_TYPE'
    | 'CREATING_OBJ_VALUE'
    | 'CREATING_OBJ_CONTENTS'
    | 'CREATING_OBJ_ENEMY_STATS'
    | 'CREATING_OBJ_REQUIREMENT'
    | 'GENERATING_ANIMATIONS'
    | 'COMBAT';
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
  enemy_hp: number;
  enemy_max_hp: number;
  enemy_attack: number;
  xp_value: number;
}

export interface Animation {
  id: string;
  room_id: string | null;
  object_id: string | null;
  type: 'TAPESTRY' | 'INTERACTION' | 'COMBAT_DURING' | 'COMBAT_VICTORY' | 'COMBAT_RETREAT';
  frames: string[];
  fps: number;
}

