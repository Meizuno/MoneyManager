import { createError, getRouterParam, readBody } from "h3";
import { getPrisma } from "../../utils/db";
import { requireAuthUser } from "../../utils/auth";
import { normalizeTransactionInput } from "../../utils/transactions";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const id = Number(getRouterParam(event, "id"));
  const body = await readBody(event);
  const input = normalizeTransactionInput(body ?? {});
  const prisma = getPrisma();

  const existingIncome = await prisma.income.findFirst({ where: { id, user_id: user.id } });
  const existingExpense = !existingIncome
    ? await prisma.expense.findFirst({ where: { id, user_id: user.id } })
    : null;

  if (!existingIncome && !existingExpense) {
    throw createError({ statusCode: 404, statusMessage: "Transaction not found." });
  }

  const currentType = existingIncome ? "income" : "expense";
  const newType = input.type;

  const updateData = {
    date: new Date(input.date),
    name: input.name,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
  };

  // If type changed, move between tables
  if (currentType !== newType) {
    if (currentType === "income") {
      await prisma.income.delete({ where: { id } });
      const inserted = await prisma.expense.create({ data: { ...updateData, user_id: user.id } });
      return {
        item: {
          id: inserted.id,
          date: inserted.date.toISOString().slice(0, 10),
          name: inserted.name,
          amount: Number(inserted.amount),
          currency: inserted.currency,
          type: "expense",
          category: String(inserted.category),
          created_at: inserted.created_at.toISOString(),
        },
      };
    } else {
      await prisma.expense.delete({ where: { id } });
      const inserted = await prisma.income.create({ data: { ...updateData, user_id: user.id } });
      return {
        item: {
          id: inserted.id,
          date: inserted.date.toISOString().slice(0, 10),
          name: inserted.name,
          amount: Number(inserted.amount),
          currency: inserted.currency,
          type: "income",
          category: String(inserted.category),
          created_at: inserted.created_at.toISOString(),
        },
      };
    }
  }

  // Same type, update in place
  const updated = currentType === "income"
    ? await prisma.income.update({ where: { id }, data: updateData })
    : await prisma.expense.update({ where: { id }, data: updateData });

  return {
    item: {
      id: updated.id,
      date: updated.date.toISOString().slice(0, 10),
      name: updated.name,
      amount: Number(updated.amount),
      currency: updated.currency,
      type: newType,
      category: String(updated.category),
      created_at: updated.created_at.toISOString(),
    },
  };
});
