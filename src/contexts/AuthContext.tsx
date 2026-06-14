import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, cacheUserProfile, clearStoredToken, getStoredToken, setStoredToken } from "@/services/api";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  skills: string[];
  githubUsername?: string | null;
  githubProfile?: {
    username: string;
    avatar: string;
    name: string;
    bio: string;
    repos: number;
    followers: number;
    languages: Record<string, number>;
    topRepos: { name: string; description: string; stars: number; language: string; url: string }[];
  } | null;
  githubLastSyncedAt?: string | null;
  targetRole?: string | null;
  resumeText?: string | null;
  resumeFilename?: string | null;
  resumeUploadedAt?: string | null;
  education?: string | null;
  summary?: string | null;
  experienceLevel?: "Beginner" | "Intermediate" | "Advanced" | null;
  lastUpdated?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  setUserFromApi: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [authLoading, setAuthLoading] = useState(true);

  const setUserFromApi = useCallback((nextUser: UserProfile) => {
    setUser(nextUser);
    cacheUserProfile(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      return;
    }
    const profile = await apiFetch<UserProfile>("/profile", {}, currentToken);
    setUser(profile);
    cacheUserProfile(profile);
    setToken(currentToken);
  }, []);

  useEffect(() => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setAuthLoading(false);
      return;
    }

    refreshUser()
      .catch(() => {
        clearStoredToken();
        setToken(null);
        setUser(null);
        cacheUserProfile(null);
      })
      .finally(() => setAuthLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<{ token: string; user: UserProfile }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(result.token);
    setToken(result.token);
    setUser(result.user);
    cacheUserProfile(result.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await apiFetch<{ token: string; user: UserProfile }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setStoredToken(result.token);
    setToken(result.token);
    setUser(result.user);
    cacheUserProfile(result.user);
  }, []);

  const logout = useCallback(async () => {
    const currentToken = getStoredToken();
    if (currentToken) {
      try {
        await apiFetch("/auth/logout", { method: "POST" }, currentToken);
      } catch {
        // Best-effort logout.
      }
    }
    clearStoredToken();
    setToken(null);
    setUser(null);
    cacheUserProfile(null);
  }, []);

  const updateUser = useCallback(async (updates: Partial<UserProfile>) => {
    const updated = await apiFetch<UserProfile>("/profile", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    setUser(updated);
    cacheUserProfile(updated);
    try {
      const refreshed = await apiFetch<UserProfile>("/profile");
      setUser(refreshed);
      cacheUserProfile(refreshed);
      return refreshed;
    } catch {
      return updated;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        authLoading,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
        setUserFromApi,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
