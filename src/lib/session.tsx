"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";

// A lightweight client-side session. This is a front-end stub — when the DB
// is wired, this gets replaced by real cookie/JWT auth (e.g. NextAuth). The
// call sites (useSession / login / logout) stay the same.

interface SessionCtx {
  user: SessionUser | null;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
  logout: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);
const KEY = "keidence.session";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined" ? window.name && window.name.startsWith(KEY) ? window.name.slice(KEY.length) : "" : "";
      if (raw) setUserState(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  const setUser = (u: SessionUser | null) => {
    setUserState(u);
    // Persist in window.name (survives client-side navigation without using
    // localStorage, which is intentionally avoided). Cleared on tab close.
    if (typeof window !== "undefined") {
      window.name = u ? KEY + JSON.stringify(u) : "";
    }
  };

  const logout = () => {
    setUser(null);
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
