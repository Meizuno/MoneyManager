import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v3";

const parseDate = (value: string | undefined, endOfDay: boolean) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  return new Date(`${value}${suffix}`);
};

const parseCategoryId = (value: string | number | undefined) => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
  }
  return 0;
};

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const userId = user.id;

  const db = getPrisma();
  const server = new McpServer({ name: "money-manager", version: "1.0.0" });

  server.registerTool(
    "list_transactions",
    {
      description: "List transactions with optional filters. Transactions store category as an ID only. For expenses, category is a sales split rule ID; for income, category is an income category ID.",
      inputSchema: z.object({
        type: z.enum(["income", "expense"]).optional().describe("Filter by type"),
        category: z.union([z.string(), z.number().int()]).optional().describe("Filter by category ID only. For expenses: sales split rule ID. For income: income category ID."),
        dateFrom: z.string().optional().describe("Start date YYYY-MM-DD"),
        dateTo: z.string().optional().describe("End date YYYY-MM-DD"),
      }),
    },
    async ({ type, category, dateFrom, dateTo }) => {
      const dateFromParsed = parseDate(dateFrom, false);
      const dateToParsed = parseDate(dateTo, true);
      const categoryId = category === undefined || category === "all" ? null : parseCategoryId(category);
      const items = await db.transaction.findMany({
        where: {
          user_id: userId,
          ...(type ? { type } : {}),
          ...(categoryId !== null ? { category: categoryId } : {}),
          ...((dateFromParsed || dateToParsed) ? {
            date: {
              ...(dateFromParsed ? { gte: dateFromParsed } : {}),
              ...(dateToParsed ? { lte: dateToParsed } : {}),
            },
          } : {}),
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      });
      const formatted = items.map((item) => ({
        id: item.id,
        date: item.date.toISOString().slice(0, 10),
        name: item.name,
        amount: Number(item.amount),
        currency: item.currency,
        type: item.type,
        category: String(item.category),
      }));
      return { content: [{ type: "text" as const, text: JSON.stringify(formatted, null, 2) }] };
    },
  );

  server.registerTool(
    "get_summary",
    {
      description: "Get total income, total expenses, and net balance across all transactions.",
      inputSchema: z.object({}),
    },
    async () => {
      const items = await db.transaction.findMany({ where: { user_id: userId } });
      let income = 0;
      let expenses = 0;
      for (const item of items) {
        const abs = Math.abs(Number(item.amount));
        if (item.type === "income") income += abs;
        else expenses += abs;
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ income, expenses, net: income - expenses }) }],
      };
    },
  );

  server.registerTool(
    "create_transaction",
    {
      description: "Create a new income or expense transaction. The category field accepts category ID only.",
      inputSchema: z.object({
        date: z.string().describe("Date in YYYY-MM-DD format"),
        name: z.string().describe("Transaction description"),
        amount: z.number().positive().describe("Amount as a positive number"),
        type: z.enum(["income", "expense"]).describe("Transaction type"),
        category: z.union([z.string(), z.number().int()]).optional().describe("Category ID only."),
        currency: z.string().optional().describe("3-letter currency code, e.g. CZK, USD, EUR"),
      }),
    },
    async ({ date, name, amount, type, category, currency }) => {
      const item = await db.transaction.create({
        data: {
          date: new Date(date),
          name,
          amount: Math.abs(amount),
          type,
          category: parseCategoryId(category),
          currency: currency ?? null,
          user_id: userId,
        },
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: item.id,
            date: item.date.toISOString().slice(0, 10),
            name: item.name,
            amount: Number(item.amount),
            type: item.type,
            category: String(item.category),
            currency: item.currency,
          }),
        }],
      };
    },
  );

  server.registerTool(
    "update_transaction",
    {
      description: "Update fields of an existing transaction by ID. If category is provided, it must be a category ID.",
      inputSchema: z.object({
        id: z.number().int().describe("Transaction ID"),
        date: z.string().optional().describe("New date YYYY-MM-DD"),
        name: z.string().optional().describe("New description"),
        amount: z.number().positive().optional().describe("New amount (positive)"),
        type: z.enum(["income", "expense"]).optional(),
        category: z.union([z.string(), z.number().int()]).optional().describe("Category ID only."),
        currency: z.string().nullable().optional(),
      }),
    },
    async ({ id, date, amount, category, ...rest }) => {
      const item = await db.transaction.update({
        where: { id, user_id: userId },
        data: {
          ...rest,
          ...(category !== undefined ? { category: parseCategoryId(category) } : {}),
          ...(date ? { date: new Date(date) } : {}),
          ...(amount !== undefined ? { amount: Math.abs(amount) } : {}),
        },
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: item.id,
            date: item.date.toISOString().slice(0, 10),
            name: item.name,
            amount: Number(item.amount),
            type: item.type,
            category: String(item.category),
            currency: item.currency,
          }),
        }],
      };
    },
  );

  server.registerTool(
    "delete_transaction",
    {
      description: "Delete a transaction by ID.",
      inputSchema: z.object({
        id: z.number().int().describe("Transaction ID"),
      }),
    },
    async ({ id }) => {
      await db.transaction.delete({ where: { id, user_id: userId } });
      return { content: [{ type: "text" as const, text: `Transaction ${id} deleted.` }] };
    },
  );

  // --- Sales Split tools ---
  // Sales split rules serve as EXPENSE CATEGORIES. Each rule has a label (the category name),
  // a percent (how much of income is allocated to it), and an id used as the category value
  // when creating or filtering expense transactions.

  server.registerTool(
    "get_sales_split",
    {
      description: "Get all expense categories (called sales split rules). Each rule has an id, label, percent, and color. Use only the rule ID in transaction.category.",
      inputSchema: z.object({}),
    },
    async () => {
      const rules = await db.salesSplitRule.findMany({
        where: { user_id: userId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(rules, null, 2) }] };
    },
  );

  server.registerTool(
    "add_sales_split_rule",
    {
      description: "Add a new expense category (sales split rule). Color is assigned automatically. The created rule's ID is what you put into transaction.category.",
      inputSchema: z.object({
        label: z.string().describe("Expense category name (e.g. Taxes, Savings, Rent, Food)"),
        percent: z.number().min(0).max(100).describe("Percentage of income to allocate to this category"),
      }),
    },
    async ({ label, percent }) => {
      const { nextColor } = await import("../utils/salesSplitColors.js");
      const count = await db.salesSplitRule.count({ where: { user_id: userId } });
      const rule = await db.salesSplitRule.create({
        data: { user_id: userId, label, percent, color: nextColor(count), position: count },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(rule) }] };
    },
  );

  server.registerTool(
    "update_sales_split_rule",
    {
      description: "Update the label or percent of an expense category (sales split rule) by its id.",
      inputSchema: z.object({
        id: z.number().int().describe("Expense category (rule) id"),
        label: z.string().optional().describe("New label"),
        percent: z.number().min(0).max(100).optional().describe("New percent"),
      }),
    },
    async ({ id, label, percent }) => {
      const data: Record<string, unknown> = {};
      if (label !== undefined) data.label = label;
      if (percent !== undefined) data.percent = percent;
      const rule = await db.salesSplitRule.update({ where: { id }, data });
      return { content: [{ type: "text" as const, text: JSON.stringify(rule) }] };
    },
  );

  server.registerTool(
    "remove_sales_split_rule",
    {
      description: "Remove an expense category (sales split rule) by id.",
      inputSchema: z.object({ id: z.number().int().describe("Expense category (rule) id to remove") }),
    },
    async ({ id }) => {
      await db.salesSplitRule.delete({ where: { id } });
      return { content: [{ type: "text" as const, text: `Rule ${id} removed.` }] };
    },
  );

  server.registerTool(
    "get_sales_split_preview",
    {
      description: "Show each expense category (sales split rule) with its calculated allocation amount based on total income. Useful for budget planning.",
      inputSchema: z.object({}),
    },
    async () => {
      const [txItems, rules] = await Promise.all([
        db.transaction.findMany({ where: { user_id: userId } }),
        db.salesSplitRule.findMany({ where: { user_id: userId }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
      ]);
      const totalIncome = txItems.reduce((sum, item) =>
        sum + (item.type === "income" ? Math.abs(Number(item.amount)) : 0), 0);
      const totalPercent = rules.reduce((s, r) => s + Number(r.percent), 0);
      const preview = rules.map((r) => ({
        id: r.id, label: r.label, percent: Number(r.percent),
        amount: (totalIncome * Number(r.percent)) / 100,
      }));
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            totalIncome,
            totalAllocatedPercent: totalPercent,
            unallocatedPercent: Math.max(0, 100 - totalPercent),
            unallocatedAmount: (totalIncome * Math.max(0, 100 - totalPercent)) / 100,
            rules: preview,
          }, null, 2),
        }],
      };
    },
  );

  // --- Income Category tools ---

  server.registerTool(
    "get_income_categories",
    {
      description: "Get all income categories (id, label, color). Use only category ID in transaction.category.",
      inputSchema: z.object({}),
    },
    async () => {
      const categories = await db.incomeCategoryRule.findMany({
        where: { user_id: userId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(categories, null, 2) }] };
    },
  );

  server.registerTool(
    "add_income_category",
    {
      description: "Add a new income category. Color is assigned automatically. The created ID is what you put into transaction.category.",
      inputSchema: z.object({
        label: z.string().describe("Name of this category (e.g. Sale, Freelance, Interest)"),
      }),
    },
    async ({ label }) => {
      const { nextColor } = await import("../utils/salesSplitColors.js");
      const count = await db.incomeCategoryRule.count({ where: { user_id: userId } });
      const category = await db.incomeCategoryRule.create({
        data: { user_id: userId, label, color: nextColor(count), position: count },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(category) }] };
    },
  );

  server.registerTool(
    "update_income_category",
    {
      description: "Update the label of an existing income category by id.",
      inputSchema: z.object({
        id: z.number().int().describe("Category id"),
        label: z.string().describe("New label"),
      }),
    },
    async ({ id, label }) => {
      const category = await db.incomeCategoryRule.update({
        where: { id, user_id: userId },
        data: { label },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(category) }] };
    },
  );

  server.registerTool(
    "remove_income_category",
    {
      description: "Remove an income category by id.",
      inputSchema: z.object({ id: z.number().int().describe("Category id to remove") }),
    },
    async ({ id }) => {
      await db.incomeCategoryRule.delete({ where: { id, user_id: userId } });
      return { content: [{ type: "text" as const, text: `Income category ${id} removed.` }] };
    },
  );

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const body = event.node.req.method === "POST" ? await readBody(event) : undefined;
  await transport.handleRequest(event.node.req, event.node.res, body);
});
