import { nextColor } from "../../utils/salesSplitColors";

export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  const body = await readBody(event);

  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const percent = Number(body?.percent ?? 10);
  if (!label) throw createError({ statusCode: 400, statusMessage: "label is required" });
  if (isNaN(percent) || percent < 0 || percent > 100)
    throw createError({ statusCode: 400, statusMessage: "percent must be 0–100" });

  const prisma = getPrisma();
  const count = await prisma.salesSplitRule.count({ where: { user_id: user.id } });
  const color = nextColor(count);

  const rule = await prisma.salesSplitRule.create({
    data: { user_id: user.id, label, percent, color, position: count },
  });
  return rule;
});
