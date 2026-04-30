import { read, transaction } from './db';
import { User, UserRole, ISO8601, Language } from '../types/db';

const SESSION_STORAGE_KEY = 'legal_platform_session';
const SIMULATED_OTP = '123456';
const SUPERADMIN_PHONE = '+998123456789';

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
  if (phone === SUPERADMIN_PHONE) {
    return { requiresOtp: false, isSuperAdmin: true };
  }

  return { requiresOtp: true };
}

function verifyOtp(phone: string, otp: string): OtpResult {
  if (otp !== SIMULATED_OTP) {
    throw 'INVALID_OTP';
  }

  return { phone };
}

async function findUserByPhone(phone: string): Promise<User | null> {
  try {
    const { data } = await read();
    const user = data.users.find(u => u.phone === phone);
    return user || null;
  } catch {
    return null;
  }
}

async function createUser(phone: string, name: string): Promise<Session> {
  const now = new Date().toISOString();

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

  await transaction<void>((db) => {
    if (!db.users) {
      throw new Error('Database users collection is missing');
    }
    
    if (!Array.isArray(db.users)) {
      throw new Error('Database users collection is not an array');
    }
    
    db.users.push(newUser);
    return db;
  });

  const session: Session = {
    userId: newUser.id,
    phone: newUser.phone,
    name: newUser.name,
    roles: newUser.roles,
    activeRole: newUser.roles[0] || 'user',
    joinedAt: newUser.joinedAt,
  };

  setSession(session);

  return session;
}

async function completeLogin(phone: string): Promise<Session | null> {
  const existingUser = await findUserByPhone(phone);

  if (existingUser) {
    const session: Session = {
      userId: existingUser.id,
      phone: existingUser.phone,
      name: existingUser.name,
      roles: existingUser.roles,
      activeRole: existingUser.roles[0] || 'user',
      joinedAt: existingUser.joinedAt,
    };

    setSession(session);
    return session;
  }

  return null;
}

function getSession(): Session | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const session = JSON.parse(stored) as Session;

    if (!session.userId || !session.phone || !session.roles || !session.activeRole) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return session;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function setSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

function logout(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

function updateSessionRole(activeRole: string): Session | null {
  const session = getSession();

  if (!session) {
    return null;
  }

  if (!session.roles.includes(activeRole as UserRole)) {
    throw new Error(`Role '${activeRole}' not found in user roles`);
  }

  session.activeRole = activeRole;
  setSession(session);

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
