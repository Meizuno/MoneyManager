-- Replace the single-column indexes on the transaction tables with
-- composites that match the scoped queries: reads always filter by
-- user_id first, then a date range (list/summary) or a category id (the
-- in-use-on-delete guard). A (user_id, …) index also covers plain
-- user_id lookups, so the old per-column indexes are dropped.

-- incomes
DROP INDEX "incomes_date_idx";
DROP INDEX "incomes_category_idx";
DROP INDEX "incomes_user_id_idx";
CREATE INDEX "incomes_user_id_date_idx" ON "incomes"("user_id", "date");
CREATE INDEX "incomes_user_id_category_idx" ON "incomes"("user_id", "category");

-- expenses
DROP INDEX "expenses_date_idx";
DROP INDEX "expenses_category_idx";
DROP INDEX "expenses_user_id_idx";
CREATE INDEX "expenses_user_id_date_idx" ON "expenses"("user_id", "date");
CREATE INDEX "expenses_user_id_category_idx" ON "expenses"("user_id", "category");
