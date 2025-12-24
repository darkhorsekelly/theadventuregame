import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as repo from '../db/repo.js';
import type { User } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

/**
 * Validate server code against allowed codes
 */
function validateServerCode(serverCode: string): boolean {
  const validCodes = process.env.VALID_SERVER_CODES;
  if (!validCodes) {
    // If no codes are set, allow any code (open server)
    return true;
  }
  const codes = validCodes.split(',').map((c) => c.trim().toUpperCase());
  return codes.includes(serverCode.trim().toUpperCase());
}

/**
 * Sign up a new user
 */
export async function signup(handle: string, password: string, serverCode: string): Promise<AuthResult> {
  // Validate island code FIRST
  if (!validateServerCode(serverCode)) {
    return { success: false, error: 'Invalid island code' };
  }
  
  // Normalize server code early so it can be used throughout
  const normalizedServerCode = serverCode.trim().toUpperCase();
  
  // Validate input
  if (!handle || handle.trim().length === 0) {
    return { success: false, error: 'Username is required' };
  }
  if (handle.length < 3 || handle.length > 20) {
    return { success: false, error: 'Username must be between 3 and 20 characters' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  // Check if user already exists (check within the same server_code for realm isolation)
  const existingUser = repo.getUserByHandle(handle, normalizedServerCode);
  if (existingUser) {
    return { success: false, error: 'Username already taken. Please login.' };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const userId = uuidv4();
  const newUser: Omit<User, 'id'> = {
    handle: handle.trim(),
    server_code: normalizedServerCode,
    strength: 1,
    hp: 100,
    max_hp: 100,
    gold: 0,
    current_q: 0,
    current_r: 0,
    state: 'IDLE',
  };

  repo.createUser(userId, newUser, passwordHash);

  // Get the created user
  const user = repo.getUser(userId);
  if (!user) {
    return { success: false, error: 'Failed to create user' };
  }

  // Generate JWT
  const token = jwt.sign({ userId: user.id, handle: user.handle }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return { success: true, token, user };
}

/**
 * Log in an existing user
 */
export async function login(handle: string, password: string, serverCode: string): Promise<AuthResult> {
  // Validate input
  if (!handle || !password) {
    return { success: false, error: 'Username and password are required' };
  }

  // Validate island code FIRST
  if (!validateServerCode(serverCode)) {
    return { success: false, error: 'Invalid island code' };
  }

  // Find user by handle
  const user = repo.getUserByHandle(handle);
  if (!user) {
    return { success: false, error: 'Invalid username or password' };
  }

  // Check if user's server_code matches provided code
  const normalizedServerCode = serverCode.trim().toUpperCase();
  if (user.server_code !== normalizedServerCode) {
    return { success: false, error: 'Invalid island code for this user' };
  }

  // Get password hash from database
  const passwordHash = repo.getUserPasswordHash(user.id);
  if (!passwordHash) {
    return { success: false, error: 'User authentication failed' };
  }

  // Verify password
  const isValid = await bcrypt.compare(password, passwordHash);
  if (!isValid) {
    return { success: false, error: 'Invalid username or password' };
  }

  // Generate JWT
  const token = jwt.sign({ userId: user.id, handle: user.handle }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return { success: true, token, user };
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): { userId: string; handle: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; handle: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

