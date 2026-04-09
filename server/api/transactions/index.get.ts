import { getQuery } from "h3";

type Row = { id: number; date: Date; name: string; amount: object; currency: string | null; category: number; created_at: Date; type: string };

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event);
  if (!user) {
    return { items: [] };
  }

  const query = getQuery(event);
  const rawCategory = typeof query.category === "string" ? query.category.trim() : "";
  const parsedCategory =
    rawCategory && rawCategory !== "all" && /^\d+$/.test(rawCategory)
      ? Number(rawCategory)
      : null;
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

  const where = {
    user_id: user.id,
    ...(parsedCategory !== null ? { category: parsedCategory } : {}),
    ...((dateFromParsed || dateToParsed) && {
      date: {
        ...(dateFromParsed ? { gte: dateFromParsed } : {}),
        ...(dateToParsed ? { lte: dateToParsed } : {}),
      },
    }),
  };
  const orderBy = [{ date: "desc" as const }, { id: "desc" as const }];

  let rows: Row[];

  if (type === "income") {
    rows = (await prisma.income.findMany({ where, orderBy })).map((i) => ({ ...i, type: "income" }));
  } else if (type === "expense") {
    rows = (await prisma.expense.findMany({ where, orderBy })).map((e) => ({ ...e, type: "expense" }));
  } else {
    const [incomes, expenses] = await Promise.all([
      prisma.income.findMany({ where, orderBy }),
      prisma.expense.findMany({ where, orderBy }),
    ]);
    rows = [
      ...incomes.map((i) => ({ ...i, type: "income" })),
      ...expenses.map((e) => ({ ...e, type: "expense" })),
    ].sort((a, b) => {
      const dateDiff = b.date.getTime() - a.date.getTime();
      return dateDiff !== 0 ? dateDiff : b.id - a.id;
    });
  }

  return {
    items: rows.map((item) => ({
      id: item.id,
      date: item.date.toISOString().slice(0, 10),
      name: item.name,
      amount: Number(item.amount),
      currency: item.currency,
      type: item.type,
      category: String(item.category),
      created_at: item.created_at.toISOString(),
    })),
  };
});
