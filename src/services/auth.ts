import { read, transaction } from './db';
import { User, UserRole, ISO8601, Language } from '../types/db';

const SESSION_STORAGE_KEY = 'legal_platform_session';
const SIMULATED_OTP = '123456';
const SUPERADMIN_PHONE = '+998123456789';

// Debug flag for auth service
const DEBUG_AUTH = typeof window !== 'undefined' 
  ? (window as any).__DEBUG_AUTH__ || process.env.NODE_ENV === 'development'
  : true;

const authLog = (...args: any[]) => {
  if (DEBUG_AUTH) {
    console.log('[AUTH_SERVICE]', ...args);
  }
};

const authWarn = (...args: any[]) => {
  if (DEBUG_AUTH) {
    console.warn('[AUTH_SERVICE]', ...args);
  }
};

const authError = (...args: any[]) => {
  console.error('[AUTH_SERVICE]', ...args);
};

interface Session {
  userId: string;
  phone: string;
  name: string;
  roles: UserRole[];
  activeRole: string;
  joinedAt: ISO8601;
}

interface LoginResult {
  requiresOtp: boolean;
  isSuperAdmin?: boolean;
}

interface OtpResult {
  requiresName?: boolean;
  session?: Session;
  phone?: string;
}

function login(phone: string): LoginResult {
  authLog(`📱 [LOGIN] Attempting login for phone: "${phone}"`);
  
  if (phone === SUPERADMIN_PHONE) {
    authLog(`[LOGIN] 👑 Superadmin detected, skipping OTP`);
    return { requiresOtp: false, isSuperAdmin: true };
  }

  authLog(`[LOGIN] ✅ Regular user, OTP required`);
  return { requiresOtp: true };
}

function verifyOtp(phone: string, otp: string): OtpResult {
  authLog(`🔐 [VERIFY_OTP] Verifying OTP for phone: "${phone}", OTP: "${otp}"`);
  
  if (otp !== SIMULATED_OTP) {
    authError(`[VERIFY_OTP] ❌ Invalid OTP provided`);
    throw 'INVALID_OTP';
  }

  authLog(`[VERIFY_OTP] ✅ OTP verified successfully`);
  return { phone };
}

async function findUserByPhone(phone: string): Promise<User | null> {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  authLog(`🔍 [FIND_USER] Looking for user by phone: "${phone}" (request #${requestId})`);
  
  try {
    authLog(`[FIND_USER] Calling db.read()...`);
    const { data } = await read();
    
    authLog(`[FIND_USER] DB read successful, checking users array...`);
    authLog(`[FIND_USER] Users array exists: ${Array.isArray(data.users)}`);
    authLog(`[FIND_USER] Users count: ${data.users?.length ?? 0}`);
    
    if (!Array.isArray(data.users)) {
      authError(`[FIND_USER] ❌ data.users is not an array! Type: ${typeof data.users}`);
      return null;
    }
    
    const user = data.users.find(u => {
      const match = u.phone === phone;
      if (match) {
        authLog(`[FIND_USER] Found matching user:`, { id: u.id, name: u.name, phone: u.phone });
      }
      return match;
    });
    
    if (user) {
      authLog(`[FIND_USER] ✅ User found:`, { id: user.id, name: user.name, roles: user.roles });
    } else {
      authLog(`[FIND_USER] 🔍 No user found with phone: "${phone}"`);
    }
    
    return user || null;
  } catch (err) {
    authError(`[FIND_USER] ❌ Error finding user:`, err);
    return null;
  }
}

async function createUser(phone: string, name: string): Promise<Session> {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  
  authLog(`🆕 [CREATE_USER] Creating new user (request #${requestId})`);
  authLog(`[CREATE_USER] Phone: "${phone}", Name: "${name}"`);

  const newUser: User = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    phone,
    name,
    roles: ['user'],
    joinedAt: now,
    savedLawyers: [],
    profile: {
      email: null,
      avatar: null,
      language: 'uz' as Language,
    },
    notifications: {
      email: true,
      push: true,
      quietHours: {
        start: '22:00',
        end: '07:00',
      },
    },
    privacy: {
      showPhone: false,
      showEmail: false,
    },
  };

  authLog(`[CREATE_USER] Created user object:`, { 
    id: newUser.id, 
    phone: newUser.phone, 
    name: newUser.name,
    roles: newUser.roles 
  });

  try {
    authLog(`[CREATE_USER] Starting transaction to add user to DB...`);
    
    await transaction<void>((db) => {
      authLog(`[CREATE_USER] Transaction callback executing...`);
      
      if (!db.users) {
        authError(`[CREATE_USER] ❌ Database users collection is missing`);
        throw new Error('Database users collection is missing');
      }
      
      if (!Array.isArray(db.users)) {
        authError(`[CREATE_USER] ❌ Database users collection is not an array. Type: ${typeof db.users}`);
        throw new Error('Database users collection is not an array');
      }
      
      authLog(`[CREATE_USER] Current users count: ${db.users.length}`);
      db.users.push(newUser);
      authLog(`[CREATE_USER] User added, new users count: ${db.users.length}`);
      
      return db;
    });

    authLog(`[CREATE_USER] ✅ Transaction completed successfully`);
  } catch (err) {
    authError(`[CREATE_USER] ❌ Failed to create user in DB:`, err);
    throw err;
  }

  const session: Session = {
    userId: newUser.id,
    phone: newUser.phone,
    name: newUser.name,
    roles: newUser.roles,
    activeRole: newUser.roles[0],
    joinedAt: newUser.joinedAt,
  };

  authLog(`[CREATE_USER] Created session:`, { 
    userId: session.userId, 
    name: session.name, 
    roles: session.roles 
  });

  setSession(session);
  authLog(`[CREATE_USER] ✅ User created and session saved`);

  return session;
}

async function completeLogin(phone: string): Promise<Session | null> {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  authLog(`🔑 [COMPLETE_LOGIN] Completing login for phone: "${phone}" (request #${requestId})`);
  
  const existingUser = await findUserByPhone(phone);

  if (existingUser) {
    authLog(`[COMPLETE_LOGIN] ✅ Existing user found, creating session`);
    
    const session: Session = {
      userId: existingUser.id,
      phone: existingUser.phone,
      name: existingUser.name,
      roles: existingUser.roles,
      activeRole: existingUser.roles[0],
      joinedAt: existingUser.joinedAt,
    };

    authLog(`[COMPLETE_LOGIN] Session created:`, { 
      userId: session.userId, 
      name: session.name, 
      roles: session.roles,
      activeRole: session.activeRole 
    });

    setSession(session);
    authLog(`[COMPLETE_LOGIN] ✅ Login completed successfully`);
    return session;
  }

  authLog(`[COMPLETE_LOGIN] 🔍 No existing user found, returning null (requires name input)`);
  return null;
}

function getSession(): Session | null {
  try {
    authLog(`📋 [GET_SESSION] Retrieving session from localStorage`);
    
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);

    if (!stored) {
      authLog(`[GET_SESSION] No session found in localStorage`);
      return null;
    }

    const session = JSON.parse(stored) as Session;
    authLog(`[GET_SESSION] Parsed session:`, { 
      userId: session?.userId, 
      name: session?.name, 
      roles: session?.roles 
    });

    if (!session.userId || !session.phone || !session.roles || !session.activeRole) {
      authWarn(`[GET_SESSION] Invalid session data, clearing storage`);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    authLog(`[GET_SESSION] ✅ Valid session retrieved`);
    return session;
  } catch (err) {
    authError(`[GET_SESSION] Error retrieving session:`, err);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function setSession(session: Session): void {
  try {
    authLog(`💾 [SET_SESSION] Saving session to localStorage`);
    authLog(`[SET_SESSION] Session data:`, { 
      userId: session.userId, 
      name: session.name, 
      roles: session.roles 
    });
    
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    authLog(`[SET_SESSION] ✅ Session saved successfully`);
  } catch (error) {
    authError(`[SET_SESSION] ❌ Failed to save session:`, error);
  }
}

function logout(): void {
  authLog(`🚪 [LOGOUT] Logging out user`);
  
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    authLog(`[LOGOUT] ✅ Session cleared`);
  } catch (error) {
    authError(`[LOGOUT] ❌ Failed to clear session:`, error);
  }
}

function updateSessionRole(activeRole: string): Session | null {
  authLog(`🔄 [UPDATE_ROLE] Updating active role to: "${activeRole}"`);
  
  const session = getSession();

  if (!session) {
    authError(`[UPDATE_ROLE] ❌ No session found`);
    return null;
  }

  if (!session.roles.includes(activeRole as UserRole)) {
    authError(`[UPDATE_ROLE] ❌ Role '${activeRole}' not found in user roles:`, session.roles);
    throw new Error(`Role '${activeRole}' not found in user roles`);
  }

  session.activeRole = activeRole;
  setSession(session);
  authLog(`[UPDATE_ROLE] ✅ Role updated successfully`);

  return session;
}

export {
  login,
  verifyOtp,
  createUser,
  completeLogin,
  getSession,
  setSession,
  logout,
  updateSessionRole,
  SIMULATED_OTP,
  SUPERADMIN_PHONE,
  SESSION_STORAGE_KEY,
};

export type { Session };
