import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v3";

const parseDate = (value: string | undefined, endOfDay: boolean) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  return new Date(`${value}${suffix}`);
};

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const userId = user.id;

  const db = getPrisma();
  const server = new McpServer({ name: "money-manager", version: "1.0.0" });

  server.registerTool(
    "list_transactions",
    {
      description: "List transactions with optional filters. Returns an array of transactions for the user.",
      inputSchema: z.object({
        type: z.enum(["income", "expense"]).optional().describe("Filter by type"),
        category: z.string().optional().describe("Filter by category (sale, interest, rental, food, wishes, car, loan, other)"),
        dateFrom: z.string().optional().describe("Start date YYYY-MM-DD"),
        dateTo: z.string().optional().describe("End date YYYY-MM-DD"),
      }),
    },
    async ({ type, category, dateFrom, dateTo }) => {
      const dateFromParsed = parseDate(dateFrom, false);
      const dateToParsed = parseDate(dateTo, true);
      const items = await db.transaction.findMany({
        where: {
          user_id: userId,
          ...(type ? { type } : {}),
          ...(category && category !== "all" ? { category } : {}),
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
        category: item.category,
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
      description: "Create a new income or expense transaction.",
      inputSchema: z.object({
        date: z.string().describe("Date in YYYY-MM-DD format"),
        name: z.string().describe("Transaction description"),
        amount: z.number().positive().describe("Amount as a positive number"),
        type: z.enum(["income", "expense"]).describe("Transaction type"),
        category: z.string().optional().describe("Category: sale, interest, rental, food, wishes, car, loan, other"),
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
          category: category ?? "other",
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
            category: item.category,
            currency: item.currency,
          }),
        }],
      };
    },
  );

  server.registerTool(
    "update_transaction",
    {
      description: "Update fields of an existing transaction by ID.",
      inputSchema: z.object({
        id: z.number().int().describe("Transaction ID"),
        date: z.string().optional().describe("New date YYYY-MM-DD"),
        name: z.string().optional().describe("New description"),
        amount: z.number().positive().optional().describe("New amount (positive)"),
        type: z.enum(["income", "expense"]).optional(),
        category: z.string().optional(),
        currency: z.string().nullable().optional(),
      }),
    },
    async ({ id, date, amount, ...rest }) => {
      const item = await db.transaction.update({
        where: { id, user_id: userId },
        data: {
          ...rest,
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
            category: item.category,
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

  server.registerTool(
    "get_sales_split",
    {
      description: "Get all income split rules (id, label, percent, color).",
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
      description: "Add a new income split rule. Color is assigned automatically.",
      inputSchema: z.object({
        label: z.string().describe("Name of this allocation (e.g. Taxes, Savings)"),
        percent: z.number().min(0).max(100).describe("Percentage of income to allocate"),
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
      description: "Update label or percent of an existing split rule by id.",
      inputSchema: z.object({
        id: z.number().int().describe("Rule id"),
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
      description: "Remove an income split rule by id.",
      inputSchema: z.object({ id: z.number().int().describe("Rule id to remove") }),
    },
    async ({ id }) => {
      await db.salesSplitRule.delete({ where: { id } });
      return { content: [{ type: "text" as const, text: `Rule ${id} removed.` }] };
    },
  );

  server.registerTool(
    "get_sales_split_preview",
    {
      description: "Show each split rule with its calculated amount based on total income.",
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
      description: "Get all income categories (id, label, color).",
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
      description: "Add a new income category. Color is assigned automatically.",
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
