import { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';
import { refreshSession } from '../api/shifts';

const AuthContext = createContext(null);

const REFRESH_EVERY_MS = 10 * 60 * 1000; // 10 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('occ_token');
    const savedUser = localStorage.getItem('occ_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Keep the login fresh while someone is logged in
  useEffect(() => {
    if (!user) return;

    async function renew() {
      try {
        const data = await refreshSession();
        localStorage.setItem('occ_token', data.token);
        localStorage.setItem('occ_user', JSON.stringify(data.user));
        setUser((prev) =>
          prev && prev.id === data.user.id && prev.role === data.user.role && prev.fullName === data.user.fullName
            ? prev
            : data.user
        );
      } catch {
        // A 401 is handled by the API client (it logs out). Network blips are ignored.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') renew();
    }

    renew();
    const timer = setInterval(renew, REFRESH_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id]);

  async function login(username, password) {
    const response = await apiClient.post('/auth/login', { username, password });
    const { token, user } = response.data;
    localStorage.setItem('occ_token', token);
    localStorage.setItem('occ_user', JSON.stringify(user));
    setUser(user);
    return user;
  }

  function logout() {
    localStorage.removeItem('occ_token');
    localStorage.removeItem('occ_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}