"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useStore } from "./store";
import type { Role, User } from "./types";

type RoleContextValue = {
  user: User;
  role: Role;
  setUserId: (id: string) => void;
  allUsers: User[];
};

const RoleContext = createContext<RoleContextValue | null>(null);

const DEFAULT_USER_ID = "u6"; // leader, broadest demo view
const STORAGE_KEY = "advantage-portal:active-user-id";

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { users } = useStore();
  const [userId, setUserId] = useState<string>(DEFAULT_USER_ID);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    if (saved && users.some((u) => u.id === saved)) {
      setUserId(saved);
    }
  }, [users]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, userId);
    }
  }, [userId]);

  const value = useMemo<RoleContextValue>(() => {
    const user =
      users.find((u) => u.id === userId) ?? users[0];
    return { user, role: user.role, setUserId, allUsers: users };
  }, [userId, users]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
