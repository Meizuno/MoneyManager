import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod/v3";
import { toJson, optStr, optCategoryId } from "./helpers";

const parseDate = (value: string | undefined, endOfDay: boolean) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  return new Date(`${value}${suffix}`);
};

const parseCategoryId = (value: string | number | undefined) => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
  }
  return 0;
};

export function registerTransactionTools(server: McpServer, db: PrismaClient, userId: string) {
  server.registerTool(
    "list_transactions",
    {
      description: `List transactions ordered by date descending.
All parameters are optional — omitting a parameter returns all records without that filter.
- type: omit to return both incomes and expenses.
- category: omit to return all categories. Category IDs come from get_expense_categories (for expenses) or get_income_categories (for incomes).
- dateFrom / dateTo: omit either or both to remove the date boundary.`,
      inputSchema: z.object({
        type: z.enum(["income", "expense"]).optional().describe("(optional) Filter by type. Omit or pass empty string to return all transactions regardless of type."),
        category: optCategoryId.describe("(optional) Filter by category ID. Omit or pass empty string to return all categories."),
        dateFrom: optStr.describe("(optional) Return transactions on or after this date, format YYYY-MM-DD. Omit or pass empty string for no start boundary."),
        dateTo: optStr.describe("(optional) Return transactions on or before this date, format YYYY-MM-DD. Omit or pass empty string for no end boundary."),
      }),
    },
    async ({ type, category, dateFrom, dateTo }) => {
      const dateFromParsed = parseDate(dateFrom, false);
      const dateToParsed = parseDate(dateTo, true);
      const categoryId = category === undefined ? null : parseCategoryId(category);
      const where = {
        user_id: userId,
        ...(categoryId !== null ? { category: categoryId } : {}),
        ...((dateFromParsed || dateToParsed) ? {
          date: {
            ...(dateFromParsed ? { gte: dateFromParsed } : {}),
            ...(dateToParsed ? { lte: dateToParsed } : {}),
          },
        } : {}),
      };
      const orderBy = [{ date: "desc" as const }, { id: "desc" as const }];

      type Row = { id: number; date: Date; name: string; amount: object; currency: string | null; category: number; type: string };
      let items: Row[];

      if (type === "income") {
        items = (await db.income.findMany({ where, orderBy })).map((i) => ({ ...i, type: "income" }));
      } else if (type === "expense") {
        items = (await db.expense.findMany({ where, orderBy })).map((e) => ({ ...e, type: "expense" }));
      } else {
        const [incomes, expenses] = await Promise.all([
          db.income.findMany({ where, orderBy }),
          db.expense.findMany({ where, orderBy }),
        ]);
        items = [
          ...incomes.map((i) => ({ ...i, type: "income" })),
          ...expenses.map((e) => ({ ...e, type: "expense" })),
        ].sort((a, b) => {
          const diff = b.date.getTime() - a.date.getTime();
          return diff !== 0 ? diff : b.id - a.id;
        });
      }

      return toJson(items.map((item) => ({
        id: item.id,
        date: item.date.toISOString().slice(0, 10),
        name: item.name,
        amount: Number(item.amount),
        currency: item.currency,
        type: item.type,
        category: String(item.category),
      })));
    },
  );

  server.registerTool(
    "get_summary",
    {
      description: "Get total income, total expenses, and net balance (income minus expenses) across all transactions. No parameters required.",
      inputSchema: z.object({}),
    },
    async () => {
      const [incomes, expenses] = await Promise.all([
        db.income.findMany({ where: { user_id: userId } }),
        db.expense.findMany({ where: { user_id: userId } }),
      ]);
      const income = incomes.reduce((sum, i) => sum + Math.abs(Number(i.amount)), 0);
      const expense = expenses.reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);
      return toJson({ income, expenses: expense, net: income - expense });
    },
  );

  server.registerTool(
    "create_transaction",
    {
      description: `Create a new income or expense transaction.
Required: date, name, amount, type.
Optional: category (ID from get_expense_categories or get_income_categories depending on type), currency (3-letter ISO code, defaults to CZK if omitted).`,
      inputSchema: z.object({
        date: z.string().describe("(required) Date in YYYY-MM-DD format."),
        name: z.string().describe("(required) Transaction description."),
        amount: z.number().positive().describe("(required) Amount as a positive number."),
        type: z.enum(["income", "expense"]).describe("(required) Transaction type: 'income' or 'expense'."),
        category: optCategoryId.describe("(optional) Category ID. Use get_expense_categories or get_income_categories to find valid IDs. Defaults to 0 (uncategorised) if omitted or empty."),
        currency: optStr.describe("(optional) 3-letter ISO currency code, e.g. CZK, USD, EUR. Omit or pass empty string to leave unset."),
      }),
    },
    async ({ date, name, amount, type, category, currency }) => {
      const data = {
        date: new Date(date),
        name,
        amount: Math.abs(amount),
        category: parseCategoryId(category),
        currency: currency ?? null,
        user_id: userId,
      };
      const item = type === "income"
        ? await db.income.create({ data })
        : await db.expense.create({ data });
      return toJson({
        id: item.id,
        date: item.date.toISOString().slice(0, 10),
        name: item.name,
        amount: Number(item.amount),
        type,
        category: String(item.category),
        currency: item.currency,
      });
    },
  );

  server.registerTool(
    "update_transaction",
    {
      description: `Update one or more fields of an existing transaction by its ID.
Required: id.
Optional: date, name, amount, type, category, currency — only provided fields are updated, the rest stay unchanged.
Changing type moves the record between the incomes and expenses tables and assigns a new ID.`,
      inputSchema: z.object({
        id: z.number().int().describe("(required) ID of the transaction to update."),
        date: optStr.describe("(optional) New date in YYYY-MM-DD format. Omit or pass empty string to leave unchanged."),
        name: optStr.describe("(optional) New description. Omit or pass empty string to leave unchanged."),
        amount: z.number().positive().optional().describe("(optional) New amount as a positive number. Omit to leave unchanged."),
        type: z.enum(["income", "expense"]).optional().describe("(optional) New type. Changing this moves the record to the other table and assigns a new ID. Omit to leave unchanged."),
        category: optCategoryId.describe("(optional) New category ID. Use get_expense_categories or get_income_categories to find valid IDs. Omit or pass empty string to leave unchanged."),
        currency: optStr.nullable().describe("(optional) New 3-letter ISO currency code, or null to clear it. Omit or pass empty string to leave unchanged."),
      }),
    },
    async ({ id, date, amount, type, category, ...rest }) => {
      const existingIncome = await db.income.findFirst({ where: { id, user_id: userId } });
      const existingExpense = !existingIncome
        ? await db.expense.findFirst({ where: { id, user_id: userId } })
        : null;

      if (!existingIncome && !existingExpense) {
        throw new Error(`Transaction ${id} not found.`);
      }

      const currentType = existingIncome ? "income" : "expense";
      const newType = type ?? currentType;
      const updateData = {
        ...rest,
        ...(category !== undefined ? { category: parseCategoryId(category) } : {}),
        ...(date ? { date: new Date(date) } : {}),
        ...(amount !== undefined ? { amount: Math.abs(amount) } : {}),
      };

      let item;
      if (currentType !== newType) {
        if (currentType === "income") {
          await db.income.delete({ where: { id } });
          item = await db.expense.create({ data: { ...existingIncome!, ...updateData, user_id: userId, id: undefined } });
        } else {
          await db.expense.delete({ where: { id } });
          item = await db.income.create({ data: { ...existingExpense!, ...updateData, user_id: userId, id: undefined } });
        }
      } else {
        item = currentType === "income"
          ? await db.income.update({ where: { id, user_id: userId }, data: updateData })
          : await db.expense.update({ where: { id, user_id: userId }, data: updateData });
      }

      return toJson({
        id: item.id,
        date: item.date.toISOString().slice(0, 10),
        name: item.name,
        amount: Number(item.amount),
        type: newType,
        category: String(item.category),
        currency: item.currency,
      });
    },
  );

  server.registerTool(
    "delete_transaction",
    {
      description: "Delete a transaction by its ID. Searches both incomes and expenses tables. Required: id.",
      inputSchema: z.object({
        id: z.number().int().describe("(required) ID of the transaction to delete."),
      }),
    },
    async ({ id }) => {
      const deletedIncome = await db.income.deleteMany({ where: { id, user_id: userId } });
      if (deletedIncome.count === 0) {
        await db.expense.deleteMany({ where: { id, user_id: userId } });
      }
      return toJson({ deleted: id });
    },
  );
}
