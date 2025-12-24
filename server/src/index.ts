import Fastify from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import type { User, Room, Item } from './types/index.js';
import * as repo from './db/repo.js';
import * as store from './state/store.js';
import * as movement from './handlers/movement.js';
import * as creation from './handlers/creation.js';
import * as general from './handlers/general.js';
import * as interaction from './handlers/interaction.js';
import * as combat from './handlers/combat.js';
import * as authService from './services/auth.js';
import fastifyStatic from '@fastify/static';

// Load environment variables from .env file in server directory
const serverDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(serverDir, '..', '.env') });
console.log('Database Path:', process.env.DB_PATH);
console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
console.log('Server Access Code:', process.env.SERVER_ACCESS_CODE ? 'Set' : 'Not set (server is open)');

interface StateUpdatePayload {
  player: User;
  room: Room;
  visibleRooms: Room[];
  roomItems: Item[];
  inventory?: Item[];
}

async function main() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const dbFile = process.env.DB_PATH ?? path.join(currentDir, '..', 'game.db');
  const db = repo.initDatabase(dbFile);

  const schemaPath = path.join(currentDir, 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // System user and genesis room are created per-realm on connection

  const fastify = Fastify({
    logger: true,
  });

  // Minimal CORS handling
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return payload;
  });

  fastify.options('/*', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.send();
  });

  // Test endpoint to verify server is working
  fastify.get('/api/test', async (request, reply) => {
    fastify.log.info('Test endpoint hit');
    return { success: true, message: 'Server is running!' };
  });

  // Auth endpoints
  fastify.post('/api/signup', async (request, reply) => {
    fastify.log.info('Signup request received');
    try {
      const body = request.body as { handle: string; password: string; accessCode?: string; serverCode?: string };
      fastify.log.info(`Signup body: handle=${body.handle}, hasAccessCode=${!!body.accessCode}, serverCode=${body.serverCode}`);
      
      // Check access code FIRST, before any other logic
      const serverAccessCode = process.env.SERVER_ACCESS_CODE;
      if (serverAccessCode && body.accessCode !== serverAccessCode) {
        fastify.log.warn('Access code mismatch');
        reply.code(403).send({ success: false, error: 'ACCESS DENIED: Invalid Server Code.' });
        return;
      }
      
      if (!body.serverCode) {
        fastify.log.warn('Missing island code');
        reply.code(400).send({ success: false, error: 'Island code is required' });
        return;
      }
      
      fastify.log.info('Calling authService.signup');
      const result = await authService.signup(body.handle, body.password, body.serverCode);
      fastify.log.info(`Signup result: success=${result.success}, hasToken=${!!result.token}, error=${result.error || 'none'}`);
      
      if (result.success && result.token && result.user) {
        reply.send({ success: true, token: result.token, user: result.user });
      } else {
        reply.code(400).send({ success: false, error: result.error || 'Signup failed' });
      }
    } catch (error) {
      fastify.log.error(`Signup error: ${error instanceof Error ? error.message : String(error)}`);
      reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });

  fastify.post('/api/login', async (request, reply) => {
    try {
      const body = request.body as { handle: string; password: string; accessCode?: string; serverCode?: string };
      
      // Check access code FIRST, before any other logic
      const serverAccessCode = process.env.SERVER_ACCESS_CODE;
      if (serverAccessCode && body.accessCode !== serverAccessCode) {
        reply.code(403).send({ success: false, error: 'ACCESS DENIED: Invalid Server Code.' });
        return;
      }
      
      if (!body.serverCode) {
        reply.code(400).send({ success: false, error: 'Island code is required' });
        return;
      }
      
      const result = await authService.login(body.handle, body.password, body.serverCode);
      
      if (result.success && result.token && result.user) {
        reply.send({ success: true, token: result.token, user: result.user });
      } else {
        reply.code(401).send({ success: false, error: result.error || 'Login failed' });
      }
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // --- STATIC FILE DEBUG ---
  // Determine client build path
  // When compiled: server/dist/index.js -> ../../client/dist
  // When running with tsx: server/src/index.ts -> ../../client/dist
  const clientBuildPath = path.resolve(currentDir, '../../client/dist');
  
  fastify.log.info('--- STATIC FILE DEBUG ---');
  fastify.log.info(`Current __dirname: ${currentDir}`);
  fastify.log.info(`Looking for client build at: ${clientBuildPath}`);
  fastify.log.info(`Does directory exist? ${fs.existsSync(clientBuildPath)}`);
  
  if (fs.existsSync(clientBuildPath)) {
    const contents = fs.readdirSync(clientBuildPath);
    fastify.log.info(`Directory contents: ${contents.join(', ')}`);
    const indexPath = path.join(clientBuildPath, 'index.html');
    fastify.log.info(`index.html exists? ${fs.existsSync(indexPath)}`);
  } else {
    fastify.log.error('CRITICAL: Client build directory missing!');
    fastify.log.error(`Expected path: ${clientBuildPath}`);
    // Try alternative paths for debugging
    const altPath1 = path.resolve(currentDir, '../client/dist');
    const altPath2 = path.resolve(process.cwd(), 'client/dist');
    fastify.log.info(`Alternative path 1 (../client/dist): ${altPath1} - exists: ${fs.existsSync(altPath1)}`);
    fastify.log.info(`Alternative path 2 (process.cwd/client/dist): ${altPath2} - exists: ${fs.existsSync(altPath2)}`);
  }
  fastify.log.info('-------------------------');

  // Register static file serving
  if (fs.existsSync(clientBuildPath)) {
    await fastify.register(fastifyStatic, {
      root: clientBuildPath,
      prefix: '/', // optional: default '/'
    });
  } else {
    fastify.log.warn('Static file serving disabled: client build directory not found');
  }

  // Catch-all route for SPA (MUST BE LAST, after all API routes)
  fastify.get('*', async (request, reply) => {
    // Skip API routes
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'API endpoint not found' });
    }
    
    // Skip socket.io routes
    if (request.url.startsWith('/socket.io/')) {
      return reply.code(404).send({ error: 'Socket.io endpoint not found' });
    }
    
    // Serve index.html for all other routes (SPA routing)
    const indexPath = path.join(clientBuildPath, 'index.html');
    
    if (fs.existsSync(indexPath)) {
      // Read and send index.html directly
      const htmlContent = fs.readFileSync(indexPath, 'utf8');
      reply.type('text/html');
      return reply.send(htmlContent);
    } else {
      fastify.log.error(`index.html not found at: ${indexPath}`);
      return reply.code(404).send('Client build not found (index.html missing). Check server logs.');
    }
  });

  const port = Number(process.env.PORT ?? 3000);

  // Ensure Fastify is ready before creating HTTP server
  await fastify.ready();
  
  // Use Fastify's underlying server
  const server = fastify.server;

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
    },
  });

  io.use((socket, next) => {
    // Extract token from handshake auth or query
    const token = (socket.handshake.auth as any)?.token || (socket.handshake.query as any)?.token;
    
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid or expired token'));
    }

    // Attach userId to handshake
    (socket.handshake as any).userId = decoded.userId;
    next();
  });

  io.on('connection', (socket) => {
    const userId = (socket.handshake as any).userId;
    
    if (!userId) {
      fastify.log.warn('Connection rejected: No valid user ID');
      socket.disconnect();
      return;
    }

    fastify.log.info(`Client connected: ${userId}`);

    // Get existing user (don't create new one)
    const currentPlayer = repo.getUser(userId);
    if (!currentPlayer) {
      fastify.log.warn(`User not found: ${userId}`);
      socket.disconnect();
      return;
    }

    store.setSession(socket.id, userId);

    // Join socket room for this server_code (realm isolation)
    const serverCode = currentPlayer.server_code;
    socket.join(serverCode);

    // Ensure genesis room exists for this realm
    repo.ensureGenesisRoom(serverCode);
    repo.ensureSystemUser(serverCode);

    const currentRoom = repo.getRoom(currentPlayer.current_q, currentPlayer.current_r, serverCode);
    
    if (!currentRoom) {
      // If player is in void, move to genesis room
      repo.updateUserPosition(userId, 0, 0);
      const genesisRoom = repo.getRoom(0, 0, serverCode)!;
      const visibleRooms = repo.getVisibleRooms(0, 0, serverCode);
      const roomItems = repo.getRoomItems(genesisRoom.id, serverCode);
      const inventory = repo.getUserInventory(userId, serverCode);
      const updatedPlayer = repo.getUser(userId)!;
      
      socket.emit('game:log', {
        text: `Welcome back, ${updatedPlayer.handle}.`,
        type: 'info' as const,
      });

      const initialState: StateUpdatePayload = {
        player: updatedPlayer,
        room: genesisRoom,
        visibleRooms,
        roomItems,
        inventory,
      };

      socket.emit('state:update', initialState);
    } else {
      const visibleRooms = repo.getVisibleRooms(currentPlayer.current_q, currentPlayer.current_r, serverCode);
      const roomItems = repo.getRoomItems(currentRoom.id, serverCode);
      const inventory = repo.getUserInventory(userId, serverCode);

      socket.emit('game:log', {
        text: `Welcome back, ${currentPlayer.handle}.`,
        type: 'info' as const,
      });

      const initialState: StateUpdatePayload = {
        player: currentPlayer,
        room: currentRoom,
        visibleRooms,
        roomItems,
        inventory,
      };

      socket.emit('state:update', initialState);
    }

    // Handle combat:retreat event from client
    socket.on('combat:retreat', () => {
      const userId = store.getSession(socket.id);
      if (!userId) return;
      const currentUser = repo.getUser(userId);
      if (!currentUser) return;
      const combatResult = combat.handleRetreat(socket, currentUser);
      if (combatResult.handled) {
        if (combatResult.shouldEmitState) {
          socket.emit('state:update', combatResult.shouldEmitState);
        }
      }
    });

    socket.on('cmd:input', (data: { raw: string }) => {
      const userId = store.getSession(socket.id);
      if (!userId) {
        socket.emit('game:log', {
          text: 'User not found for this session.',
          type: 'error' as const,
        });
        return;
      }

      const currentUser = repo.getUser(userId);
      if (!currentUser) {
        socket.emit('game:log', {
          text: 'User record missing.',
          type: 'error' as const,
        });
        return;
      }

      // Route to creation wizard if user is in creation state
      if (
        currentUser.state.startsWith('CREATING_') ||
        currentUser.state === 'GENERATING_ANIMATIONS'
      ) {
        const result = creation.handleInput(socket, currentUser, data.raw);
        if (result.shouldEmitState) {
          socket.emit('state:update', result.shouldEmitState);
        }
        return; // CRITICAL: Always return when in creation state, don't fall through to movement
      }

      // Route to general commands
      const command = data.raw.trim().toLowerCase();
      if (command === 'help') {
        general.handleHelp(socket, currentUser);
        return;
      }

      // Route to look command
      if (command.startsWith('look ')) {
        const target = data.raw.trim().substring(5).trim();
        general.handleLook(socket, currentUser, target);
        return;
      } else if (command === 'look' || command === 'l') {
        general.handleLook(socket, currentUser, '');
        return;
      }

      // Dev command: Regenerate animations for current room
      // Usage: /regenerate [mood] or regenerate [mood]
      if (command === 'regenerate' || command === '/regenerate') {
        void general.handleRegenerate(socket, currentUser);
        return;
      }
      if (command.startsWith('regenerate ') || command.startsWith('/regenerate ')) {
        const originalInput = data.raw.trim();
        const hasSlash = originalInput.toLowerCase().startsWith('/regenerate ');
        const mood = originalInput.substring(hasSlash ? 12 : 11).trim() || undefined;
        void general.handleRegenerate(socket, currentUser, mood);
        return;
      }

      // Route to movement handler FIRST (before interaction, since "go nw" etc. are movement commands)
      const moveResult = movement.handleMove(socket, currentUser, data.raw);
      if (moveResult.handled) {
        if (moveResult.shouldEmitState) {
          socket.emit('state:update', moveResult.shouldEmitState);
        }
        return;
      }

      // Route to combat handler (check for "fight [target]" pattern)
      if (command.startsWith('fight ')) {
        let targetName = data.raw.trim().substring(6).trim();
        
        // Check if target is a number (e.g., "fight 1")
        const targetNum = parseInt(targetName, 10);
        if (!isNaN(targetNum) && targetNum > 0) {
          const currentRoom = repo.getRoom(currentUser.current_q, currentUser.current_r, currentUser.server_code);
          if (currentRoom) {
            const roomItems = repo.getRoomItems(currentRoom.id, currentUser.server_code);
            const enemyItems = roomItems.filter((item) => item.enemy_hp && item.enemy_hp > 0);
            const targetEnemy = enemyItems[targetNum - 1];
            if (targetNum <= enemyItems.length && targetEnemy) {
              targetName = targetEnemy.name;
            } else {
              socket.emit('game:log', {
                text: `No enemy at position ${targetNum}.`,
                type: 'error' as const,
              });
              return;
            }
          }
        }
        
        const combatResult = combat.handleFight(socket, currentUser, targetName);
        if (combatResult.handled) {
          if (combatResult.shouldEmitState) {
            socket.emit('state:update', combatResult.shouldEmitState);
          }
          return;
        }
      }

      // Handle retreat command
      if (command === 'retreat' || command === '/retreat') {
        const combatResult = combat.handleRetreat(socket, currentUser);
        if (combatResult.handled) {
          if (combatResult.shouldEmitState) {
            socket.emit('state:update', combatResult.shouldEmitState);
          }
          return;
        }
      }

      // Handle "open [target]" or "open [number]" for containers
      if (command.startsWith('open ')) {
        let targetName = data.raw.trim().substring(5).trim();
        
        // Check if target is a number
        const targetNum = parseInt(targetName, 10);
        if (!isNaN(targetNum) && targetNum > 0) {
          const currentRoom = repo.getRoom(currentUser.current_q, currentUser.current_r, currentUser.server_code);
          if (currentRoom) {
            const roomItems = repo.getRoomItems(currentRoom.id, currentUser.server_code);
            const targetItem = roomItems[targetNum - 1];
            if (targetNum <= roomItems.length && targetItem) {
              targetName = targetItem.name;
            } else {
              socket.emit('game:log', {
                text: `No object at position ${targetNum}.`,
                type: 'error' as const,
              });
              return;
            }
          }
        }
        
        const interactionResult = interaction.handleInteraction(socket, currentUser, `open ${targetName}`);
        if (interactionResult.handled) {
          if (interactionResult.shouldEmitState) {
            socket.emit('state:update', interactionResult.shouldEmitState);
          }
          return;
        }
      }

      // Route to interaction handler (check for "verb object" pattern - 2+ words)
      // Only after movement has been checked, and only if verb is not banned
      const words = data.raw.trim().split(/\s+/);
      const bannedVerbs = ['go', 'help', 'fight', 'open'];
      if (words.length >= 2 && words[0] && !bannedVerbs.includes(words[0].toLowerCase())) {
        let interactionCommand = data.raw;
        
        // Check if target is a number (e.g., "take 2")
        if (words[1]) {
          const targetNum = parseInt(words[1], 10);
          if (!isNaN(targetNum) && targetNum > 0) {
          const currentRoom = repo.getRoom(currentUser.current_q, currentUser.current_r, currentUser.server_code);
          if (currentRoom) {
            const roomItems = repo.getRoomItems(currentRoom.id, currentUser.server_code);
            const targetItem = roomItems[targetNum - 1];
            if (targetNum <= roomItems.length && targetItem && words[0]) {
              interactionCommand = `${words[0]} ${targetItem.name}`;
            } else {
              socket.emit('game:log', {
                text: `No object at position ${targetNum}.`,
                type: 'error' as const,
              });
              return;
            }
          }
        }
        }
        
        const interactionResult = interaction.handleInteraction(socket, currentUser, interactionCommand);
        if (interactionResult.handled) {
          if (interactionResult.shouldEmitState) {
            socket.emit('state:update', interactionResult.shouldEmitState);
          }
          return;
        }
      }

      // Unknown command
      socket.emit('game:log', {
        text: `Unknown command: ${data.raw}`,
        type: 'error' as const,
      });
    });

    socket.on('disconnect', () => {
      store.deleteSession(socket.id);
      fastify.log.info('Client disconnected');
    });
  });

  server.listen(port, '0.0.0.0', () => {
    fastify.log.info(`Server listening on http://0.0.0.0:${port}`);
    fastify.log.info(`API endpoints available at http://localhost:${port}/api/signup and http://localhost:${port}/api/login`);
  });
}

void main();
