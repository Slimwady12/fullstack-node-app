import { useState, useEffect, useCallback, useMemo } from 'react';
import * as authService from '../services/auth';
import { Session } from '../services/auth';
import { UserRole } from '../types/db';

interface UseAuthResult {
  user: Session | null;
  activeRole: string;
  setActiveRole: (role: string) => void;
  login: (phone: string) => Promise<{ requiresOtp: boolean; isSuperAdmin?: boolean }>;
  verifyOtp: (phone: string, otp: string) => Promise<Session>;
  createUser: (phone: string, name: string) => Promise<Session>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<Session | null>(null);
  const [activeRole, setActiveRoleState] = useState<string>('user');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const session = authService.getSession();

    if (session) {
      setUser(session);
      setActiveRoleState(session.activeRole || session.roles[0] || 'user');
    }

    setLoading(false);
  }, []);

  const login = useCallback(async (phone: string): Promise<{ requiresOtp: boolean; isSuperAdmin?: boolean }> => {
    const result = authService.login(phone);
    return result;
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string): Promise<Session> => {
    authService.verifyOtp(phone, otp);

    const existingSession = await authService.completeLogin(phone);

    if (existingSession) {
      setUser(existingSession);
      setActiveRoleState(existingSession.activeRole || existingSession.roles[0] || 'user');
      return existingSession;
    }

    return { phone, requiresName: true } as unknown as Session;
  }, []);

  const handleCreateUser = useCallback(async (phone: string, name: string): Promise<Session> => {
    const session = await authService.createUser(phone, name);
    setUser(session);
    setActiveRoleState(session.activeRole || session.roles[0] || 'user');
    return session;
  }, []);

  const handleLogout = useCallback(() => {
    authService.logout();
    setUser(null);
    setActiveRoleState('user');
  }, []);

  const setActiveRole = useCallback((role: string) => {
    if (!user) {
      throw new Error('Cannot set role: no active user');
    }

    if (!user.roles.includes(role as UserRole)) {
      throw new Error(`Role '${role}' not available for this user`);
    }

    try {
      const updatedSession = authService.updateSessionRole(role);

      if (updatedSession) {
        setUser(updatedSession);
        setActiveRoleState(updatedSession.activeRole);
      }
    } catch (error) {
      console.error('Failed to update active role:', error);
      throw error;
    }
  }, [user]);

  const isAuthenticated = useMemo(() => {
    return user !== null && user.userId !== undefined && user.userId !== '';
  }, [user]);

  return {
    user,
    activeRole,
    setActiveRole,
    login,
    verifyOtp,
    createUser: handleCreateUser,
    logout: handleLogout,
    loading,
    isAuthenticated,
  };
}
