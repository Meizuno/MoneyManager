ALTER TABLE "transactions"
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "category" TYPE INTEGER
  USING (
    CASE
      WHEN BTRIM("category") ~ '^[0-9]+$' THEN BTRIM("category")::INTEGER
      ELSE 0
    END
  ),
  ALTER COLUMN "category" SET DEFAULT 0;
