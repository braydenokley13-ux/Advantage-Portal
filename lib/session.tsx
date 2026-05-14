"use client";

/**
 * Session abstraction.
 *
 * Today this is a thin in-memory shim that mimics the surface a real Supabase
 * session would expose. UI code should call these methods (NOT `setUserId` on
 * `RoleProvider`) so the swap to real auth is local to this file.
 *
 * Persistence: localStorage holds `{ userId, signedIn }` so a refresh keeps
 * the active demo user.
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
import type { Role, User } from "./types";

type SessionState = {
  userId: string | null;
  signedIn: boolean;
};

type SessionValue = {
  currentUser: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  /** Hydration finished — `currentUser` reflects persisted state. */
  isReady: boolean;
  allUsers: User[];
  signInAsDemoUser: (userId: string) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

const STORAGE_KEY = "advantage-portal:session";
/** Default demo-user when no persisted session exists. */
const DEFAULT_DEMO_USER_ID = "u6"; // leader

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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { users } = useStore();
  const [state, setState] = useState<SessionState>({
    userId: null,
    signedIn: false,
  });
  const [isReady, setIsReady] = useState(false);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    const persisted = readPersisted();
    setState(persisted);
    setIsReady(true);
  }, []);

  // Persist any change.
  useEffect(() => {
    if (isReady) writePersisted(state);
  }, [state, isReady]);

  // If the active user is deactivated or removed by an admin mutation, drop
  // them out of the session safely.
  useEffect(() => {
    if (!state.userId) return;
    const u = users.find((x) => x.id === state.userId);
    if (!u || u.active === false) {
      setState({ userId: null, signedIn: false });
    }
  }, [users, state.userId]);

  const signInAsDemoUser = useCallback(
    (userId: string) => {
      // Demo-only escape hatch. Outside demo mode the only legitimate way
      // to populate a session is the real auth flow (Supabase Auth, etc.),
      // so we refuse impersonation here to prevent accidental shipping of
      // the demo picker as a production sign-in path.
      if (!isDemoMode()) return;
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
    const currentUser = state.signedIn && state.userId
      ? users.find((u) => u.id === state.userId) ?? null
      : null;
    return {
      currentUser,
      role: currentUser?.role ?? null,
      isAuthenticated: !!currentUser,
      isReady,
      allUsers: users,
      signInAsDemoUser,
      signOut,
    };
  }, [state, users, isReady, signInAsDemoUser, signOut]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

/** Convenience: list of demo users for the login picker. */
export function useDemoUsers(): User[] {
  const { allUsers } = useSession();
  return allUsers.filter((u) => u.active !== false);
}

export const SESSION_DEFAULTS = {
  STORAGE_KEY,
  DEFAULT_DEMO_USER_ID,
};

/**
 * Whether the build is running with the demo affordances on. Controls the
 * `/login` user picker and the top-bar `RoleSwitcher`. Both surfaces let
 * any visitor become any user, so they MUST be off in any deployment that
 * exposes the portal to a real audience.
 *
 * Default is "on" so existing dev/demo workflows keep working; flip
 * `NEXT_PUBLIC_DEMO_MODE=0` in production env to disable.
 */
export function isDemoMode(): boolean {
  const v = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (typeof v !== "string" || v.length === 0) return true;
  return v !== "0" && v.toLowerCase() !== "false";
}
