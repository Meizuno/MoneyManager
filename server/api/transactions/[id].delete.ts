import { createError, getRouterParam } from "h3";
import { getPrisma } from "../../utils/db";
import { requireAuthUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const id = getRouterParam(event, "id");
  const prisma = getPrisma();
  const existing = await prisma.transaction.findFirst({
    where: { id: Number(id), user_id: user.id },
  });
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Transaction not found." });
  }
  await prisma.transaction.delete({ where: { id: Number(id) } });

  return {
    ok: true,
  };
});
