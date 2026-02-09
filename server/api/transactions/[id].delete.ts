import { getRouterParam } from "h3";
import { getDb } from "../../utils/db";
import { requireAuthUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuthUser(event);
  const id = getRouterParam(event, "id");
  const db = getDb(event);

  await db.prepare("DELETE FROM transactions WHERE id = ?").bind(id).run();

  return {
    ok: true,
  };
});
