"use client";

/**
 * Session provider — bridges the UI to Supabase Auth, with a mock fallback.
 *
 * Two runtime paths:
 *
 *   - mock     → in-memory demo picker backed by `useStore().users` and
 *                persisted in localStorage. Tests, Storybook, and offline
 *                dev still use this. Same behavior as the previous shim.
 *
 *   - supabase → subscribes to `supabase.auth.onAuthStateChange` and reads
 *                the matching `public.users` row to expose a fully-typed
 *                `currentUser`. Sign-in / sign-up / sign-out hit the real
 *                Supabase Auth API.
 *
 * The choice is made by `resolveDataMode()` (env-driven). UI code calls the
 * same `useSession()` hook in either case; only the login screen branches
 * on `session.mode` to render the right form.
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
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useStore } from "./store";
import { resolveDataMode } from "./supabase/env";
import { getSupabaseBrowserClient } from "./supabase/browser";
import type { Role, User } from "./types";

type AuthMode = "mock" | "supabase";

type AuthResult = { error?: string };

type SessionValue = {
  /** Active runtime auth mode — UI can branch on this. */
  mode: AuthMode;
  currentUser: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  /** Hydration finished — `currentUser` reflects persisted/fetched state. */
  isReady: boolean;
  /** Demo-mode roster. In supabase mode this is `[currentUser]` (or empty). */
  allUsers: User[];

  // ── Mock-only entry point. No-op + console warn in supabase mode.
  signInAsDemoUser: (userId: string) => void;

  // ── Supabase Auth entry points. In mock mode they return a clear error.
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<AuthResult>;
  signUpWithPassword: (
    email: string,
    password: string,
    name: string
  ) => Promise<AuthResult>;

  signOut: () => Promise<void> | void;
};

const SessionContext = createContext<SessionValue | null>(null);

const STORAGE_KEY = "advantage-portal:session";
/** Default demo-user when no persisted session exists. */
const DEFAULT_DEMO_USER_ID = "u6"; // leader

// ── shared helpers ─────────────────────────────────────────────────────────
function notInMode(expected: AuthMode): AuthResult {
  return {
    error: `This action is only available in ${expected} mode (current data-mode differs).`,
  };
}

// ── Mock-mode provider (preserved verbatim from the prior shim) ───────────
type MockSessionState = {
  userId: string | null;
  signedIn: boolean;
};

function readPersisted(): MockSessionState {
  if (typeof window === "undefined") return { userId: null, signedIn: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { userId: null, signedIn: false };
    const parsed = JSON.parse(raw) as Partial<MockSessionState>;
    return {
      userId: typeof parsed.userId === "string" ? parsed.userId : null,
      signedIn: parsed.signedIn === true,
    };
  } catch {
    return { userId: null, signedIn: false };
  }
}

function writePersisted(state: MockSessionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function MockSessionProvider({ children }: { children: React.ReactNode }) {
  const { users } = useStore();
  const [state, setState] = useState<MockSessionState>({
    userId: null,
    signedIn: false,
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setState(readPersisted());
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady) writePersisted(state);
  }, [state, isReady]);

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

  const signOut = useCallback(() => {
    setState({ userId: null, signedIn: false });
  }, []);

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
      signOut,
      signInWithPassword: async () => notInMode("supabase"),
      signInWithMagicLink: async () => notInMode("supabase"),
      signUpWithPassword: async () => notInMode("supabase"),
    };
  }, [state, users, isReady, signInAsDemoUser, signOut]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// ── Supabase-mode provider ────────────────────────────────────────────────
type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  active: boolean;
};

function rowToUser(r: ProfileRow): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    avatarUrl: r.avatar_url ?? undefined,
    active: r.active,
  };
}

async function fetchProfile(
  client: SupabaseClient,
  userId: string
): Promise<User | null> {
  const { data, error } = await client
    .from("users")
    .select("id, name, email, role, avatar_url, active")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn(`[advantage-portal] failed to load profile: ${error.message}`);
    return null;
  }
  return data ? rowToUser(data) : null;
}

function SupabaseSessionProvider({
  client,
  children,
}: {
  client: SupabaseClient;
  children: React.ReactNode;
}) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Pull the active session on mount + subscribe to all auth changes.
  useEffect(() => {
    let cancelled = false;

    async function applySession(session: Session | null) {
      if (cancelled) return;
      if (!session?.user) {
        if (mounted.current) {
          setCurrentUser(null);
          setIsReady(true);
        }
        return;
      }
      const profile = await fetchProfile(client, session.user.id);
      if (cancelled || !mounted.current) return;
      setCurrentUser(profile);
      setIsReady(true);
    }

    void client.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn(`[advantage-portal] supabase getSession failed`, err);
        if (mounted.current) setIsReady(true);
      });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    [client]
  );

  const signInWithMagicLink = useCallback(
    async (email: string, redirectTo?: string): Promise<AuthResult> => {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      });
      return error ? { error: error.message } : {};
    },
    [client]
  );

  const signUpWithPassword = useCallback(
    async (
      email: string,
      password: string,
      name: string
    ): Promise<AuthResult> => {
      const { error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      return error ? { error: error.message } : {};
    },
    [client]
  );

  const signOut = useCallback(async () => {
    await client.auth.signOut();
  }, [client]);

  const value = useMemo<SessionValue>(
    () => ({
      mode: "supabase",
      currentUser,
      role: currentUser?.role ?? null,
      isAuthenticated: !!currentUser,
      isReady,
      allUsers: currentUser ? [currentUser] : [],
      signInAsDemoUser: () => {
        // eslint-disable-next-line no-console
        console.warn(
          "[advantage-portal] signInAsDemoUser is a no-op in supabase mode."
        );
      },
      signInWithPassword,
      signInWithMagicLink,
      signUpWithPassword,
      signOut,
    }),
    [
      currentUser,
      isReady,
      signInWithPassword,
      signInWithMagicLink,
      signUpWithPassword,
      signOut,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// ── Top-level provider — picks the right backend ──────────────────────────
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const resolved = resolveDataMode();
  const supabaseClient =
    resolved.mode === "supabase" ? getSupabaseBrowserClient() : null;

  if (resolved.mode === "supabase" && supabaseClient) {
    return (
      <SupabaseSessionProvider client={supabaseClient}>
        {children}
      </SupabaseSessionProvider>
    );
  }
  return <MockSessionProvider>{children}</MockSessionProvider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Convenience: list of demo users for the login picker (mock mode only). */
export function useDemoUsers(): User[] {
  const { allUsers, mode } = useSession();
  if (mode !== "mock") return [];
  return allUsers.filter((u) => u.active !== false);
}

export const SESSION_DEFAULTS = {
  STORAGE_KEY,
  DEFAULT_DEMO_USER_ID,
};
