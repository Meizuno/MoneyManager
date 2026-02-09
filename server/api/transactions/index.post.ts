import { readBody } from "h3";
import { getPrisma } from "../../utils/db";
import { requireAuthUser } from "../../utils/auth";
import { normalizeTransactionInput } from "../../utils/transactions";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);
  const input = normalizeTransactionInput(body ?? {});
  const prisma = getPrisma();
  const inserted = await prisma.transaction.create({
    data: {
      date: new Date(input.date),
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      type: input.type,
      category: input.category,
      user_id: user.id,
    },
  });

  return {
    item: {
      id: inserted.id,
      date: inserted.date.toISOString().slice(0, 10),
      description: inserted.description,
      amount: Number(inserted.amount),
      currency: inserted.currency,
      type: inserted.type,
      category: inserted.category,
      created_at: inserted.created_at.toISOString(),
    },
  };
});
