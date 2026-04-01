export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const id = Number(getRouterParam(event, "id"));
  if (!id) throw createError({ statusCode: 400, statusMessage: "invalid id" });

  const prisma = getPrisma();
  const deleted = await prisma.salesSplitRule.deleteMany({ where: { id, user_id: user.id } });
  if (deleted.count === 0) throw createError({ statusCode: 404, statusMessage: "not found" });
  return { ok: true };
});
