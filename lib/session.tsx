"use client";

/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Session abstraction — dual-mode.
 *
 *   - mock mode (default, offline)  → in-memory demo users, picked from the
 *     login screen; persisted in localStorage so a refresh keeps the user.
 *   - supabase mode                 → real Supabase Auth. The provider
 *     subscribes to `onAuthStateChange`, resolves the app profile from
 *     `public.users`, and exposes email/password + magic-link sign-in.
 *
 * The active mode is decided by `resolveDataMode()` (env-driven). UI code
 * calls these methods regardless of mode, so pages stay mode-agnostic.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useStore } from "./store";
import { resolveDataMode, type DataMode } from "./supabase/env";
import { getSupabaseBrowserClient } from "./supabase/browser";
import type { Role, User } from "./types";

type SessionState = {
  userId: string | null;
  signedIn: boolean;
};

type AuthResult = { error?: string; needsConfirmation?: boolean };

type SessionValue = {
  currentUser: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  /** Hydration finished — `currentUser` reflects persisted/remote state. */
  isReady: boolean;
  /** Active auth backend. */
  mode: DataMode;
  /** Demo users for the mock-mode login picker. Empty in supabase mode. */
  allUsers: User[];
  /** Mock-mode only: instant sign-in as a seeded demo user. */
  signInAsDemoUser: (userId: string) => void;
  /** Supabase-mode email + password sign-in. */
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  /** Supabase-mode magic-link (email OTP) sign-in. */
  signInWithMagicLink: (email: string, next?: string) => Promise<AuthResult>;
  /** Supabase-mode password reset email. */
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  /** Supabase-mode self-service sign-up (open registration). */
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  /** Supabase-mode: update the signed-in user's own display name + avatar. */
  updateProfile: (patch: {
    name?: string;
    avatarUrl?: string;
  }) => Promise<AuthResult>;
  signOut: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

const STORAGE_KEY = "advantage-portal:session";
/** Default demo-user when no persisted session exists. */
const DEFAULT_DEMO_USER_ID = "u6"; // leader

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

function readPersisted(): SessionState {
  if (typeof window === "undefined") return { userId: null, signedIn: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { userId: null, signedIn: false };
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return {
      userId: typeof parsed.userId === "string" ? parsed.userId : null,
      signedIn: parsed.signedIn === true,
    };
  } catch {
    return { userId: null, signedIn: false };
  }
}

function writePersisted(state: SessionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const { users } = useStore();

  // The data mode is env-driven and stable for the life of the page.
  const mode = useMemo<DataMode>(() => resolveDataMode().mode, []);

  // ── mock-mode state ──────────────────────────────────────────────────────
  const [mockState, setMockState] = useState<SessionState>({
    userId: null,
    signedIn: false,
  });
  const [mockReady, setMockReady] = useState(false);

  // ── supabase-mode state ──────────────────────────────────────────────────
  const [supaUser, setSupaUser] = useState<User | null>(null);
  const [supaReady, setSupaReady] = useState(false);

  // Hydrate mock session from localStorage once on mount.
  useEffect(() => {
    if (mode !== "mock") return;
    setMockState(readPersisted());
    setMockReady(true);
  }, [mode]);

  // Persist any mock-session change.
  useEffect(() => {
    if (mode === "mock" && mockReady) writePersisted(mockState);
  }, [mode, mockState, mockReady]);

  // If the active mock user is deactivated or removed, drop the session.
  useEffect(() => {
    if (mode !== "mock" || !mockState.userId) return;
    const u = users.find((x) => x.id === mockState.userId);
    if (!u || u.active === false) {
      setMockState({ userId: null, signedIn: false });
    }
  }, [mode, users, mockState.userId]);

  // Subscribe to real Supabase auth state.
  useEffect(() => {
    if (mode !== "supabase") return;
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
  }, [mode]);

  const signInAsDemoUser = useCallback(
    (userId: string) => {
      if (mode !== "mock") return;
      const u = users.find((x) => x.id === userId);
      if (!u || u.active === false) return;
      setMockState({ userId, signedIn: true });
    },
    [mode, users]
  );

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
      password: string
    ): Promise<AuthResult> => {
      // Handled server-side so Supabase's email rate limits never apply.
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
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
    if (mode === "supabase") {
      const sb = getSupabaseBrowserClient();
      sb?.auth.signOut();
      setSupaUser(null);
    } else {
      setMockState({ userId: null, signedIn: false });
    }
  }, [mode]);

  const value = useMemo<SessionValue>(() => {
    if (mode === "supabase") {
      return {
        currentUser: supaUser,
        role: supaUser?.role ?? null,
        isAuthenticated: !!supaUser,
        isReady: supaReady,
        mode,
        allUsers: [],
        signInAsDemoUser,
        signInWithPassword,
        signInWithMagicLink,
        sendPasswordReset,
        signUp,
        updateProfile,
        signOut,
      };
    }
    const currentUser =
      mockState.signedIn && mockState.userId
        ? users.find((u) => u.id === mockState.userId) ?? null
        : null;
    return {
      currentUser,
      role: currentUser?.role ?? null,
      isAuthenticated: !!currentUser,
      isReady: mockReady,
      mode,
      allUsers: users,
      signInAsDemoUser,
      signInWithPassword,
      signInWithMagicLink,
      sendPasswordReset,
      signUp,
      updateProfile,
      signOut,
    };
  }, [
    mode,
    supaUser,
    supaReady,
    mockState,
    mockReady,
    users,
    signInAsDemoUser,
    signInWithPassword,
    signInWithMagicLink,
    sendPasswordReset,
    signUp,
    updateProfile,
    signOut,
  ]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Convenience: list of demo users for the mock-mode login picker. */
export function useDemoUsers(): User[] {
  const { allUsers } = useSession();
  return allUsers.filter((u) => u.active !== false);
}

export const SESSION_DEFAULTS = {
  STORAGE_KEY,
  DEFAULT_DEMO_USER_ID,
};
