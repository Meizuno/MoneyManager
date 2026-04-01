CREATE TABLE "income_category_rules" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "income_category_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "income_category_rules_user_id_idx" ON "income_category_rules"("user_id");
