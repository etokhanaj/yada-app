/**
 * The open databases, handed to every screen. Opened once by the root layout
 * before any route renders, so screens never wait on a connection.
 */

import type { SQLiteDatabase } from "expo-sqlite";
import { createContext, type DependencyList, useCallback, useContext, useEffect, useState } from "react";

import type { Db } from "./queries";
import { type EventName, logEvent } from "./user";

export interface AppData {
  readonly core: SQLiteDatabase;
  readonly user: SQLiteDatabase;
  /**
   * The tab Yada opens on, read with the settings before the tabs mount. A navigate after mount could override a
   * notification, a widget link or Return (RT-01) that routed first (code review, 18 Oct 2026).
   */
  readonly launchTab: "today" | "index" | "pray";
}

const Context = createContext<AppData | null>(null);

export const AppDataProvider = Context.Provider;

export function useAppData(): AppData {
  const value = useContext(Context);
  if (value === null) throw new Error("useAppData outside AppDataProvider");
  return value;
}

/** expo-sqlite's overloads, narrowed to the interface queries.ts is written against. */
export function asDb(db: SQLiteDatabase): Db {
  return db as unknown as Db;
}

export function useCore(): Db {
  return asDb(useAppData().core);
}

/**
 * Run an async read and hold its result. No loading state is exposed on
 * purpose: reading surfaces render nothing until the data is there (a few
 * milliseconds from a local file) rather than a skeleton, which the design
 * brief rules out.
 */
export function useQuery<T>(run: () => Promise<T>, deps: DependencyList): { data: T | undefined; error: unknown } {
  // Results are tagged with the inputs that produced them, so a screen whose
  // params just changed never renders the previous chapter's rows for a frame.
  // Primitives only: objects (a database handle) are stable for the app's life
  // and some are circular, so they never take part in the key.
  const key = deps.map((d) => (d !== null && typeof d === "object" ? "·" : String(d))).join("|");
  const [state, setState] = useState<{ key: string; data: T | undefined; error: unknown }>({
    key: "",
    data: undefined,
    error: undefined,
  });
  useEffect(() => {
    let live = true;
    run().then(
      (data) => {
        if (live) setState({ key, data, error: undefined });
      },
      (error: unknown) => {
        // A failed local read is a bug, not a state to design for; say so in development.
        if (__DEV__) console.warn("query failed", key, error);
        if (live) setState({ key, data: undefined, error });
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? { data: state.data, error: state.error } : { data: undefined, error: undefined };
}

/** PRD §14 events, fire-and-forget: a failed log line must never break reading. */
export function useLog(): (name: EventName, verseId?: string, detail?: string) => void {
  const { user } = useAppData();
  return useCallback(
    (name, verseId, detail) => {
      logEvent(user, name, verseId, detail).catch(() => undefined);
    },
    [user],
  );
}
