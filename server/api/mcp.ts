import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTransactionTools } from "../utils/mcp/transactions";
import { registerExpenseCategoryTools } from "../utils/mcp/expense-categories";
import { registerIncomeCategoryTools } from "../utils/mcp/income-categories";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const db = getPrisma();

  const server = new McpServer({ name: "money-manager", version: "1.0.0" });

  registerTransactionTools(server, db, user.id);
  registerExpenseCategoryTools(server, db, user.id);
  registerIncomeCategoryTools(server, db, user.id);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const body = event.node.req.method === "POST" ? await readBody(event) : undefined;
  await transport.handleRequest(event.node.req, event.node.res, body);
});
