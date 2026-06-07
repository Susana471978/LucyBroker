import { createContext, useContext, useState } from 'react';
import api from '../services/apiClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  });

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const data = res.data?.data || res.data;
    const t = data.token;
    const u = data.user;
    localStorage.setItem('auth_token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    return u;
  };

  const register = async (email, password, name) => {
    const res = await api.post('/auth/register', { email, password, name });
    const data = res.data?.data || res.data;
    const t = data.token;
    const u = data.user;
    localStorage.setItem('auth_token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading: false,
      language: user?.language || 'es',
      login,
      register,
      logout,
      updateLanguage: () => {},
      isAuthenticated: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
