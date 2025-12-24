export interface TempRoomData {
  title?: string;
  description?: string;
  mood?: string;
  q: number;
  r: number;
}

export interface TempItemData {
  name?: string;
  description?: string;
  verb?: string;
  successMessage?: string;
  effectType?: 'GOLD' | 'HEAL' | 'DAMAGE' | 'NONE' | 'ITEM' | 'COMBAT';
  effectValue?: number;
  interactionType?: 'FLAVOR' | 'TREASURE' | 'BUFF_TRAP' | 'PICKUP' | 'ENEMY' | 'GATE';
  enemyHp?: number;
  enemyMaxHp?: number;
  enemyAttack?: number;
  isInfinite?: boolean;
  xpValue?: number;
  requiredItemId?: string | null;
  requiredItemName?: string;
  roomId: string;
}

const socketUserMap = new Map<string, string>();
const tempRoomDataMap = new Map<string, TempRoomData>();
const tempItemDataMap = new Map<string, TempItemData>();

export function getSession(socketId: string): string | undefined {
  return socketUserMap.get(socketId);
}

export function setSession(socketId: string, userId: string): void {
  socketUserMap.set(socketId, userId);
}

export function deleteSession(socketId: string): void {
  const userId = socketUserMap.get(socketId);
  if (userId) {
    tempRoomDataMap.delete(userId);
    tempItemDataMap.delete(userId);
  }
  socketUserMap.delete(socketId);
}

export function getTempRoomData(userId: string): TempRoomData | undefined {
  return tempRoomDataMap.get(userId);
}

export function setTempRoomData(userId: string, data: TempRoomData): void {
  tempRoomDataMap.set(userId, data);
}

export function deleteTempRoomData(userId: string): void {
  tempRoomDataMap.delete(userId);
}

export function getTempItemData(userId: string): TempItemData | undefined {
  return tempItemDataMap.get(userId);
}

export function setTempItemData(userId: string, data: TempItemData): void {
  tempItemDataMap.set(userId, data);
}

export function deleteTempItemData(userId: string): void {
  tempItemDataMap.delete(userId);
}

