export const useTransactions = () => {
  const { t } = useI18n();

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

  const getCategoryOptions = (type: string) => {
    const values = categoryValuesByType[type] ?? categoryValuesByType.expense;
    return values.map((v) => ({ label: t(`categories.${v}`), value: v, icon: categoryIconMap[v] }));
  };

  const categories = computed(() => {
    const set = new Set<string>(["other"]);
    transactions.value.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [
      { label: t("types.all"), value: "all" },
      ...list.map((v) => ({ label: t(`categories.${v}`) ?? v, value: v, icon: categoryIconMap[v] })),
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

  const loadTransactions = async (opts?: { force?: boolean; preserveStatus?: boolean }) => {
    if (!opts?.force && transactions.value.length > 0) {
      return;
    }
    loading.value = true;
    if (!opts?.preserveStatus) {
      resetMessages();
    } else {
      errorMessage.value = "";
    }
    try {
      const data = await apiFetch<{ items: Transaction[] }>("/api/transactions", {
        query: {
          category: filterCategory.value,
          type: normalizedFilterType.value,
          dateFrom: filterDateFrom.value || undefined,
          dateTo: filterDateTo.value || undefined,
        },
      });
      transactions.value = data.items ?? [];
    } catch (error) {
      errorMessage.value = "Unable to load transactions.";
    } finally {
      loading.value = false;
    }
  };

  const createTransaction = async (input: TransactionInput) => {
    resetMessages();
    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        body: input,
      });
      statusMessage.value = "Transaction added.";
      await loadTransactions();
      return true;
    } catch (error) {
      errorMessage.value = "Unable to add transaction.";
      return false;
    }
  };

  const updateTransaction = async (id: number, input: TransactionInput) => {
    resetMessages();
    try {
      await apiFetch(`/api/transactions/${id}`, {
        method: "PUT",
        body: input,
      });
      statusMessage.value = "Transaction updated.";
      await loadTransactions();
      return true;
    } catch (error) {
      errorMessage.value = "Unable to update transaction.";
      return false;
    }
  };

  const deleteTransaction = async (id: number) => {
    resetMessages();
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      statusMessage.value = "Transaction deleted.";
      await loadTransactions();
      return true;
    } catch (error) {
      errorMessage.value = "Unable to delete transaction.";
      return false;
    }
  };

  return {
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
