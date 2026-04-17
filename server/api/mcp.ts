import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getHeader } from "h3";
import { registerTransactionTools } from "../utils/mcp/transactions";
import { registerExpenseCategoryTools } from "../utils/mcp/expense-categories";
import { registerIncomeCategoryTools } from "../utils/mcp/income-categories";

export default defineEventHandler(async (event) => {
  // Auth: API key + user ID header (from ai-chat) or user session (browser)
  const config = useRuntimeConfig();
  const apiKey = getHeader(event, "x-api-key");
  const headerUserId = getHeader(event, "x-user-id");

  let userId: string;

  if (config.mcpApiKey && apiKey === config.mcpApiKey && headerUserId) {
    userId = headerUserId;
  } else {
    const user = await requireAuthUser(event);
    userId = user.id;
  }

  const db = getPrisma();
  const server = new McpServer({ name: "money-manager", version: "1.0.0" });

  registerTransactionTools(server, db, userId);
  registerExpenseCategoryTools(server, db, userId);
  registerIncomeCategoryTools(server, db, userId);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);

  const body = event.node.req.method === "POST" ? await readBody(event) : undefined;
  await transport.handleRequest(event.node.req, event.node.res, body);
});
