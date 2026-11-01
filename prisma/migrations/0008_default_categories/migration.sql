-- A default category per kind: what a transaction created without a
-- category falls back to when nothing of the same name came before.
ALTER TABLE "expense_categories" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "income_categories" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;
