"use client";

/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Session abstraction — Supabase Auth.
 *
 * The provider subscribes to `onAuthStateChange`, resolves the app profile
 * from `public.users`, and exposes email/password + magic-link sign-in,
 * open sign-up, password reset, and self-service profile updates.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { resolveDataMode, type DataMode } from "./supabase/env";
import { getSupabaseBrowserClient } from "./supabase/browser";
import type { Role, User } from "./types";

type AuthResult = { error?: string; needsConfirmation?: boolean };

type SessionValue = {
  currentUser: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  /** Hydration finished — `currentUser` reflects remote state. */
  isReady: boolean;
  /** Active auth backend — always "supabase". */
  mode: DataMode;
  /** Email + password sign-in. */
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  /** Magic-link (email OTP) sign-in. */
  signInWithMagicLink: (email: string, next?: string) => Promise<AuthResult>;
  /** Password reset email. */
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  /** Self-service sign-up (open registration). */
  signUp: (
    name: string,
    email: string,
    password: string,
    role?: "writer" | "editor"
  ) => Promise<AuthResult>;
  /** Update the signed-in user's own display name + avatar. */
  updateProfile: (patch: {
    name?: string;
    avatarUrl?: string;
  }) => Promise<AuthResult>;
  signOut: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

async function readAuthResponse(res: Response): Promise<AuthResult> {
  let json: { error?: string } = {};
  try {
    json = await res.json();
  } catch {
    // Leave json empty; the status check below will produce the fallback.
  }

  if (!res.ok || json.error) {
    return {
      error:
        json.error ??
        "That email request did not finish. Check your connection and try again.",
    };
  }

  return {};
}

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  active: boolean;
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // The data mode is env-driven and stable for the life of the page.
  const mode = useMemo<DataMode>(() => resolveDataMode().mode, []);

  const [supaUser, setSupaUser] = useState<User | null>(null);
  const [supaReady, setSupaReady] = useState(false);

  // Subscribe to real Supabase auth state.
  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb) {
      setSupaReady(true);
      return;
    }
    let active = true;

    async function resolveProfile(userId: string) {
      const { data } = await sb!
        .from("users")
        .select("id, name, email, role, avatar_url, active")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      const row = data as ProfileRow | null;
      setSupaUser(
        row
          ? {
              id: row.id,
              name: row.name,
              email: row.email,
              role: row.role,
              avatarUrl: row.avatar_url ?? undefined,
              active: row.active,
            }
          : null
      );
      setSupaReady(true);
    }

    sb.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) {
        resolveProfile(data.session.user.id);
      } else {
        setSupaUser(null);
        setSupaReady(true);
      }
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        resolveProfile(session.user.id);
      } else {
        setSupaUser(null);
        setSupaReady(true);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return { error: "Supabase is not configured." };
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    []
  );

  const signInWithMagicLink = useCallback(
    async (email: string, next?: string): Promise<AuthResult> => {
      // Handled server-side so Supabase's email rate limits never apply.
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
      return readAuthResponse(res);
    },
    []
  );

  const sendPasswordReset = useCallback(
    async (email: string): Promise<AuthResult> => {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return readAuthResponse(res);
    },
    []
  );

  const signUp = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      role: "writer" | "editor" = "writer"
    ): Promise<AuthResult> => {
      // Handled server-side so Supabase's email rate limits never apply.
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const result = await readAuthResponse(res);
      if (result.error) return result;
      return { needsConfirmation: true };
    },
    []
  );

  const updateProfile = useCallback(
    async (patch: {
      name?: string;
      avatarUrl?: string;
    }): Promise<AuthResult> => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return { error: "Supabase is not configured." };
      const { error } = await sb.rpc("update_my_profile", {
        p_name: patch.name ?? "",
        p_avatar_url: patch.avatarUrl ?? "",
      });
      if (error) return { error: error.message };
      setSupaUser((prev) =>
        prev
          ? {
              ...prev,
              name: patch.name?.trim() ? patch.name.trim() : prev.name,
              avatarUrl: patch.avatarUrl?.trim()
                ? patch.avatarUrl.trim()
                : undefined,
            }
          : prev
      );
      return {};
    },
    []
  );

  const signOut = useCallback(() => {
    const sb = getSupabaseBrowserClient();
    sb?.auth.signOut();
    setSupaUser(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      currentUser: supaUser,
      role: supaUser?.role ?? null,
      isAuthenticated: !!supaUser,
      isReady: supaReady,
      mode,
      signInWithPassword,
      signInWithMagicLink,
      sendPasswordReset,
      signUp,
      updateProfile,
      signOut,
    }),
    [
      mode,
      supaUser,
      supaReady,
      signInWithPassword,
      signInWithMagicLink,
      sendPasswordReset,
      signUp,
      updateProfile,
      signOut,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
