import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchCurrentUser, logoutUser as apiLogout } from '../services/api';

const AuthContext = createContext(null);

export const TOKEN_STORAGE_KEY = 'eventsync_token';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlToken = new URLSearchParams(window.location.search).get('token');
      if (urlToken) {
        localStorage.setItem(TOKEN_STORAGE_KEY, urlToken);
        return urlToken;
      }
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Restore authenticated session from MongoDB on application mount/refresh
  useEffect(() => {
    const restoreSession = async () => {
      let storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken && typeof window !== 'undefined') {
        const urlToken = new URLSearchParams(window.location.search).get('token');
        if (urlToken) {
          localStorage.setItem(TOKEN_STORAGE_KEY, urlToken);
          storedToken = urlToken;
        }
      }

      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetchCurrentUser();

        if (response.success && response.user) {
          setUser(response.user);
          setToken(storedToken);
        } else {
          // Token is invalid, expired, or user deleted
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = (newToken, newUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (e) {
      // Ignore logout request errors; local clearance takes precedence
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
    }
  };

  const value = {
    user,
    token,
    role: user ? user.role : null,
    isAuthenticated: !!user,
    isStudent: user?.role === 'STUDENT',
    isEventAdmin: user?.role === 'EVENTADMIN',
    isLoading,
    login,
    updateUser: (updatedUser) => setUser(updatedUser),
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
