"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const { isReady, isAuthenticated } = useSession();

  useEffect(() => {
    if (!isReady) return;
    router.replace(isAuthenticated ? "/dashboard" : "/login");
  }, [isReady, isAuthenticated, router]);

  return null;
}
