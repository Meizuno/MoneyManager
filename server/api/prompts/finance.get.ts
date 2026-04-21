export default defineEventHandler(async (event) => {
  const userId = getPromptUserId(event)
  const db = getPrisma()

  const query = getQuery(event)
  const now = new Date()
  const month = query.month !== undefined ? parseInt(query.month as string) : now.getMonth() + 1
  const year = query.year ? parseInt(query.year as string) : now.getFullYear()
  const isFullYear = month === 0

  const dateFrom = isFullYear ? new Date(`${year}-01-01`) : new Date(`${year}-${String(month).padStart(2, '0')}-01`)
  const dateTo = isFullYear ? new Date(`${year}-12-31`) : new Date(year, month, 0)

  const [expenses, incomes, expenseCategories, incomeCategories] = await Promise.all([
    db.expense.findMany({
      where: { user_id: userId, date: { gte: dateFrom, lte: dateTo } },
      orderBy: { date: 'desc' }
    }),
    db.income.findMany({
      where: { user_id: userId, date: { gte: dateFrom, lte: dateTo } },
      orderBy: { date: 'desc' }
    }),
    db.expenseCategory.findMany({ where: { user_id: userId }, orderBy: { position: 'asc' } }),
    db.incomeCategory.findMany({ where: { user_id: userId }, orderBy: { position: 'asc' } })
  ])

  return {
    expenses: expenses.map(e => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      name: e.name,
      amount: Number(e.amount),
      currency: e.currency ?? 'CZK',
      category: e.category
    })),
    incomes: incomes.map(i => ({
      id: i.id,
      date: i.date.toISOString().slice(0, 10),
      name: i.name,
      amount: Number(i.amount),
      currency: i.currency ?? 'CZK',
      category: i.category
    })),
    expenseCategories: expenseCategories.map(c => ({
      id: c.id,
      label: c.label,
      color: c.color,
      percent: Number(c.percent),
      position: c.position
    })),
    incomeCategories: incomeCategories.map(c => ({
      id: c.id,
      label: c.label,
      color: c.color,
      position: c.position
    }))
  }
})
