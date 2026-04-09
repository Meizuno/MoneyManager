import { createError, getRouterParam } from "h3";
import { getPrisma } from "../../utils/db";
import { requireAuthUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const id = Number(getRouterParam(event, "id"));
  const prisma = getPrisma();

  const deletedIncome = await prisma.income.deleteMany({ where: { id, user_id: user.id } });
  if (deletedIncome.count > 0) return { ok: true };

  const deletedExpense = await prisma.expense.deleteMany({ where: { id, user_id: user.id } });
  if (deletedExpense.count > 0) return { ok: true };

  throw createError({ statusCode: 404, statusMessage: "Transaction not found." });
});
