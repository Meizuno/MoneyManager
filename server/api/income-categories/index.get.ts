export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const prisma = getPrisma();
  const categories = await prisma.incomeCategoryRule.findMany({
    where: { user_id: user.id },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });
  return { categories };
});
