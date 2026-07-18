"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";
import { hydrateStore } from "@/data/store";

// Real cookie-session auth. The session lives in an HTTP-only cookie set by
// /api/auth/login. This context reflects the current user by asking
// /api/auth/me on mount, and hydrates the data store once authenticated.

interface SessionCtx {
  user: SessionUser | null;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
  logout: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (data.user) {
          setUserState(data.user);
          await hydrateStore();
        }
      } catch {
        /* offline / not logged in */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setUser = (u: SessionUser | null) => {
    setUserState(u);
    if (u) hydrateStore(true);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setUserState(null);
    router.push("/login");
  };

  return (
    <Ctx.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
