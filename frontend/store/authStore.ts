import { create } from 'zustand';
import api, { setAccessToken, getAccessToken } from '@/lib/api';

export type UserRole = 'customer' | 'agent_l1' | 'agent_l2' | 'agent_l3' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  initializeFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initializeFromStorage: async () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    if (!refreshToken) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const { data } = await api.post('/auth/refresh', { refreshToken });
      setAccessToken(data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      document.cookie = 'has_session=1; path=/; SameSite=Lax';
      const meRes = await api.get('/auth/me');
      set({ user: meRes.data.user, isAuthenticated: true, isLoading: false });
    } catch {
      setAccessToken(null);
      localStorage.removeItem('refreshToken');
      document.cookie = 'has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    document.cookie = 'has_session=1; path=/; SameSite=Lax';
    set({ user: data.user, isAuthenticated: true });
  },

  register: async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    document.cookie = 'has_session=1; path=/; SameSite=Lax';
    set({ user: data.user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      if (getAccessToken()) {
        await api.post('/auth/logout');
      }
    } catch {
      // Ignore logout errors
    }
    setAccessToken(null);
    localStorage.removeItem('refreshToken');
    document.cookie = 'has_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
