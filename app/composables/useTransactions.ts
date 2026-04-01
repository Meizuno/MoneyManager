export const useTransactions = () => {
  const { t } = useI18n();
  const { isGuest, loadGuestTransactions, saveGuestTransactions } = useGuest();

  const transactions = useState<Transaction[]>("transactions", () => []);
  const loading = useState<boolean>("transactions_loading", () => false);
  const errorMessage = useState<string>("transactions_error", () => "");
  const statusMessage = useState<string>("transactions_status", () => "");
  const filterCategory = useState<string>("transactions_filter", () => "all");
  const filterType = useState<string>("transactions_filter_type", () => "all");
  const filterDateFrom = useState<string>("transactions_filter_date_from", () => "");
  const filterDateTo = useState<string>("transactions_filter_date_to", () => "");
  const filterDatePreset = useState<string>("transactions_filter_date_preset", () => "all");

  const typeIconMap: Record<string, string> = {
    income: "i-heroicons-arrow-trending-up",
    expense: "i-heroicons-arrow-trending-down",
  };

  const categoryIconMap: Record<string, string> = {
    sale: "i-heroicons-tag",
    interest: "i-heroicons-chart-bar",
    rental: "i-heroicons-home",
    food: "i-heroicons-cake",
    wishes: "i-heroicons-heart",
    car: "i-heroicons-truck",
    loan: "i-heroicons-credit-card",
    other: "i-heroicons-ellipsis-horizontal",
  };

  const typeValues = ["income", "expense"];

  const categoryValuesByType: Record<string, string[]> = {
    income: ["sale", "interest", "other"],
    expense: ["rental", "food", "wishes", "car", "loan", "other"],
  };

  const typeOptions = computed(() =>
    typeValues.map((v) => ({ label: t(`types.${v}`), value: v, icon: typeIconMap[v] }))
  );

  const splitRules = useState<{ id: number; label: string; color: string }[]>("split_rules", () => []);
  const incomeCategories = useState<{ id: number; label: string; color: string }[]>("income_categories", () => []);

  const MANAGE_CATEGORIES_VALUE = "__manage_categories__";

  const getCategoryOptions = (type: string) => {
    if (type === "expense") {
      return [
        ...splitRules.value.map((r) => ({
          label: r.label,
          value: String(r.id),
          chip: { color: r.color },
        })),
        { label: t("form.manageCategories"), value: MANAGE_CATEGORIES_VALUE, icon: "i-heroicons-cog-6-tooth" },
      ];
    }
    if (type === "income") {
      return [
        ...incomeCategories.value.map((r) => ({
          label: r.label,
          value: String(r.id),
          chip: { color: r.color },
        })),
        { label: t("form.manageCategories"), value: MANAGE_CATEGORIES_VALUE, icon: "i-heroicons-cog-6-tooth" },
      ];
    }
    const values = categoryValuesByType[type] ?? categoryValuesByType.income;
    return values.map((v) => ({ label: t(`categories.${v}`), value: v, icon: categoryIconMap[v] }));
  };

  const categories = computed(() => {
    const set = new Set<string>();
    transactions.value.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [
      { label: t("types.all"), value: "all" },
      ...list.map((v) => ({
        label: splitRules.value.find((r) => String(r.id) === v)?.label
          ?? incomeCategories.value.find((r) => String(r.id) === v)?.label
          ?? t(`categories.${v}`) ?? v,
        value: v,
        icon: categoryIconMap[v] ?? "i-heroicons-chart-pie",
      })),
    ];
  });

  const types = computed(() => [
    { label: t("types.all"), value: "all" },
    ...typeValues.map((v) => ({ label: t(`types.${v}`), value: v, icon: typeIconMap[v] })),
  ]);

  const datePresetOptions = computed(() => [
    { label: t("datePresets.all"), value: "all" },
    { label: t("datePresets.thisMonth"), value: "this-month" },
    { label: t("datePresets.prevMonth"), value: "previous-month" },
    { label: t("datePresets.thisYear"), value: "this-year" },
    { label: t("datePresets.custom"), value: "custom" },
  ]);

  const totals = computed(() => {
    let income = 0;
    let expenses = 0;
    transactions.value.forEach((item) => {
      const abs = Math.abs(item.amount ?? 0);
      if (item.type === "income") {
        income += abs;
      } else {
        expenses += abs;
      }
    });
    return {
      income,
      expenses,
      net: income - expenses,
    };
  });

  const categoryTotals = computed(() => {
    const map = new Map<string, number>();
    transactions.value.forEach((item) => {
      const key = item.category || "other";
      const abs = Math.abs(item.amount ?? 0);
      const signed = item.type === "income" ? abs : -abs;
      map.set(key, (map.get(key) ?? 0) + signed);
    });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  });

  const maxCategoryTotal = computed(() => {
    return categoryTotals.value.reduce(
      (max, item) => Math.max(max, Math.abs(item.total)),
      1,
    );
  });

  const formatAmount = (amount: number, currency?: string | null) => {
    const normalizedCurrency =
      currency && currency.length === 3 ? currency.toUpperCase() : "CZK";
    if (normalizedCurrency && normalizedCurrency.length === 3) {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: normalizedCurrency,
        }).format(amount);
      } catch {
        // Fall back to number formatting when currency code is unknown.
      }
    }
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const resetMessages = () => {
    errorMessage.value = "";
    statusMessage.value = "";
  };

  const { apiFetch } = useAuth();

  const nextGuestId = () => {
    const items = loadGuestTransactions();
    return items.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  };

  const normalizeTypeFilter = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return "all";
    if (normalized === "outcome") return "expense";
    return normalized;
  };

  const normalizedFilterType = computed(() => normalizeTypeFilter(filterType.value));

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const applyDatePreset = (preset: string) => {
    const today = new Date();
    if (preset === "all") {
      filterDateFrom.value = "";
      filterDateTo.value = "";
      return;
    }
    if (preset === "this-month") {
      filterDateFrom.value = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
      filterDateTo.value = formatDate(today);
      return;
    }
    if (preset === "previous-month") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      filterDateFrom.value = formatDate(start);
      filterDateTo.value = formatDate(end);
      return;
    }
    if (preset === "this-year") {
      filterDateFrom.value = formatDate(new Date(today.getFullYear(), 0, 1));
      filterDateTo.value = formatDate(today);
      return;
    }
  };

  watch(
    filterDatePreset,
    (value) => {
      applyDatePreset(value);
    },
    { immediate: true },
  );

  const loadSplitRules = async () => {
    if (isGuest.value) {
      try {
        const stored = localStorage.getItem("mm_guest_splits");
        splitRules.value = stored ? JSON.parse(stored) : [];
      } catch { splitRules.value = []; }
      return;
    }
    try {
      const data = await apiFetch<{ rules: { id: number; label: string; color: string }[] }>("/api/sales-split");
      splitRules.value = data.rules ?? [];
    } catch { splitRules.value = []; }
  };

  const loadIncomeCategories = async () => {
    if (isGuest.value) {
      try {
        const stored = localStorage.getItem("mm_guest_income_categories");
        incomeCategories.value = stored ? JSON.parse(stored) : [];
      } catch { incomeCategories.value = []; }
      return;
    }
    try {
      const data = await apiFetch<{ categories: { id: number; label: string; color: string }[] }>("/api/income-categories");
      incomeCategories.value = data.categories ?? [];
    } catch { incomeCategories.value = []; }
  };

  const loadTransactions = async (opts?: { force?: boolean; preserveStatus?: boolean }) => {
    if (!opts?.force && transactions.value.length > 0) return;
    loading.value = true;
    if (!opts?.preserveStatus) resetMessages(); else errorMessage.value = "";
    try {
      if (isGuest.value) {
        transactions.value = loadGuestTransactions();
      } else {
        const [data] = await Promise.all([
          apiFetch<{ items: Transaction[] }>("/api/transactions", {
            query: {
              category: filterCategory.value,
              type: normalizedFilterType.value,
              dateFrom: filterDateFrom.value || undefined,
              dateTo: filterDateTo.value || undefined,
            },
          }),
          splitRules.value.length === 0 ? loadSplitRules() : Promise.resolve(),
          incomeCategories.value.length === 0 ? loadIncomeCategories() : Promise.resolve(),
        ]);
        transactions.value = data.items ?? [];
      }
    } catch {
      errorMessage.value = "Unable to load transactions.";
    } finally {
      loading.value = false;
    }
  };

  const createTransaction = async (input: TransactionInput) => {
    resetMessages();
    try {
      if (isGuest.value) {
        const items = loadGuestTransactions();
        const now = new Date().toISOString();
        items.push({ ...input, id: nextGuestId(), created_at: now } as Transaction);
        saveGuestTransactions(items);
        transactions.value = items;
      } else {
        await apiFetch("/api/transactions", { method: "POST", body: input });
        await loadTransactions({ force: true, preserveStatus: true });
      }
      statusMessage.value = "Transaction added.";
      return true;
    } catch {
      errorMessage.value = "Unable to add transaction.";
      return false;
    }
  };

  const updateTransaction = async (id: number, input: TransactionInput) => {
    resetMessages();
    try {
      if (isGuest.value) {
        const items = loadGuestTransactions().map((t) =>
          t.id === id ? { ...t, ...input } : t
        );
        saveGuestTransactions(items);
        transactions.value = items;
      } else {
        await apiFetch(`/api/transactions/${id}`, { method: "PUT", body: input });
        await loadTransactions({ force: true, preserveStatus: true });
      }
      statusMessage.value = "Transaction updated.";
      return true;
    } catch {
      errorMessage.value = "Unable to update transaction.";
      return false;
    }
  };

  const deleteTransaction = async (id: number) => {
    resetMessages();
    try {
      if (isGuest.value) {
        const items = loadGuestTransactions().filter((t) => t.id !== id);
        saveGuestTransactions(items);
        transactions.value = items;
      } else {
        await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
        await loadTransactions({ force: true, preserveStatus: true });
      }
      statusMessage.value = "Transaction deleted.";
      return true;
    } catch {
      errorMessage.value = "Unable to delete transaction.";
      return false;
    }
  };

  return {
    MANAGE_CATEGORIES_VALUE,
    transactions,
    loading,
    errorMessage,
    statusMessage,
    filterCategory,
    filterType,
    filterDateFrom,
    filterDateTo,
    filterDatePreset,
    typeOptions,
    getCategoryOptions,
    splitRules,
    loadSplitRules,
    incomeCategories,
    loadIncomeCategories,
    categories,
    types,
    datePresetOptions,
    totals,
    categoryTotals,
    maxCategoryTotal,
    formatAmount,
    loadTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
};
