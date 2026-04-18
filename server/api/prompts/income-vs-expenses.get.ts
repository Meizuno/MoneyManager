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

  const [expenseTx, incomeTx, expenseCategories, incomeCategories] = await Promise.all([
    db.expense.findMany({ where: { user_id: userId, date: { gte: dateFrom, lte: dateTo } } }),
    db.income.findMany({ where: { user_id: userId, date: { gte: dateFrom, lte: dateTo } } }),
    db.expenseCategory.findMany({ where: { user_id: userId }, orderBy: { position: 'asc' } }),
    db.incomeCategory.findMany({ where: { user_id: userId }, orderBy: { position: 'asc' } })
  ])

  // --- Income ---
  const incCatById = new Map(incomeCategories.map(c => [c.id, c]))
  const incomeColorMap = new Map(incomeCategories.map(c => [c.label, TAILWIND_COLORS[c.color] ?? '#94a3b8']))

  const incomeMap = new Map<string, number>()
  const incomeTxByLabel = new Map<string, typeof incomeTx>()
  for (const tx of incomeTx) {
    if (tx.currency && tx.currency !== 'CZK') continue
    const cat = incCatById.get(Number(tx.category))
    const label = cat?.label ?? 'Other'
    incomeMap.set(label, (incomeMap.get(label) ?? 0) + Number(tx.amount))
    const list = incomeTxByLabel.get(label) ?? []
    list.push(tx)
    incomeTxByLabel.set(label, list)
  }

  const totalIncome = [...incomeMap.values()].reduce((s, v) => s + Math.round(v * 100), 0) / 100

  const incomeLegend = [...incomeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({
      label,
      value: Math.round(amount * 100) / 100,
      percent: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0,
      color: incomeColorMap.get(label) ?? '#94a3b8',
      transactions: (incomeTxByLabel.get(label) ?? []).map(tx => ({ id: tx.id, date: tx.date, name: tx.name, amount: Number(tx.amount) }))
    }))

  // --- Expenses ---
  const expCatById = new Map(expenseCategories.map(r => [r.id, r]))
  const expenseColorMap = new Map(expenseCategories.map(r => [r.label, TAILWIND_COLORS[r.color] ?? '#94a3b8']))

  const salaryMap = new Map(expenseCategories.map(c => [
    c.label,
    Math.round(totalIncome * Number(c.percent)) / 100
  ]))

  const expenseMap = new Map<string, number>()
  const expenseTxByLabel = new Map<string, typeof expenseTx>()
  for (const tx of expenseTx) {
    if (tx.currency && tx.currency !== 'CZK') continue
    const cat = expCatById.get(Number(tx.category))
    const label = cat?.label ?? 'Other'
    expenseMap.set(label, (expenseMap.get(label) ?? 0) + Number(tx.amount))
    const list = expenseTxByLabel.get(label) ?? []
    list.push(tx)
    expenseTxByLabel.set(label, list)
  }

  const expenseLabels = [...salaryMap.keys()].sort((a, b) => (salaryMap.get(b) ?? 0) - (salaryMap.get(a) ?? 0))
  const allocated = expenseLabels.map(l => Math.round((salaryMap.get(l) ?? 0) * 100) / 100)
  const spent = expenseLabels.map(l => Math.round((expenseMap.get(l) ?? 0) * 100) / 100)
  const percentSpent = expenseLabels.map((_, i) => allocated[i] > 0 ? Math.round((spent[i] / allocated[i]) * 100) : 0)

  const totalAllocated = allocated.reduce((s, v) => s + Math.round(v * 100), 0) / 100
  const totalSpent = spent.reduce((s, v) => s + Math.round(v * 100), 0) / 100
  const totalPercent = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0

  const expenseCategoryColors = expenseLabels.map(l => expenseColorMap.get(l) ?? '#94a3b8')

  const expenseLegend = expenseLabels.map((l, i) => ({
    label: l,
    value: spent[i],
    percent: percentSpent[i],
    color: expenseCategoryColors[i],
    transactions: (expenseTxByLabel.get(l) ?? []).map(tx => ({ id: tx.id, date: tx.date, name: tx.name, amount: Number(tx.amount) }))
  }))

  return {
    title: `Income vs Expenses — ${periodLabel}`,
    subtitle: `Income: ${totalIncome.toFixed(2)} CZK | Spent: ${totalSpent.toFixed(2)} / ${totalAllocated.toFixed(2)} CZK (${totalPercent}%)`,
    navigation: { route: '/api/prompts/income-vs-expenses', month, year },
    type: 'bar',
    labels: expenseLabels.map((l, i) => `${l} (${percentSpent[i]}%)`),
    datasets: [
      { label: 'Allocated (CZK)', data: allocated, backgroundColor: expenseCategoryColors.map(c => `${c}80`) },
      { label: 'Spent (CZK)', data: spent, backgroundColor: expenseCategoryColors }
    ],
    legendGroups: [
      { label: 'Expenses', items: expenseLegend },
      { label: 'Income', items: incomeLegend }
    ]
  }
})
