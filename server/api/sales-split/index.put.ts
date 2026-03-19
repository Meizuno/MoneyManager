export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody(event);
  if (!Array.isArray(body?.rules)) {
    throw createError({ statusCode: 400, statusMessage: "rules must be an array" });
  }

  const prisma = getPrisma();
  const record = await prisma.salesSplit.upsert({
    where: { user_id: user.id },
    update: { rules: body.rules },
    create: { user_id: user.id, rules: body.rules },
  });

  return { rules: record.rules };
});
