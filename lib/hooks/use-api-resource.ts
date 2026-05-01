"use client";

/**
 * Internal helper for the data-hooks layer.
 *
 * Wraps an async ApiClient call into a React-friendly state shape with
 * `data / loading / error / refetch`. Today the mock adapter resolves
 * synchronously-ish (Promise.resolve over in-memory arrays), so loading is
 * usually a single tick. The shape is designed so the same hooks survive
 * unchanged when the HTTP adapter takes over.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type ApiResource<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options?: { initial?: T }
): ApiResource<T> {
  const [data, setData] = useState<T | undefined>(options?.initial);
  const [loading, setLoading] = useState(options?.initial === undefined);
  const [error, setError] = useState<Error | null>(null);
  const tickRef = useRef(0);

  const run = useCallback(async () => {
    const tick = ++tickRef.current;
    setLoading(true);
    try {
      const result = await fetcher();
      if (tick !== tickRef.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (tick !== tickRef.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (tick === tickRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}
