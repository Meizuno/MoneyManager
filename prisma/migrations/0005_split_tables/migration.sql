-- Rename sales_split_rules -> expense_categories
ALTER TABLE "sales_split_rules" RENAME TO "expense_categories";
ALTER INDEX "sales_split_rules_pkey" RENAME TO "expense_categories_pkey";
ALTER INDEX "sales_split_rules_user_id_idx" RENAME TO "expense_categories_user_id_idx";
ALTER SEQUENCE "sales_split_rules_id_seq" RENAME TO "expense_categories_id_seq";

-- Rename income_category_rules -> income_categories
ALTER TABLE "income_category_rules" RENAME TO "income_categories";
ALTER INDEX "income_category_rules_pkey" RENAME TO "income_categories_pkey";
ALTER INDEX "income_category_rules_user_id_idx" RENAME TO "income_categories_user_id_idx";
ALTER SEQUENCE "income_category_rules_id_seq" RENAME TO "income_categories_id_seq";

-- CreateTable incomes
CREATE TABLE "incomes" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT,
    "category" INTEGER NOT NULL DEFAULT 0,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "incomes_date_idx" ON "incomes"("date");
CREATE INDEX "incomes_category_idx" ON "incomes"("category");
CREATE INDEX "incomes_user_id_idx" ON "incomes"("user_id");

-- CreateTable expenses
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT,
    "category" INTEGER NOT NULL DEFAULT 0,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expenses_date_idx" ON "expenses"("date");
CREATE INDEX "expenses_category_idx" ON "expenses"("category");
CREATE INDEX "expenses_user_id_idx" ON "expenses"("user_id");

-- Migrate data from transactions
INSERT INTO "incomes" ("date", "name", "amount", "currency", "category", "user_id", "created_at")
SELECT "date", "name", "amount", "currency", "category", "user_id", "created_at"
FROM "transactions"
WHERE "type" = 'income';

INSERT INTO "expenses" ("date", "name", "amount", "currency", "category", "user_id", "created_at")
SELECT "date", "name", "amount", "currency", "category", "user_id", "created_at"
FROM "transactions"
WHERE "type" != 'income';

-- Drop old table
DROP INDEX "transactions_date_idx";
DROP INDEX "transactions_type_idx";
DROP INDEX "transactions_category_idx";
DROP INDEX "transactions_user_id_idx";
DROP TABLE "transactions";
