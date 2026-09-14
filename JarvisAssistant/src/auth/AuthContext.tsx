import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { UserProfile, AuthContextType } from './types';
import {
  signInWithGoogle as authSignInWithGoogle,
  signInAnonymously as authSignInAnonymously,
  signOut as authSignOut,
  subscribeToAuthState,
} from './authService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(currentUser => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const signedInUser = await authSignInWithGoogle();
      setUser(signedInUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const signInAnonymously = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const anonUser = await authSignInAnonymously();
      setUser(anonUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await authSignOut();
      setUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      error,
      signInWithGoogle,
      signInAnonymously,
      signOut,
      clearError,
    }),
    [user, isLoading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
