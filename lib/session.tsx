"use client";

// ===== lib/session.tsx — sesión de usuario simulada en memoria =====

import { createContext, useContext, useState, type ReactNode } from "react";

export interface SessionUser {
  name: string;
}

interface SessionContextValue {
  user: SessionUser | null;
  login: (u: SessionUser | null) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  const login = (u: SessionUser | null) => setUser(u);
  const signOut = () => setUser(null);

  return (
    <SessionContext.Provider value={{ user, login, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de un SessionProvider");
  return ctx;
}
