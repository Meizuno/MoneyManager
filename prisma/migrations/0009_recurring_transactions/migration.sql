-- Recurring transactions: rules that write an income or an expense every
-- N days, weeks, months or years, and the link from each row they write.

CREATE TABLE "recurring_transactions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT,
    "category" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "every" INTEGER NOT NULL DEFAULT 1,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "next_date" TIMESTAMP(3) NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recurring_transactions_user_id_idx" ON "recurring_transactions"("user_id");
CREATE INDEX "recurring_transactions_next_date_idx" ON "recurring_transactions"("next_date");

-- Each occurrence is written once: (recurring_id, date) is unique, and rows
-- written by hand (recurring_id NULL) are not constrained by it.
ALTER TABLE "incomes" ADD COLUMN "recurring_id" INTEGER;
ALTER TABLE "expenses" ADD COLUMN "recurring_id" INTEGER;
CREATE UNIQUE INDEX "incomes_recurring_id_date_key" ON "incomes"("recurring_id", "date");
CREATE UNIQUE INDEX "expenses_recurring_id_date_key" ON "expenses"("recurring_id", "date");
