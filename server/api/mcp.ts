import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

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
      inputSchema: {
        type: z.enum(["income", "expense"]).optional().describe("Filter by type"),
        category: z.string().optional().describe("Filter by category (sale, interest, rental, food, wishes, car, loan, other)"),
        dateFrom: z.string().optional().describe("Start date YYYY-MM-DD"),
        dateTo: z.string().optional().describe("End date YYYY-MM-DD"),
      },
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
      inputSchema: {},
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
      inputSchema: {
        date: z.string().describe("Date in YYYY-MM-DD format"),
        name: z.string().describe("Transaction description"),
        amount: z.number().positive().describe("Amount as a positive number"),
        type: z.enum(["income", "expense"]).describe("Transaction type"),
        category: z.string().optional().describe("Category: sale, interest, rental, food, wishes, car, loan, other"),
        currency: z.string().optional().describe("3-letter currency code, e.g. CZK, USD, EUR"),
      },
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
      inputSchema: {
        id: z.number().int().describe("Transaction ID"),
        date: z.string().optional().describe("New date YYYY-MM-DD"),
        name: z.string().optional().describe("New description"),
        amount: z.number().positive().optional().describe("New amount (positive)"),
        type: z.enum(["income", "expense"]).optional(),
        category: z.string().optional(),
        currency: z.string().nullable().optional(),
      },
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
      inputSchema: { id: z.number().int().describe("Transaction ID") },
    },
    async ({ id }) => {
      await db.transaction.delete({ where: { id, user_id: userId } });
      return { content: [{ type: "text" as const, text: `Transaction ${id} deleted.` }] };
    },
  );

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const body = event.node.req.method === "POST" ? await readBody(event) : undefined;
  await transport.handleRequest(event.node.req, event.node.res, body);
});
