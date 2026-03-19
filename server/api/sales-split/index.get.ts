export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const prisma = getPrisma();
  const record = await prisma.salesSplit.findUnique({
    where: { user_id: user.id },
  });

  return { rules: record?.rules ?? [] };
});
