import { nextColor } from "../../utils/salesSplitColors";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);

  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!label) throw createError({ statusCode: 400, statusMessage: "label is required" });

  const prisma = getPrisma();
  const count = await prisma.incomeCategoryRule.count({ where: { user_id: user.id } });

  const category = await prisma.incomeCategoryRule.create({
    data: { user_id: user.id, label, color: nextColor(count), position: count },
  });
  return category;
});
