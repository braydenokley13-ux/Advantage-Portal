"use client";

/**
 * Session abstraction.
 *
 * Two modes, controlled by `resolveDataMode()`:
 *   • "mock"     — in-memory demo session backed by localStorage. The login
 *                  picker chooses a seed user; no real network.
 *   • "supabase" — real Supabase Auth. Subscribes to `onAuthStateChange`
 *                  and reads the profile row from `public.users`.
 *
 * Both modes expose the same `SessionValue` shape so every caller
 * (`AuthGate`, `RoleSwitcher`, hooks, pages) keeps working.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStore } from "./store";
import type { Role, User } from "./types";
import { resolveDataMode } from "./supabase/env";
import { getSupabaseBrowserClient } from "./supabase/browser";

type DemoState = {
  userId: string | null;
  signedIn: boolean;
};

type SignInResult = { error?: string };

type SessionValue = {
  /** "mock" when running against the in-memory store, "supabase" otherwise. */
  mode: "mock" | "supabase";
  currentUser: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  /** Hydration finished — `currentUser` reflects persisted state. */
  isReady: boolean;
  /** Users available for the role switcher. Empty in supabase mode. */
  allUsers: User[];
  /** Mock-only. Real-mode callers should use `signInWithPassword`. */
  signInAsDemoUser: (userId: string) => void;
  /** Supabase password sign-in. Returns an error string on failure. */
  signInWithPassword: (email: string, password: string) => Promise<SignInResult>;
  /** Supabase magic-link sign-in. Returns an error string on failure. */
  signInWithMagicLink: (email: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

const STORAGE_KEY = "advantage-portal:session";
const DEFAULT_DEMO_USER_ID = "u6";

function readPersisted(): DemoState {
  if (typeof window === "undefined") return { userId: null, signedIn: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { userId: null, signedIn: false };
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return {
      userId: typeof parsed.userId === "string" ? parsed.userId : null,
      signedIn: parsed.signedIn === true,
    };
  } catch {
    return { userId: null, signedIn: false };
  }
}

function writePersisted(state: DemoState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function appUrl(): string {
  const explicit =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL
      : undefined;
  if (explicit && explicit.length > 0) return explicit.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const mode = resolveDataMode().mode;
  if (mode === "supabase") {
    return <SupabaseSession>{children}</SupabaseSession>;
  }
  return <MockSession>{children}</MockSession>;
}

// ── mock mode (in-memory demo) ───────────────────────────────────────────
function MockSession({ children }: { children: React.ReactNode }) {
  const { users } = useStore();
  const [state, setState] = useState<DemoState>({ userId: null, signedIn: false });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setState(readPersisted());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady) writePersisted(state);
  }, [state, isReady]);

  // Drop the session if the demo user is deactivated mid-flight.
  useEffect(() => {
    if (!state.userId) return;
    const u = users.find((x) => x.id === state.userId);
    if (!u || u.active === false) {
      setState({ userId: null, signedIn: false });
    }
  }, [users, state.userId]);

  const signInAsDemoUser = useCallback(
    (userId: string) => {
      const u = users.find((x) => x.id === userId);
      if (!u || u.active === false) return;
      setState({ userId, signedIn: true });
    },
    [users]
  );

  const signOut = useCallback(async () => {
    setState({ userId: null, signedIn: false });
  }, []);

  const notSupabase = useCallback(
    async (): Promise<SignInResult> => ({
      error: "Real auth is disabled — set NEXT_PUBLIC_DATA_MODE=supabase.",
    }),
    []
  );

  const value = useMemo<SessionValue>(() => {
    const currentUser =
      state.signedIn && state.userId
        ? users.find((u) => u.id === state.userId) ?? null
        : null;
    return {
      mode: "mock",
      currentUser,
      role: currentUser?.role ?? null,
      isAuthenticated: !!currentUser,
      isReady,
      allUsers: users,
      signInAsDemoUser,
      signInWithPassword: notSupabase,
      signInWithMagicLink: notSupabase,
      signOut,
    };
  }, [state, users, isReady, signInAsDemoUser, signOut, notSupabase]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// ── supabase mode (real auth) ────────────────────────────────────────────
function SupabaseSession({ children }: { children: React.ReactNode }) {
  const client = getSupabaseBrowserClient();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const subscribedRef = useRef(false);

  // Subscribe to auth state once.
  useEffect(() => {
    if (!client || subscribedRef.current) return;
    subscribedRef.current = true;

    let cancelled = false;

    (async () => {
      const { data } = await client.auth.getUser();
      if (cancelled) return;
      setAuthUserId(data.user?.id ?? null);
      setIsReady(true);
    })();

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null);
      setIsReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  // Load profile row for the active auth user.
  useEffect(() => {
    if (!client) return;
    if (!authUserId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await client
        .from("users")
        .select("id, name, email, role, avatar_url, active")
        .eq("id", authUserId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setProfile(null);
        return;
      }
      setProfile({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as Role,
        avatarUrl: data.avatar_url ?? undefined,
        active: data.active,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, authUserId]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      if (!client) return { error: "Supabase client unavailable." };
      const { error } = await client.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    [client]
  );

  const signInWithMagicLink = useCallback(
    async (email: string): Promise<SignInResult> => {
      if (!client) return { error: "Supabase client unavailable." };
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${appUrl()}/auth/callback` },
      });
      return error ? { error: error.message } : {};
    },
    [client]
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setAuthUserId(null);
    setProfile(null);
  }, [client]);

  // Mock-only entry-point is a no-op in real mode.
  const signInAsDemoUser = useCallback(() => {}, []);

  const value = useMemo<SessionValue>(
    () => ({
      mode: "supabase",
      currentUser: profile,
      role: profile?.role ?? null,
      isAuthenticated: !!profile,
      isReady,
      allUsers: profile ? [profile] : [],
      signInAsDemoUser,
      signInWithPassword,
      signInWithMagicLink,
      signOut,
    }),
    [profile, isReady, signInAsDemoUser, signInWithPassword, signInWithMagicLink, signOut]
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

/** Convenience: list of demo users for the login picker (mock mode only). */
export function useDemoUsers(): User[] {
  const { allUsers } = useSession();
  return allUsers.filter((u) => u.active !== false);
}

export const SESSION_DEFAULTS = {
  STORAGE_KEY,
  DEFAULT_DEMO_USER_ID,
};
