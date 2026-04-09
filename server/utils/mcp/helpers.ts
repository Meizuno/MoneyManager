import { z } from "zod/v3";

/** Optional string field — empty string is treated as absent (undefined). */
export const optStr = z.string().optional().transform((v) => v === "" ? undefined : v);

/** Optional category ID — empty string is treated as absent (undefined). */
export const optCategoryId = z
  .union([z.string(), z.number().int()])
  .optional()
  .transform((v) => v === "" ? undefined : v);

/** Wrap any value as a JSON MCP tool result. */
export const toJson = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
});
