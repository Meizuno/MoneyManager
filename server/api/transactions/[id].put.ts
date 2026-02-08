import { getRouterParam, readBody } from "h3";
import { getDb } from "../../utils/db";
import { normalizeTransactionInput } from "../../utils/transactions";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  const input = normalizeTransactionInput(body ?? {});
  const db = getDb(event);

  await db
    .prepare(
      "UPDATE transactions SET date = ?, description = ?, amount = ?, currency = ?, type = ?, category = ? WHERE id = ?",
    )
    .bind(
      input.date,
      input.description,
      input.amount,
      input.currency,
      input.type,
      input.category,
      id,
    )
    .run();

  const updated = await db
    .prepare(
      "SELECT id, date, description, amount, currency, type, category, created_at FROM transactions WHERE id = ?",
    )
    .bind(id)
    .all();

  return {
    item: updated.results[0],
  };
});
