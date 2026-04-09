export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const id = Number(getRouterParam(event, "id"));
  if (!id) throw createError({ statusCode: 400, statusMessage: "invalid id" });

  const body = await readBody(event);
  const data: Record<string, unknown> = {};
  if (typeof body?.label === "string") data.label = body.label.trim();
  if (!Object.keys(data).length)
    throw createError({ statusCode: 400, statusMessage: "nothing to update" });

  const prisma = getPrisma();
  const result = await prisma.incomeCategory.updateMany({
    where: { id, user_id: user.id },
    data,
  });
  if (result.count === 0) throw createError({ statusCode: 404, statusMessage: "not found" });
  return prisma.incomeCategory.findUnique({ where: { id } });
});
