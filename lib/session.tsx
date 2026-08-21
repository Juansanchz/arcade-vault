"use client";

// ===== lib/session.tsx — sesión respaldada por Supabase Auth =====

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export interface SessionUser {
  name: string; // username de profiles, o "INVITADO" en modo invitado
}

interface SessionContextValue {
  user: SessionUser | null;
  isGuest: boolean;
  status: "loading" | "ready";
  playAsGuest: () => void;
  signOut: () => Promise<void>;
}

const GUEST_KEY = "av:guest";

const SessionContext = createContext<SessionContextValue | null>(null);

function readGuestFlag(): boolean {
  try {
    return localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

function clearGuestFlag(): void {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    // localStorage no disponible (modo privado estricto): sin marca que borrar.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const applySession = async (userId: string | null) => {
      if (userId) {
        clearGuestFlag();
        const { data } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", userId)
          .single();
        if (!active) return;
        setIsGuest(false);
        setUser({ name: data?.username ?? "JUGADOR" });
      } else if (readGuestFlag()) {
        setIsGuest(true);
        setUser({ name: "INVITADO" });
      } else {
        setIsGuest(false);
        setUser(null);
      }
      setStatus("ready");
    };

    supabase.auth.getUser().then(({ data }) => {
      if (active) applySession(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const playAsGuest = () => {
    try {
      localStorage.setItem(GUEST_KEY, "1");
    } catch {
      // localStorage no disponible (modo privado estricto): se degrada sin marca.
    }
    setIsGuest(true);
    setUser({ name: "INVITADO" });
  };

  const signOut = async () => {
    clearGuestFlag();
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsGuest(false);
    setUser(null);
  };

  return (
    <SessionContext.Provider
      value={{ user, isGuest, status, playAsGuest, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession debe usarse dentro de un SessionProvider");
  return ctx;
}
