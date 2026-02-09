import { createError, getRouterParam, readBody } from "h3";
import { getPrisma } from "../../utils/db";
import { requireAuthUser } from "../../utils/auth";
import { normalizeTransactionInput } from "../../utils/transactions";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const id = getRouterParam(event, "id");
  const body = await readBody(event);
  const input = normalizeTransactionInput(body ?? {});
  const prisma = getPrisma();
  const existing = await prisma.transaction.findFirst({
    where: { id: Number(id), user_id: user.id },
  });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Transaction not found." });
  }
  const updated = await prisma.transaction.update({
    where: { id: Number(id) },
    data: {
      date: new Date(input.date),
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      type: input.type,
      category: input.category,
    },
  });

  return {
    item: {
      id: updated.id,
      date: updated.date.toISOString().slice(0, 10),
      description: updated.description,
      amount: Number(updated.amount),
      currency: updated.currency,
      type: updated.type,
      category: updated.category,
      created_at: updated.created_at.toISOString(),
    },
  };
});
