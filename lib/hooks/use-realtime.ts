"use client";

/**
 * Realtime refetch helper.
 *
 * Subscribes to Supabase Postgres changes on one or more tables and invokes
 * `onChange` (debounced) whenever any row in those tables is inserted,
 * updated, or deleted. Pages pair it with their existing `refetch()` calls so
 * the view stays live when *another* user mutates the same data — e.g. an
 * editor decides a pitch while a leader is watching the queue, or a story is
 * slotted into an issue someone else has open.
 *
 * It is a no-op when Supabase isn't the active backend (mock mode or missing
 * env), so it is always safe to call unconditionally.
 */
import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function useRealtimeRefetch(
  tables: readonly string[],
  onChange: () => void,
  options?: { debounceMs?: number }
): void {
  // Keep the latest callback without forcing a re-subscribe each render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const debounceMs = options?.debounceMs ?? 250;
  // Stable key so the effect re-subscribes only when the table set changes,
  // not on every render that passes a fresh array literal.
  const key = tables.slice().sort().join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    const sb = getSupabaseBrowserClient();
    if (!sb || list.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    // Coalesce bursts (e.g. a publish that touches many rows) into one refetch.
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    const channel = sb.channel(`realtime:${key}`);
    for (const table of list) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        fire
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      sb.removeChannel(channel);
    };
  }, [key, debounceMs]);
}
