import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/apiClient';

const TOKEN_KEY = 'auth_token';
const HEARTBEAT_LOCK_KEY = 'trial_heartbeat_leader';
const HEARTBEAT_LOCK_TTL = 50000; // 50s — shorter than the 60s interval

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(
    localStorage.getItem('language') || 'es'
  );

  // Trial state
  const [trial, setTrial] = useState(null);

  // Unique tab ID for leader election
  const tabId = useRef(`tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // ---------- Logout ----------
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(HEARTBEAT_LOCK_KEY);
    setToken(null);
    setUser(null);
    setTrial(null);
  }, []);

  // ---------- Fetch Trial Status ----------
  const fetchTrialStatus = useCallback(async () => {
    try {
      const response = await api.get('/trial/status');
      const data = response.data?.data || response.data;
      setTrial(data);
    } catch (error) {
      console.error('Failed to fetch trial status:', error);
    }
  }, []);

  // ---------- Fetch User ----------
  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data?.data || response.data;
      if (!userData) {
        throw new Error('User data is null');
      }
      setUser(userData);
      setLanguage(userData.language || 'es');
      // Fetch trial status after user is loaded
      await fetchTrialStatus();
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout, fetchTrialStatus]);

  // ---------- Init Auth ----------
  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  // ---------- Login ----------
  const login = async (email, password) => {
    const response = await api.post('/auth/login', {
      email,
      password,
    });
    const payload = response.data?.data || response.data;
    if (!payload?.token || !payload?.user) {
      throw new Error('Invalid login response');
    }
    const { token: newToken, user: userData } = payload;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(userData);
    setLanguage(userData.language || 'es');
    return userData;
  };

  // ---------- Register ----------
  const register = async (email, password, name) => {
    const response = await api.post('/auth/register', {
      email,
      password,
      name,
    });
    const payload = response.data?.data || response.data;
    if (!payload?.token || !payload?.user) {
      throw new Error('Invalid register response');
    }
    const { token: newToken, user: userData } = payload;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  // ---------- Language ----------
  const updateLanguage = async (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    if (token) {
      try {
        await api.put('/auth/language', { language: lang });
      } catch (error) {
        console.error('Failed to update language:', error);
      }
    }
  };

  // ---------- Leader Election for Heartbeat ----------
  const _tryAcquireLock = useCallback(() => {
    try {
      const raw = localStorage.getItem(HEARTBEAT_LOCK_KEY);
      if (raw) {
        const lock = JSON.parse(raw);
        // If the lock is still fresh and belongs to another tab, we're not leader
        if (lock.tab !== tabId.current && Date.now() - lock.ts < HEARTBEAT_LOCK_TTL) {
          return false;
        }
      }
      // Acquire or renew the lock
      localStorage.setItem(
        HEARTBEAT_LOCK_KEY,
        JSON.stringify({ tab: tabId.current, ts: Date.now() })
      );
      return true;
    } catch {
      // localStorage error — assume leader to avoid silent trial freeze
      return true;
    }
  }, []);

  // ---------- Trial Heartbeat (single-tab only) ----------
  useEffect(() => {
    if (!token || !trial) return;
    // Don't heartbeat if subscribed or trial expired
    if (trial.subscription_active || trial.trial_expired) return;

    const interval = setInterval(async () => {
      // Only the leader tab sends heartbeats
      if (!_tryAcquireLock()) return;

      try {
        const response = await api.post('/trial/heartbeat');
        const data = response.data?.data || response.data;
        setTrial((prev) => ({
          ...prev,
          trial_remaining: data.trial_remaining,
          trial_expired: data.trial_expired,
          subscription_active: data.subscription_active,
        }));
      } catch (error) {
        console.error('Trial heartbeat error:', error);
      }
    }, 60000); // every 60 seconds

    // Release lock on unmount (tab close)
    const cleanup = () => {
      try {
        const raw = localStorage.getItem(HEARTBEAT_LOCK_KEY);
        if (raw) {
          const lock = JSON.parse(raw);
          if (lock.tab === tabId.current) {
            localStorage.removeItem(HEARTBEAT_LOCK_KEY);
          }
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('beforeunload', cleanup);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [token, trial, _tryAcquireLock]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        language,
        trial,
        login,
        register,
        logout,
        updateLanguage,
        fetchTrialStatus,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;