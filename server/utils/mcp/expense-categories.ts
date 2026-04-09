import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod/v3";
import { nextColor } from "../salesSplitColors";
import { toJson, optStr } from "./helpers";

export function registerExpenseCategoryTools(server: McpServer, db: PrismaClient, userId: string) {
  server.registerTool(
    "get_expense_categories",
    {
      description: "Return all expense categories for the current user. Each category has id, label, percent, and color. Use the id as transaction.category when creating or filtering expense transactions. No parameters required.",
      inputSchema: z.object({}),
    },
    async () => {
      const categories = await db.expenseCategory.findMany({
        where: { user_id: userId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });
      return toJson(categories);
    },
  );

  server.registerTool(
    "add_expense_category",
    {
      description: `Create a new expense category. Color is assigned automatically based on position.
Required: label, percent.
The returned id is used as transaction.category when creating expense transactions.
⚠️ WARNING: This action modifies user data. You MUST explicitly confirm with the user before calling this tool.`,
      inputSchema: z.object({
        label: z.string().describe("(required) Category name, e.g. Taxes, Savings, Rent, Food."),
        percent: z.number().min(0).max(100).describe("(required) Percentage of income to allocate to this category (0–100)."),
      }),
    },
    async ({ label, percent }) => {
      const count = await db.expenseCategory.count({ where: { user_id: userId } });
      const category = await db.expenseCategory.create({
        data: { user_id: userId, label, percent, color: nextColor(count), position: count },
      });
      return toJson(category);
    },
  );

  server.registerTool(
    "update_expense_category",
    {
      description: `Update an expense category by its id.
Required: id.
Optional: label, percent — only provided fields are updated, the rest stay unchanged.
⚠️ WARNING: This action modifies user data. You MUST explicitly confirm with the user before calling this tool.`,
      inputSchema: z.object({
        id: z.number().int().describe("(required) ID of the expense category to update."),
        label: optStr.describe("(optional) New category name. Omit or pass empty string to leave unchanged."),
        percent: z.number().min(0).max(100).optional().describe("(optional) New allocation percentage (0–100)."),
      }),
    },
    async ({ id, label, percent }) => {
      const data: Record<string, unknown> = {};
      if (label !== undefined) data.label = label;
      if (percent !== undefined) data.percent = percent;
      const category = await db.expenseCategory.update({ where: { id }, data });
      return toJson(category);
    },
  );

  server.registerTool(
    "remove_expense_category",
    {
      description: "Delete an expense category by its id. Required: id.\n⚠️ WARNING: This action permanently deletes user data. You MUST explicitly confirm with the user before calling this tool.",
      inputSchema: z.object({
        id: z.number().int().describe("(required) ID of the expense category to delete."),
      }),
    },
    async ({ id }) => {
      await db.expenseCategory.delete({ where: { id } });
      return toJson({ deleted: id });
    },
  );

  server.registerTool(
    "get_expense_category_preview",
    {
      description: "Show each expense category with its budget allocation amount calculated from total income. Returns totalIncome, totalAllocatedPercent, unallocatedPercent, unallocatedAmount, and a breakdown per category. No parameters required.",
      inputSchema: z.object({}),
    },
    async () => {
      const [incomes, categories] = await Promise.all([
        db.income.findMany({ where: { user_id: userId } }),
        db.expenseCategory.findMany({ where: { user_id: userId }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
      ]);
      const totalIncome = incomes.reduce((sum, i) => sum + Math.abs(Number(i.amount)), 0);
      const totalPercent = categories.reduce((s, c) => s + Number(c.percent), 0);
      return toJson({
        totalIncome,
        totalAllocatedPercent: totalPercent,
        unallocatedPercent: Math.max(0, 100 - totalPercent),
        unallocatedAmount: (totalIncome * Math.max(0, 100 - totalPercent)) / 100,
        categories: categories.map((c) => ({
          id: c.id,
          label: c.label,
          percent: Number(c.percent),
          amount: (totalIncome * Number(c.percent)) / 100,
        })),
      });
    },
  );
}
