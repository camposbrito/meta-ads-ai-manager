import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import type { ReactNode } from 'react';
import type { User, Organization } from '../types';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, organizationName: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const response = await authAPI.me();
          setUser(response.data.user);
          if (response.data.user.organization) {
            setOrganization({
              id: response.data.user.organization.id,
              name: response.data.user.organization.name,
              slug: '',
              plan: response.data.user.organization.plan,
              max_ad_accounts: response.data.user.organization.max_ad_accounts || 0,
              max_daily_syncs: response.data.user.organization.max_daily_syncs || 0,
              subscription_status: response.data.user.organization.subscription_status || null,
              subscription_ends_at: response.data.user.organization.subscription_ends_at || null,
            });
          }
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authAPI.login({ email, password });
    const { user, tokens } = response.data;

    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    setUser(user);
    if (user.organization) {
      setOrganization({
        id: user.organization.id,
        name: user.organization.name,
        slug: '',
        plan: user.organization.plan,
        max_ad_accounts: 0,
        max_daily_syncs: 0,
      });
    }
  };

  const register = async (email: string, password: string, name: string, organizationName: string) => {
    const response = await authAPI.register({ email, password, name, organizationName });
    const { user, tokens } = response.data;

    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    setUser(user);
    if (user.organization) {
      setOrganization({
        id: user.organization.id,
        name: user.organization.name,
        slug: '',
        plan: user.organization.plan,
        max_ad_accounts: 0,
        max_daily_syncs: 0,
      });
    }
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      authAPI.logout(refreshToken).catch(() => {});
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setOrganization(null);
  };

  const updateUser = (updatedUser: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updatedUser });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
