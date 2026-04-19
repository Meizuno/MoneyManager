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

  const [transactions, categories] = await Promise.all([
    db.expense.findMany({
      where: { user_id: userId, date: { gte: dateFrom, lte: dateTo } }
    }),
    db.expenseCategory.findMany({
      where: { user_id: userId },
      orderBy: { position: 'asc' }
    })
  ])

  const catById = new Map(categories.map(r => [r.id, r]))
  const colorMap = new Map(categories.map(r => [r.label, TAILWIND_COLORS[r.color] ?? '#94a3b8']))

  const totals = new Map<string, number>()
  const txByLabel = new Map<string, typeof transactions>()
  for (const tx of transactions) {
    if (tx.currency && tx.currency !== 'CZK') continue
    const cat = catById.get(Number(tx.category))
    const label = cat?.label ?? 'Other'
    totals.set(label, (totals.get(label) ?? 0) + Number(tx.amount))
    const list = txByLabel.get(label) ?? []
    list.push(tx)
    txByLabel.set(label, list)
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const total = sorted.reduce((s, [, v]) => s + v, 0)
  const colors = sorted.map(([label]) => colorMap.get(label) ?? '#94a3b8')

  return {
    title: `Expenses by category — ${periodLabel}`,
    navigation: { route: '/api/prompts/expense-chart', month, year },
    type: 'pie',
    labels: sorted.map(([label]) => label),
    datasets: [{
      label: 'Amount (CZK)',
      data: sorted.map(([, amount]) => Math.round(amount * 100) / 100),
      backgroundColor: colors
    }],
    legend: sorted.map(([label, amount], i) => ({
      label,
      value: Math.round(amount * 100) / 100,
      percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      color: colors[i],
      transactions: (txByLabel.get(label) ?? []).sort((a, b) => b.date.getTime() - a.date.getTime()).map(tx => ({ id: tx.id, date: tx.date.toISOString().slice(0, 10), name: tx.name, amount: Number(tx.amount) }))
    }))
  }
})
