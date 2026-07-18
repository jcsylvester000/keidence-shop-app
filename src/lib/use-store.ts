"use client";

import { useSyncExternalStore } from "react";
import { subscribe } from "@/data/store";

/**
 * Subscribe a component to the shared mock data store. Pass a selector that
 * reads from the store; the component re-renders whenever the store emits.
 *
 *   const products = useStore(() => getProducts());
 */
export function useStore<T>(selector: () => T): T {
  return useSyncExternalStore(
    subscribe,
    selector,
    selector // server snapshot (store is deterministic on first render)
  );
}
