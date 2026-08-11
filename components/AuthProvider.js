'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { get, post, tokenStore } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!tokenStore.get()) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const data = await get('/auth/me');
        if (!cancelled) setUser(data.user);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Bounce to /login once we know there's no session.
  useEffect(() => {
    if (!ready) return;
    if (!user && pathname !== '/login') router.replace('/login');
    if (user && pathname === '/login') router.replace('/');
  }, [ready, user, pathname, router]);

  async function login(email, password) {
    const data = await post('/auth/login', { email, password });
    tokenStore.set(data.token);
    setUser(data.user);
    router.replace('/');
  }

  function logout() {
    tokenStore.clear();
    setUser(null);
    router.replace('/login');
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
