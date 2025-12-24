# Project Specification: Adventure Island (v0)

## 1. Architecture Overview
- **Type:** Browser-based Text MMO with Real-time Elements.
- **Frontend:** React + TypeScript (built via Vite).
- **Backend:** Node.js + Fastify + Socket.io.
- **Database:** SQLite (`better-sqlite3`) with WAL mode enabled.
- **Communication:** Bi-directional Websockets (Socket.io) for game state; REST is minimal/non-existent.

## 2. Core Systems
### A. The Grid (Hexagonal)
- **Coordinate System:** Axial Coordinates (q, r).
- **Storage:** Stored in DB as integers `q` and `r`.
- **Adjacency Logic:**
  - North: (q, r-1) | South: (q, r+1)
  - NE: (q+1, r-1)  | SW: (q-1, r+1)
  - NW: (q-1, r)    | SE: (q+1, r)

### B. Multiplayer & Locking
- **Room Locking:** - Moving to an empty coordinate sets `locked_by` (User ID) and `lock_expires_at` (Timestamp).
  - If a user disconnects or timer expires, the lock clears.
- **Room Creation:** Blocking state. User cannot move until they "Publish" or "Cancel".

### C. Combat
- **Mechanic:** "Tug of War" (Visual only).
- **Logic:** Server calculates result instantly based on stats + RNG.
- **Client:** Renders ASCII-style animation for ~5 seconds before showing result.

## 3. Data Structures (TypeScript Interfaces)

### `User`
- id: string (UUID)
- handle: string
- strength: number (default 1)
- hp: number (current health)
- max_hp: number (default 100)
- gold: number
- current_q: number
- current_r: number
- state: 'IDLE' | 'CREATING_ROOM' | 'COMBAT'

### `Room`
- id: string (UUID)
- q: number
- r: number
- title: string
- description: string
- shroud_level: number (0-5)
- created_by: string (User ID)

### `Item`
- id: string
- name: string
- room_id: string (if in room)
- owner_id: string (if in inventory)
- interact_verb: string (e.g., "lift")
- required_item_id?: string
- is_hidden: boolean
- is_enemy: boolean

## 4. Directory Structure
```text
/
├── client/              # Vite + React Frontend
│   ├── src/
│   │   ├── components/  # React Components (Terminal, HexMap, HUD)
│   │   ├── hooks/       # Custom hooks (useSocket, useGameCmd)
│   │   ├── types/       # Shared TS types (Synced manually)
│   │   ├── App.tsx
│   │   └── main.tsx
├── server/              # Node + Fastify Backend
│   ├── src/
│   │   ├── db/          # SQLite setup & migrations
│   │   ├── handlers/    # Socket event handlers
│   │   ├── types/       # Shared TS types
│   │   └── index.ts     # Entry point
├── package.json         # Root scripts (optional)


5. Socket Events
- client -> server:
- cmd:input (payload: { raw: string }) -> Main entry for all commands (go, get, attack).
- room:create (payload: { title, desc, ... })
- server -> client:
- game:log (payload: { text: string, type: 'info'|'error'|'chat' })
- state:update (payload: { player: User, room: Room, playersInRoom: string[] })
- combat:animate (payload: { result: 'win'|'loss', damage: number })
