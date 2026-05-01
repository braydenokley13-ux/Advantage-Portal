"use client";

/**
 * `useRole` is a thin compatibility layer over the new `useSession` model.
 *
 * Existing UI imports `useRole().user / role / setUserId / allUsers`. Those
 * keep working — internally they read from the session. Switching demo users
 * routes through `signInAsDemoUser` so the persistence + safety guarantees of
 * the session apply uniformly.
 *
 * NEW code should call `useSession()` directly.
 */
import { createContext, useContext, useMemo } from "react";
import { useSession } from "./session";
import type { Role, User } from "./types";

type RoleContextValue = {
  user: User;
  role: Role;
  setUserId: (id: string) => void;
  allUsers: User[];
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();

  const value = useMemo<RoleContextValue | null>(() => {
    if (!session.currentUser) return null;
    return {
      user: session.currentUser,
      role: session.currentUser.role,
      setUserId: session.signInAsDemoUser,
      allUsers: session.allUsers,
    };
  }, [session]);

  // When unauthenticated, render children but `useRole()` will throw if
  // anyone calls it. The (app) layout guards routes; surfaces outside the
  // gate (e.g. /login) should not call `useRole`.
  return (
    <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error(
      "useRole requires an authenticated session. Render inside the (app) gate."
    );
  }
  return ctx;
}
