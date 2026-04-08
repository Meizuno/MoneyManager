ALTER TABLE "transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(10,2) USING ROUND(amount::numeric, 2);

ALTER TABLE "sales_split_rules"
  ALTER COLUMN "percent" TYPE DECIMAL(5,2) USING ROUND(percent::numeric, 2);
