import { getQuery } from "h3";

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event);
  if (!user) {
    return { items: [] };
  }

  const query = getQuery(event);
  const category = typeof query.category === "string" ? query.category.trim() : "";
  const type = typeof query.type === "string" ? query.type.trim().toLowerCase() : "";
  const dateFrom = typeof query.dateFrom === "string" ? query.dateFrom.trim() : "";
  const dateTo = typeof query.dateTo === "string" ? query.dateTo.trim() : "";

  const prisma = getPrisma();
  const parseDate = (value: string, endOfDay: boolean) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const parsed = new Date(`${value}${suffix}`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };
  const dateFromParsed = parseDate(dateFrom, false);
  const dateToParsed = parseDate(dateTo, true);
  const result = await prisma.transaction.findMany({
    where: {
      user_id: user.id,
      ...(category && category !== "all" ? { category } : {}),
      ...((dateFromParsed || dateToParsed) && {
        date: {
          ...(dateFromParsed ? { gte: dateFromParsed } : {}),
          ...(dateToParsed ? { lte: dateToParsed } : {}),
        },
      }),
      type: type
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  return {
    items: result.map((item) => ({
      id: item.id,
      date: item.date.toISOString().slice(0, 10),
      name: item.name,
      amount: Number(item.amount),
      currency: item.currency,
      type: item.type,
      category: item.category,
      created_at: item.created_at.toISOString(),
    })),
  };
});
