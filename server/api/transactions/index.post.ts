import { readBody } from "h3";
import { getPrisma } from "../../utils/db";
import { requireAuthUser } from "../../utils/auth";
import { normalizeTransactionInput } from "../../utils/transactions";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);
  const input = normalizeTransactionInput(body ?? {});
  const prisma = getPrisma();

  const data = {
    date: new Date(input.date),
    name: input.name,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
    user_id: user.id,
  };

  const inserted = input.type === "income"
    ? await prisma.income.create({ data })
    : await prisma.expense.create({ data });

  return {
    item: {
      id: inserted.id,
      date: inserted.date.toISOString().slice(0, 10),
      name: inserted.name,
      amount: Number(inserted.amount),
      currency: inserted.currency,
      type: input.type,
      category: String(inserted.category),
      created_at: inserted.created_at.toISOString(),
    },
  };
});
