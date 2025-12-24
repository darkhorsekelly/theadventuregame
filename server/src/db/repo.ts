import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { User, Room, Item, Animation } from '../types/index.js';

let db: Database.Database | null = null;

export function initDatabase(dbPath: string): Database.Database {
  if (db) {
    return db;
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  // Run migrations for existing databases
  runMigrations(db);
  
  return db;
}

function runMigrations(database: Database.Database): void {
  // Check if users table exists and add columns
  try {
    const usersTableInfo = database.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const usersColumnNames = usersTableInfo.map((col) => col.name);
    
    if (!usersColumnNames.includes('password_hash')) {
      database.exec('ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ""');
    }
    if (!usersColumnNames.includes('server_code')) {
      const defaultCode = process.env.DEFAULT_SERVER_CODE || 'default';
      database.exec(`ALTER TABLE users ADD COLUMN server_code TEXT NOT NULL DEFAULT '${defaultCode}'`);
    }
  } catch (error) {
    // Table doesn't exist yet, schema.sql will create it with all columns
  }

  // Check if rooms table exists and add columns
  try {
    const roomsTableInfo = database.prepare("PRAGMA table_info(rooms)").all() as Array<{ name: string }>;
    const roomsColumnNames = roomsTableInfo.map((col) => col.name);
    
    if (!roomsColumnNames.includes('symbol')) {
      database.exec('ALTER TABLE rooms ADD COLUMN symbol TEXT');
    }
    if (!roomsColumnNames.includes('server_code')) {
      const defaultCode = process.env.DEFAULT_SERVER_CODE || 'default';
      database.exec(`ALTER TABLE rooms ADD COLUMN server_code TEXT NOT NULL DEFAULT '${defaultCode}'`);
    }
  } catch (error) {
    // Table doesn't exist yet, schema.sql will create it with all columns
  }

  // Check if items table exists and if columns exist
  try {
    const tableInfo = database.prepare("PRAGMA table_info(items)").all() as Array<{ name: string }>;
    const columnNames = tableInfo.map((col) => col.name);
    
    // Add owner_id if it doesn't exist
    if (!columnNames.includes('owner_id')) {
      database.exec('ALTER TABLE items ADD COLUMN owner_id TEXT');
      database.exec('CREATE INDEX IF NOT EXISTS idx_items_owner_id ON items(owner_id)');
    }
    
    // Add enemy stats columns if they don't exist
    if (!columnNames.includes('enemy_hp')) {
      database.exec('ALTER TABLE items ADD COLUMN enemy_hp INTEGER NOT NULL DEFAULT 0');
    }
    if (!columnNames.includes('enemy_max_hp')) {
      database.exec('ALTER TABLE items ADD COLUMN enemy_max_hp INTEGER NOT NULL DEFAULT 0');
    }
    if (!columnNames.includes('enemy_attack')) {
      database.exec('ALTER TABLE items ADD COLUMN enemy_attack INTEGER NOT NULL DEFAULT 0');
    }
    if (!columnNames.includes('xp_value')) {
      database.exec('ALTER TABLE items ADD COLUMN xp_value INTEGER NOT NULL DEFAULT 10');
    }
    
    // Add required_item_id if it doesn't exist
    if (!columnNames.includes('required_item_id')) {
      database.exec('ALTER TABLE items ADD COLUMN required_item_id TEXT');
    }
    
    // Add success_message if it doesn't exist
    if (!columnNames.includes('success_message')) {
      database.exec('ALTER TABLE items ADD COLUMN success_message TEXT NOT NULL DEFAULT ""');
    }
    // Add server_code if it doesn't exist
    if (!columnNames.includes('server_code')) {
      const defaultCode = process.env.DEFAULT_SERVER_CODE || 'default';
      database.exec(`ALTER TABLE items ADD COLUMN server_code TEXT NOT NULL DEFAULT '${defaultCode}'`);
    }
  } catch (error) {
    // Table doesn't exist yet, schema.sql will create it with all columns
    // This is fine, just continue
  }
}

export function setDatabase(database: Database.Database): void {
  db = database;
}

function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// User operations
export function getUser(id: string): User | undefined {
  const stmt = getDb().prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as User | undefined;
}

export function createUser(id: string, userData: Omit<User, 'id'>, passwordHash: string): User {
  const stmt = getDb().prepare(
    'INSERT INTO users (id, handle, password_hash, server_code, strength, hp, max_hp, gold, current_q, current_r, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  stmt.run(
    id,
    userData.handle,
    passwordHash,
    userData.server_code,
    userData.strength,
    userData.hp,
    userData.max_hp,
    userData.gold,
    userData.current_q,
    userData.current_r,
    userData.state,
  );
  const user = getUser(id);
  if (!user) {
    throw new Error('Failed to create user');
  }
  return user;
}

export function getUserByHandle(handle: string, serverCode?: string): User | undefined {
  if (serverCode) {
    // Filter by server_code for realm isolation
    const stmt = getDb().prepare('SELECT id, handle, server_code, strength, hp, max_hp, gold, current_q, current_r, state FROM users WHERE handle = ? AND server_code = ?');
    return stmt.get(handle, serverCode) as User | undefined;
  } else {
    // Legacy behavior: check globally (for login compatibility)
    const stmt = getDb().prepare('SELECT id, handle, server_code, strength, hp, max_hp, gold, current_q, current_r, state FROM users WHERE handle = ?');
    return stmt.get(handle) as User | undefined;
  }
}

export function getUserPasswordHash(userId: string): string | undefined {
  const stmt = getDb().prepare('SELECT password_hash FROM users WHERE id = ?');
  const result = stmt.get(userId) as { password_hash: string } | undefined;
  return result?.password_hash;
}

export function updateUserPosition(id: string, q: number, r: number): void {
  const stmt = getDb().prepare('UPDATE users SET current_q = ?, current_r = ? WHERE id = ?');
  stmt.run(q, r, id);
}

export function updateUserState(id: string, state: User['state']): void {
  const stmt = getDb().prepare('UPDATE users SET state = ? WHERE id = ?');
  stmt.run(state, id);
}

// Room operations
export function getRoom(q: number, r: number, serverCode: string): Room | undefined {
  if (!serverCode) {
    throw new Error('serverCode is required for getRoom');
  }
  const stmt = getDb().prepare('SELECT * FROM rooms WHERE q = ? AND r = ? AND server_code = ?');
  return stmt.get(q, r, serverCode) as Room | undefined;
}

export function updateRoomSymbol(roomId: string, symbol: string): void {
  const stmt = getDb().prepare('UPDATE rooms SET symbol = ? WHERE id = ?');
  stmt.run(symbol, roomId);
}

export function createRoom(room: Omit<Room, 'id'>): Room {
  if (!room.server_code) {
    throw new Error('server_code is required for createRoom');
  }
  const id = uuidv4();
  const stmt = getDb().prepare<[string, number, number, string, string, string, number, string, string | null]>(
    'INSERT INTO rooms (id, q, r, server_code, title, description, shroud_level, created_by, symbol) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  stmt.run(id, room.q, room.r, room.server_code, room.title, room.description, room.shroud_level, room.created_by, room.symbol ?? null);
  const createdRoom = getRoom(room.q, room.r, room.server_code);
  if (!createdRoom) {
    throw new Error('Failed to create room');
  }
  return createdRoom;
}

export function getVisibleRooms(q: number, r: number, serverCode: string, radius: number = 5): Room[] {
  if (!serverCode) {
    throw new Error('serverCode is required for getVisibleRooms');
  }
  const minQ = q - radius;
  const maxQ = q + radius;
  const minR = r - radius;
  const maxR = r + radius;
  const stmt = getDb().prepare('SELECT * FROM rooms WHERE q BETWEEN ? AND ? AND r BETWEEN ? AND ? AND server_code = ?');
  return stmt.all(minQ, maxQ, minR, maxR, serverCode) as Room[];
}

export function ensureSystemUser(serverCode: string = 'default'): void {
  const user = getUser('system');
  if (!user) {
    const stmt = getDb().prepare(
      'INSERT INTO users (id, handle, password_hash, server_code, strength, hp, max_hp, gold, current_q, current_r, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    stmt.run('system', 'System', '', serverCode, 1, 100, 100, 0, 0, 0, 'IDLE');
  }
}

export function ensureGenesisRoom(serverCode: string, creatorId: string): void {
  if (!serverCode) {
    throw new Error('serverCode is required for ensureGenesisRoom');
  }
  if (!creatorId) {
    throw new Error('Genesis Room requires a valid Creator ID');
  }
  
  // Validate that the creator exists
  const creator = getUser(creatorId);
  if (!creator) {
    throw new Error(`Invalid creator ID: ${creatorId} does not exist`);
  }
  // Also validate server_code matches
  if (creator.server_code !== serverCode) {
    throw new Error(`Creator ID ${creatorId} belongs to a different server_code (${creator.server_code} vs ${serverCode})`);
  }
  
  const existingRoom = getRoom(0, 0, serverCode);
  if (!existingRoom) {
    const stmt = getDb().prepare<[string, number, number, string, string, string, number, string]>(
      'INSERT INTO rooms (id, q, r, server_code, title, description, shroud_level, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    stmt.run(
      uuidv4(),
      0,
      0,
      serverCode,
      'The Crash Site',
      'You stand amidst the wreckage of your arrival. The island stretches out in all directions.',
      0,
      creatorId, // Use the provided creator ID instead of hardcoded 'system'
    );
  }
}

// Item operations
export function getRoomItems(roomId: string, serverCode: string): Item[] {
  if (!serverCode) {
    throw new Error('serverCode is required for getRoomItems');
  }
  const stmt = getDb().prepare('SELECT * FROM items WHERE room_id = ? AND owner_id IS NULL AND server_code = ?');
  return stmt.all(roomId, serverCode) as Item[];
}

export function getItem(itemId: string): Item | undefined {
  const stmt = getDb().prepare('SELECT * FROM items WHERE id = ?');
  return stmt.get(itemId) as Item | undefined;
}

export function getItemByName(roomId: string, name: string, serverCode: string): Item | undefined {
  if (!serverCode) {
    throw new Error('serverCode is required for getItemByName');
  }
  const stmt = getDb().prepare('SELECT * FROM items WHERE room_id = ? AND LOWER(name) = LOWER(?) AND owner_id IS NULL AND server_code = ?');
  return stmt.get(roomId, name, serverCode) as Item | undefined;
}

export function getUserInventory(userId: string, serverCode: string): Item[] {
  if (!serverCode) {
    throw new Error('serverCode is required for getUserInventory');
  }
  const stmt = getDb().prepare('SELECT * FROM items WHERE owner_id = ? AND server_code = ?');
  return stmt.all(userId, serverCode) as Item[];
}

export function updateUserStats(userId: string, stats: Partial<Pick<User, 'hp' | 'max_hp' | 'gold' | 'strength'>>): void {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (stats.hp !== undefined) {
    updates.push('hp = ?');
    values.push(stats.hp);
  }
  if (stats.max_hp !== undefined) {
    updates.push('max_hp = ?');
    values.push(stats.max_hp);
  }
  if (stats.gold !== undefined) {
    updates.push('gold = ?');
    values.push(stats.gold);
  }
  if (stats.strength !== undefined) {
    updates.push('strength = ?');
    values.push(stats.strength);
  }

  if (updates.length === 0) {
    return;
  }

  values.push(userId);
  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = getDb().prepare(sql);
  stmt.run(...values);
}

export function setItemOwner(itemId: string, ownerId: string | null, roomId: string | null): void {
  const stmt = getDb().prepare('UPDATE items SET owner_id = ?, room_id = ? WHERE id = ?');
  stmt.run(ownerId, roomId, itemId);
}

export function updateItemEnemyHp(itemId: string, hp: number): void {
  const stmt = getDb().prepare('UPDATE items SET enemy_hp = ? WHERE id = ?');
  stmt.run(hp, itemId);
}

export function deleteItem(itemId: string): void {
  const db = getDb();
  
  // Delete animations that reference this item
  const deleteAnimationsStmt = db.prepare('DELETE FROM animations WHERE object_id = ?');
  deleteAnimationsStmt.run(itemId);
  
  // Clear required_item_id references to this item (set to NULL)
  const clearRequiredItemStmt = db.prepare('UPDATE items SET required_item_id = NULL WHERE required_item_id = ?');
  clearRequiredItemStmt.run(itemId);
  
  // Now delete the item itself
  const deleteItemStmt = db.prepare('DELETE FROM items WHERE id = ?');
  deleteItemStmt.run(itemId);
}

export function createItem(item: Omit<Item, 'id'>): Item {
  if (!item.server_code) {
    throw new Error('server_code is required for createItem');
  }
  const id = uuidv4();
  const stmt = getDb().prepare<[string, string | null, string | null, string, string, string, string, string, string, number, number, string | null, number, number, number, number]>(
    'INSERT INTO items (id, room_id, owner_id, server_code, name, description, success_message, interact_verb, effect_type, effect_value, is_hidden, required_item_id, enemy_hp, enemy_max_hp, enemy_attack, xp_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  stmt.run(
    id,
    item.room_id ?? null,
    item.owner_id ?? null,
    item.server_code,
    item.name,
    item.description,
    item.success_message ?? '',
    item.interact_verb,
    item.effect_type,
    item.effect_value,
    item.is_hidden,
    item.required_item_id ?? null,
    item.enemy_hp ?? 0,
    item.enemy_max_hp ?? 0,
    item.enemy_attack ?? 0,
    item.xp_value ?? 10,
  );
  const createdItem = getDb()
    .prepare('SELECT * FROM items WHERE id = ?')
    .get(id) as Item;
  return createdItem;
}

// Animation operations
export function createAnimation(anim: Omit<Animation, 'id'>): Animation {
  const id = uuidv4();
  const framesJson = JSON.stringify(anim.frames);
  const stmt = getDb().prepare<[string, string | null, string | null, string, string, number]>(
    'INSERT INTO animations (id, room_id, object_id, type, frames, fps) VALUES (?, ?, ?, ?, ?, ?)',
  );
  stmt.run(id, anim.room_id, anim.object_id, anim.type, framesJson, anim.fps);
  const createdAnim = getDb()
    .prepare('SELECT * FROM animations WHERE id = ?')
    .get(id) as { id: string; room_id: string | null; object_id: string | null; type: string; frames: string; fps: number };
  
  // Parse frames JSON back to array
  return {
    id: createdAnim.id,
    room_id: createdAnim.room_id,
    object_id: createdAnim.object_id,
    type: createdAnim.type as Animation['type'],
    frames: JSON.parse(createdAnim.frames) as string[],
    fps: createdAnim.fps,
  };
}

export function getRoomAnimations(roomId: string): Animation[] {
  const stmt = getDb().prepare('SELECT * FROM animations WHERE room_id = ?');
  const rows = stmt.all(roomId) as Array<{
    id: string;
    room_id: string | null;
    object_id: string | null;
    type: string;
    frames: string;
    fps: number;
  }>;
  
  return rows.map((row) => ({
    id: row.id,
    room_id: row.room_id,
    object_id: row.object_id,
    type: row.type as Animation['type'],
    frames: JSON.parse(row.frames) as string[],
    fps: row.fps,
  }));
}

export function getRoomAnimationByType(roomId: string, type: Animation['type']): Animation | undefined {
  const stmt = getDb().prepare('SELECT * FROM animations WHERE room_id = ? AND type = ?');
  const row = stmt.get(roomId, type) as {
    id: string;
    room_id: string | null;
    object_id: string | null;
    type: string;
    frames: string;
    fps: number;
  } | undefined;
  
  if (!row) {
    return undefined;
  }
  
  return {
    id: row.id,
    room_id: row.room_id,
    object_id: row.object_id,
    type: row.type as Animation['type'],
    frames: JSON.parse(row.frames) as string[],
    fps: row.fps,
  };
}

export function getItemAnimation(itemId: string, type: Animation['type'] = 'INTERACTION'): Animation | undefined {
  const stmt = getDb().prepare('SELECT * FROM animations WHERE object_id = ? AND type = ?');
  const row = stmt.get(itemId, type) as {
    id: string;
    room_id: string | null;
    object_id: string | null;
    type: string;
    frames: string;
    fps: number;
  } | undefined;
  
  if (!row) {
    return undefined;
  }
  
  return {
    id: row.id,
    room_id: row.room_id,
    object_id: row.object_id,
    type: row.type as Animation['type'],
    frames: JSON.parse(row.frames) as string[],
    fps: row.fps,
  };
}

export function deleteRoomAnimations(roomId: string): void {
  const stmt = getDb().prepare('DELETE FROM animations WHERE room_id = ?');
  stmt.run(roomId);
}

export function deleteAnimation(animationId: string): void {
  const stmt = getDb().prepare('DELETE FROM animations WHERE id = ?');
  stmt.run(animationId);
}

