import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  provider: 'google' | 'guest';
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signInAsGuest: (name: string) => Promise<void>;
  signInWithGoogle: (userInfo: { id: string; name: string; email: string; photo?: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }

  async function signInAsGuest(name: string) {
    const resp = await fetch(`${BASE_URL}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) throw new Error('Failed to create guest session');
    const data = await resp.json();
    await AsyncStorage.setItem('auth_token', data.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  async function signInWithGoogle(userInfo: { id: string; name: string; email: string; photo?: string }) {
    const resp = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInfo }),
    });
    if (!resp.ok) throw new Error('Google auth failed');
    const data = await resp.json();
    await AsyncStorage.setItem('auth_token', data.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  async function signOut() {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({
    user,
    token,
    isLoading,
    signInAsGuest,
    signInWithGoogle,
    signOut,
  }), [user, token, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
