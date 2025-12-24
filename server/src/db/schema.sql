PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  server_code TEXT NOT NULL DEFAULT 'default',
  strength INTEGER NOT NULL DEFAULT 1,
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL DEFAULT 100,
  gold INTEGER NOT NULL DEFAULT 0,
  current_q INTEGER NOT NULL,
  current_r INTEGER NOT NULL,
  state TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  q INTEGER NOT NULL,
  r INTEGER NOT NULL,
  server_code TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  shroud_level INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  symbol TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  owner_id TEXT,
  server_code TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  success_message TEXT NOT NULL DEFAULT '',
  interact_verb TEXT NOT NULL,
  effect_type TEXT NOT NULL,
  effect_value INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  required_item_id TEXT,
  enemy_hp INTEGER NOT NULL DEFAULT 0,
  enemy_max_hp INTEGER NOT NULL DEFAULT 0,
  enemy_attack INTEGER NOT NULL DEFAULT 0,
  xp_value INTEGER NOT NULL DEFAULT 10,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (required_item_id) REFERENCES items(id)
);

-- Migration: Add new columns if they don't exist (for existing databases)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a helper function
-- In production, need to use proper migration handling

CREATE TABLE IF NOT EXISTS animations (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  object_id TEXT,
  type TEXT NOT NULL,
  frames TEXT NOT NULL,
  fps INTEGER NOT NULL DEFAULT 2,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (object_id) REFERENCES items(id)
);

