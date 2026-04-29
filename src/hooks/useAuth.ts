import { useState, useEffect, useCallback, useMemo } from 'react';
import * as authService from '../services/auth';
import { Session } from '../services/auth';
import { UserRole } from '../types/db';
import { getErrorLogger, getUserFriendlyMessage } from '../utils/errorHandler';

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
  authError: { code?: string; message?: string } | null;
  clearAuthError: () => void;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<Session | null>(null);
  const [activeRole, setActiveRoleState] = useState<string>('user');
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<{ code?: string; message?: string } | null>(null);
  const errorLoggerRef = useMemo(() => getErrorLogger(), []);

  useEffect(() => {
    try {
      const session = authService.getSession();

      if (session) {
        setUser(session);
        setActiveRoleState(session.activeRole || session.roles[0] || 'user');
      }

      setLoading(false);
    } catch (err) {
      errorLoggerRef.log(err, { operation: 'useAuth:init' });
      setLoading(false);
    }
  }, [errorLoggerRef]);

  const login = useCallback(async (phone: string): Promise<{ requiresOtp: boolean; isSuperAdmin?: boolean }> => {
    try {
      setAuthError(null);
      const result = authService.login(phone);
      return result;
    } catch (err) {
      const loggedError = errorLoggerRef.log(err, { operation: 'login', phone });
      const code = (err as any)?.code || 'AUTH_FAILED';
      setAuthError({ code, message: getUserFriendlyMessage(code) || loggedError.message });
      throw err;
    }
  }, [errorLoggerRef]);

  const verifyOtp = useCallback(async (phone: string, otp: string): Promise<Session> => {
    try {
      setAuthError(null);
      authService.verifyOtp(phone, otp);

      const existingSession = await authService.completeLogin(phone);

      if (existingSession) {
        setUser(existingSession);
        setActiveRoleState(existingSession.activeRole || existingSession.roles[0] || 'user');
        return existingSession;
      }

      return { phone, requiresName: true } as unknown as Session;
    } catch (err) {
      const loggedError = errorLoggerRef.log(err, { operation: 'verifyOtp', phone });
      const code = (err as any)?.code || 'AUTH_FAILED';
      setAuthError({ code, message: getUserFriendlyMessage(code) || loggedError.message });
      throw err;
    }
  }, [errorLoggerRef]);

  const handleCreateUser = useCallback(async (phone: string, name: string): Promise<Session> => {
    try {
      setAuthError(null);
      const session = await authService.createUser(phone, name);
      setUser(session);
      setActiveRoleState(session.activeRole || session.roles[0] || 'user');
      return session;
    } catch (err) {
      const loggedError = errorLoggerRef.log(err, { operation: 'createUser', phone, name });
      const code = (err as any)?.code || 'AUTH_FAILED';
      setAuthError({ code, message: getUserFriendlyMessage(code) || loggedError.message });
      throw err;
    }
  }, [errorLoggerRef]);

  const handleLogout = useCallback(() => {
    try {
      authService.logout();
      setUser(null);
      setActiveRoleState('user');
      setAuthError(null);
    } catch (err) {
      errorLoggerRef.log(err, { operation: 'logout' });
    }
  }, [errorLoggerRef]);

  const setActiveRole = useCallback((role: string) => {
    if (!user) {
      const error = new Error('Cannot set role: no active user');
      errorLoggerRef.log(error, { operation: 'setActiveRole', reason: 'no_user' });
      throw error;
    }

    if (!user.roles.includes(role as UserRole)) {
      const error = new Error(`Role '${role}' not available for this user`);
      errorLoggerRef.log(error, { operation: 'setActiveRole', role, availableRoles: user.roles });
      throw error;
    }

    try {
      const updatedSession = authService.updateSessionRole(role);

      if (updatedSession) {
        setUser(updatedSession);
        setActiveRoleState(updatedSession.activeRole);
      }
    } catch (error) {
      errorLoggerRef.log(error, { operation: 'setActiveRole', role });
      throw error;
    }
  }, [user, errorLoggerRef]);

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
    authError,
    clearAuthError: () => setAuthError(null),
  };
}
