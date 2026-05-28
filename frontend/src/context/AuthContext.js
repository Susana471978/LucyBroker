import { createContext, useContext, useState } from 'react';

const mockUser = {
  id: "demo-001",
  name: "Carmen Rodríguez",
  email: "carmen@objjetiva.es",
  language: "es",
  plan: "profesional"
};

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));

  const login = async (email, password) => {
    localStorage.setItem('auth_token', 'demo-token-broker');
    setToken('demo-token-broker');
    return mockUser;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{
      user: token ? mockUser : null,
      token,
      loading: false,
      language: 'es',
      login,
      logout,
      updateLanguage: () => {},
      isAuthenticated: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
