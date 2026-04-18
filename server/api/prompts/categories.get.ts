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
  const periodLabel = isFullYear ? String(year) : new Date(year, month - 1).toLocaleString('en', { month: 'long', year: 'numeric' })

  const [expenseCategories, incomeCategories, incomeTx] = await Promise.all([
    db.expenseCategory.findMany({ where: { user_id: userId }, orderBy: { position: 'asc' } }),
    db.incomeCategory.findMany({ where: { user_id: userId }, orderBy: { position: 'asc' } }),
    db.income.findMany({ where: { user_id: userId, date: { gte: dateFrom, lte: dateTo } } })
  ])

  const incCatById = new Map(incomeCategories.map(c => [c.id, c]))
  const incomeByCategory = new Map<string, number>()
  for (const tx of incomeTx) {
    if (tx.currency && tx.currency !== 'CZK') continue
    const cat = incCatById.get(Number(tx.category))
    const label = cat?.label ?? 'Other'
    incomeByCategory.set(label, (incomeByCategory.get(label) ?? 0) + Number(tx.amount))
  }

  const totalIncome = [...incomeByCategory.values()].reduce((s, v) => s + Math.round(v * 100), 0) / 100
  const totalPercent = expenseCategories.reduce((s, r) => s + Number(r.percent), 0)

  return {
    component: 'categories',
    navigation: { route: '/api/prompts/categories', month, year },
    periodLabel,
    totalIncome,
    totalPercent,
    expense: expenseCategories
      .sort((a, b) => Number(b.percent) - Number(a.percent))
      .map(c => ({
        id: c.id, label: c.label, color: c.color,
        percent: Number(c.percent),
        amount: Math.round(totalIncome * Number(c.percent)) / 100
      })),
    income: incomeCategories
      .sort((a, b) => a.position - b.position)
      .map(c => ({
        id: c.id, label: c.label, color: c.color,
        amount: Math.round((incomeByCategory.get(c.label) ?? 0) * 100) / 100
      }))
  }
})
