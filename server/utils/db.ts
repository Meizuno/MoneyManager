import type { H3Event } from "h3";
import { createError } from "h3";

type D1Database = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      all: () => Promise<{ results: Record<string, unknown>[] }>;
      run: () => Promise<{ success: boolean }>;
    };
    all: () => Promise<{ results: Record<string, unknown>[] }>;
    run: () => Promise<{ success: boolean }>;
  };
  batch: (
    statements: Array<{
      bind: (...values: unknown[]) => {
        all: () => Promise<{ results: Record<string, unknown>[] }>;
        run: () => Promise<{ success: boolean }>;
      };
    }>,
  ) => Promise<unknown[]>;
};

export const getDb = (event: H3Event): D1Database => {
  const db = (event.context.cloudflare as { env?: { DB?: D1Database } } | undefined)
    ?.env?.DB;
  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage: "Database binding not available.",
    });
  }
  return db;
};
