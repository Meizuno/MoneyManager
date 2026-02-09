import { readBody } from "h3";
import { getDb } from "../../utils/db";
import { requireAuthUser } from "../../utils/auth";
import { normalizeTransactionInput } from "../../utils/transactions";

export default defineEventHandler(async (event) => {
  await requireAuthUser(event);
  const body = await readBody(event);
  const input = normalizeTransactionInput(body ?? {});
  const db = getDb(event);

  await db
    .prepare(
      "INSERT INTO transactions (date, description, amount, currency, type, category) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      input.date,
      input.description,
      input.amount,
      input.currency,
      input.type,
      input.category,
    )
    .run();

  const inserted = await db
    .prepare(
      "SELECT id, date, description, amount, currency, type, category, created_at FROM transactions WHERE id = last_insert_rowid()",
    )
    .all();

  return {
    item: inserted.results[0],
  };
});
