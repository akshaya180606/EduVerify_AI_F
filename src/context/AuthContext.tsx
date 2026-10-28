import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isLoading: boolean;
  unreadCount: number;
  switchRole: (role: UserRole, institutionId?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchCurrentUser = async () => {
    try {
      setIsLoading(true);
      const res = await api.getMe();
      setUser(res.user);
      const notifs = await api.getNotifications();
      setUnreadCount(notifs.unreadCount);
    } catch (err) {
      console.error('Failed to load authenticated session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const switchRole = async (targetRole: UserRole, institutionId?: string) => {
    try {
      setIsLoading(true);
      const res = await api.switchDemoRole(targetRole, institutionId);
      setUser(res.user);
      const notifs = await api.getNotifications();
      setUnreadCount(notifs.unreadCount);
    } catch (err) {
      console.error('Failed to switch demo role:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const refreshNotifications = async () => {
    try {
      const notifs = await api.getNotifications();
      setUnreadCount(notifs.unreadCount);
    } catch (err) {
      console.error('Failed to refresh notifications:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'COLLEGE_MANAGEMENT',
        isLoading,
        unreadCount,
        switchRole,
        refreshUser,
        refreshNotifications,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
