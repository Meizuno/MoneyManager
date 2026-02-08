import { getQuery } from "h3";
import { getDb } from "../../utils/db";

export default defineEventHandler(async (event) => {
  const db = getDb(event);
  const query = getQuery(event);
  const category = typeof query.category === "string" ? query.category.trim() : "";

  let sql =
    "SELECT id, date, description, amount, currency, type, category, created_at FROM transactions";
  const params: unknown[] = [];

  if (category && category !== "all") {
    sql += " WHERE category = ?";
    params.push(category);
  }

  sql += " ORDER BY date DESC, id DESC";

  const result = await (params.length > 0
    ? db.prepare(sql).bind(...params).all()
    : db.prepare(sql).all());

  return {
    items: result.results,
  };
});
