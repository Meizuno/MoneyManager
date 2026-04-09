import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod/v3";
import { nextColor } from "../salesSplitColors";
import { toJson } from "./helpers";

export function registerIncomeCategoryTools(server: McpServer, db: PrismaClient, userId: string) {
  server.registerTool(
    "get_income_categories",
    {
      description: "Return all income categories for the current user. Each category has id, label, and color. Use the id as transaction.category when creating or filtering income transactions. No parameters required.",
      inputSchema: z.object({}),
    },
    async () => {
      const categories = await db.incomeCategory.findMany({
        where: { user_id: userId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });
      return toJson(categories);
    },
  );

  server.registerTool(
    "add_income_category",
    {
      description: `Create a new income category. Color is assigned automatically based on position.
Required: label.
The returned id is used as transaction.category when creating income transactions.
⚠️ WARNING: This action modifies user data. You MUST explicitly confirm with the user before calling this tool.`,
      inputSchema: z.object({
        label: z.string().describe("(required) Category name, e.g. Salary, Freelance, Interest, Dividends."),
      }),
    },
    async ({ label }) => {
      const count = await db.incomeCategory.count({ where: { user_id: userId } });
      const category = await db.incomeCategory.create({
        data: { user_id: userId, label, color: nextColor(count), position: count },
      });
      return toJson(category);
    },
  );

  server.registerTool(
    "update_income_category",
    {
      description: "Update the label of an existing income category by its id. Required: id, label.\n⚠️ WARNING: This action modifies user data. You MUST explicitly confirm with the user before calling this tool.",
      inputSchema: z.object({
        id: z.number().int().describe("(required) ID of the income category to update."),
        label: z.string().describe("(required) New category name."),
      }),
    },
    async ({ id, label }) => {
      const category = await db.incomeCategory.update({
        where: { id, user_id: userId },
        data: { label },
      });
      return toJson(category);
    },
  );

  server.registerTool(
    "remove_income_category",
    {
      description: "Delete an income category by its id. Required: id.\n⚠️ WARNING: This action permanently deletes user data. You MUST explicitly confirm with the user before calling this tool.",
      inputSchema: z.object({
        id: z.number().int().describe("(required) ID of the income category to delete."),
      }),
    },
    async ({ id }) => {
      await db.incomeCategory.delete({ where: { id, user_id: userId } });
      return toJson({ deleted: id });
    },
  );
}
