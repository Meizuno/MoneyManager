export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const id = Number(getRouterParam(event, "id"));
  if (!id) throw createError({ statusCode: 400, statusMessage: "invalid id" });

  const body = await readBody(event);
  const data: Record<string, unknown> = {};
  if (typeof body?.label === "string") data.label = body.label.trim();
  if (body?.percent !== undefined) {
    const p = Number(body.percent);
    if (isNaN(p) || p < 0 || p > 100)
      throw createError({ statusCode: 400, statusMessage: "percent must be 0–100" });
    data.percent = p;
  }
  if (!Object.keys(data).length)
    throw createError({ statusCode: 400, statusMessage: "nothing to update" });

  const prisma = getPrisma();
  const rule = await prisma.expenseCategory.updateMany({
    where: { id, user_id: user.id },
    data,
  });
  if (rule.count === 0) throw createError({ statusCode: 404, statusMessage: "not found" });
  return prisma.expenseCategory.findUnique({ where: { id } });
});
