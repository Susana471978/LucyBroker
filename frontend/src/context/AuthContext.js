import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API =
  process.env.NODE_ENV === "production"
    ? "/api"
    : "http://127.0.0.1:8000/api";

const TOKEN_KEY = 'auth_token';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

export const AuthProvider = ({ children }) => {

  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(
    localStorage.getItem('language') || 'es'
  );
  const [trial, setTrial] = useState(null);

  // ---------- Logout ----------
  const logout = useCallback(() => {

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('language');

    delete axios.defaults.headers.common['Authorization'];

    setToken(null);
    setUser(null);
    setTrial(null);

    navigate('/auth', { replace: true });

  }, [navigate]);

  // ---------- Fetch Trial Status ----------
  const fetchTrialStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/trial/status`);
      const data = response.data?.data || response.data;
      setTrial(data);
    } catch (error) {
      console.error('Failed to fetch trial status:', error);
    }
  }, []);

  // ---------- Fetch User ----------
  const fetchUser = useCallback(async () => {

    try {
      const response = await axios.get(`${API}/auth/me`);
      const userData = response.data?.data || response.data;

      if (!userData) {
        throw new Error('User data is null');
      }

      setUser(userData);
      setLanguage(userData.language || 'es');

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
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }

  }, [token, fetchUser]);

  // ---------- Login ----------
  const login = async (email, password) => {

    const response = await axios.post(`${API}/auth/login`, {
      email,
      password,
    });

    const payload = response.data?.data || response.data;

    if (!payload?.token || !payload?.user) {
      throw new Error('Invalid login response');
    }

    const { token: newToken, user: userData } = payload;

    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem('language', userData.language || 'es');

    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    setToken(newToken);
    setUser(userData);
    setLanguage(userData.language || 'es');

    return userData;
  };

  // ---------- Register ----------
  const register = async (email, password, name) => {

    const response = await axios.post(`${API}/auth/register`, {
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
    localStorage.setItem('language', userData.language || 'es');

    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    setToken(newToken);
    setUser(userData);
    setLanguage(userData.language || 'es');

    return userData;
  };

  // ---------- Update Language ----------
  const updateLanguage = async (lang) => {

    setLanguage(lang);
    localStorage.setItem('language', lang);

    if (token) {
      try {
        await axios.put(`${API}/auth/language?language=${lang}`);
      } catch (error) {
        console.error('Failed to update language:', error);
      }
    }
  };

  // ---------- Trial Heartbeat ----------
  useEffect(() => {

    if (!token || !trial) return;
    if (trial.subscription_active || trial.trial_expired) return;

    const interval = setInterval(async () => {
      try {
        const response = await axios.post(`${API}/trial/heartbeat`);
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
    }, 60000);

    return () => clearInterval(interval);

  }, [token, trial]);

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
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
