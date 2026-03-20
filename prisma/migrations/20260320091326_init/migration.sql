/*
  Warnings:

  - You are about to alter the column `rules` on the `sales_splits` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sales_splits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "rules" JSONB NOT NULL DEFAULT [],
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sales_splits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sales_splits" ("id", "rules", "updated_at", "user_id") SELECT "id", "rules", "updated_at", "user_id" FROM "sales_splits";
DROP TABLE "sales_splits";
ALTER TABLE "new_sales_splits" RENAME TO "sales_splits";
CREATE UNIQUE INDEX "sales_splits_user_id_key" ON "sales_splits"("user_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
