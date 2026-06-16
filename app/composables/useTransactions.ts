import type { Transaction, CreateTransactionPayload, UpdateTransactionPayload } from "#shared/schemas/transaction";

export const useTransactions = () => {
  const { t } = useI18n();

  const transactions = useState<Transaction[]>("transactions", () => []);
  const loading = useState<boolean>("transactions_loading", () => false);

  // Feedback surfaces as toasts rather than inline banners.
  const toast = useToast();
  const notifySuccess = (title: string) =>
    toast.add({ title, color: "success", icon: "i-heroicons-check-circle" });
  const notifyError = (title: string) =>
    toast.add({ title, color: "error", icon: "i-heroicons-exclamation-triangle" });

  // Seed the filters from the URL query so a reloaded / shared overview
  // link restores the same view. Runs in the useState factory (server
  // side during SSR) so the first render already reflects the query.
  const route = useRoute();
  const queryString = (value: unknown, fallback: string) =>
    typeof value === "string" && value ? value : fallback;

  const filterCategory = useState<string>("transactions_filter", () =>
    queryString(route.query.category, "all"));
  const filterType = useState<string>("transactions_filter_type", () =>
    queryString(route.query.type, "all"));
  const filterDateFrom = useState<string>("transactions_filter_date_from", () =>
    queryString(route.query.dateFrom, ""));
  const filterDateTo = useState<string>("transactions_filter_date_to", () =>
    queryString(route.query.dateTo, ""));
  const filterDatePreset = useState<string>("transactions_filter_date_preset", () =>
    queryString(route.query.preset, "this-month"));

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
    // Hard-default to an empty array — both lookups are typed as
    // `string[] | undefined` under noUncheckedIndexedAccess, so the
    // `??` chain alone can't statically narrow to `string[]`.
    const values: string[] = categoryValuesByType[type] ?? categoryValuesByType.income ?? [];
    return values.map((v) => ({ label: t(`categories.${v}`), value: v, icon: categoryIconMap[v] }));
  };

  const categories = computed(() => {
    // Distinct id → label pairs from the loaded transactions. The filter
    // option's value is the id (what the API filters on); the label comes
    // straight off the joined category. Skip uncategorised (id 0).
    const byId = new Map<number, string>();
    transactions.value.forEach((item) => {
      if (item.category.id) byId.set(item.category.id, item.category.label);
    });
    const list = Array.from(byId.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    return [
      { label: t("types.all"), value: "all" },
      ...list.map(([id, label]) => ({
        label: label || t("categories.other"),
        value: String(id),
        icon: categoryIconMap[label.toLowerCase()] ?? "i-heroicons-chart-pie",
      })),
    ];
  });

  const types = computed(() => [
    { label: t("types.all"), value: "all" },
    ...typeValues.map((v) => ({ label: t(`types.${v}`), value: v, icon: typeIconMap[v] })),
  ]);

  const datePresetOptions = computed(() => [
    { label: t("datePresets.thisMonth"), value: "this-month" },
    { label: t("datePresets.prevMonth"), value: "previous-month" },
    { label: t("datePresets.thisYear"), value: "this-year" },
    { label: t("datePresets.all"), value: "all" },
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

  const formatAmount =(amount: number, currency?: string | null) => {
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

  const loadSplitRules = async () => {
    try {
      const data = await apiFetch<{ rules: { id: number; label: string; color: string }[] }>("/api/sales-split");
      splitRules.value = data.rules ?? [];
    } catch { splitRules.value = []; }
  };

  const loadIncomeCategories = async () => {
    try {
      const data = await apiFetch<{ id: number; label: string; color: string }[]>("/api/income-categories");
      incomeCategories.value = data ?? [];
    } catch { incomeCategories.value = []; }
  };

  const loadTransactions = async (opts?: { force?: boolean }) => {
    if (!opts?.force && transactions.value.length > 0) return;
    loading.value = true;
    try {
      const [data] = await Promise.all([
        apiFetch<{ items: Transaction[] }>("/api/transactions", {
          // "all" / empty are UI sentinels for "no filter" — drop them
          // rather than send them as query params. The server's `type`
          // is a strict income|expense enum and 400s on "all"; sending
          // undefined omits the param so the filter is simply absent.
          query: {
            category:
              filterCategory.value && filterCategory.value !== "all"
                ? filterCategory.value
                : undefined,
            type:
              normalizedFilterType.value !== "all"
                ? normalizedFilterType.value
                : undefined,
            dateFrom: filterDateFrom.value || undefined,
            dateTo: filterDateTo.value || undefined,
          },
        }),
        splitRules.value.length === 0 ? loadSplitRules() : Promise.resolve(),
        incomeCategories.value.length === 0 ? loadIncomeCategories() : Promise.resolve(),
      ]);
      transactions.value = data.items ?? [];
    } catch {
      notifyError(t("transactions.toast.loadError"));
    } finally {
      loading.value = false;
    }
  };

  const createTransaction = async (input: CreateTransactionPayload) => {
    try {
      await apiFetch("/api/transactions", { method: "POST", body: input });
      await loadTransactions({ force: true });
      notifySuccess(t("transactions.toast.added"));
      return true;
    } catch {
      notifyError(t("transactions.toast.addError"));
      return false;
    }
  };

  const updateTransaction = async (id: number, input: UpdateTransactionPayload) => {
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "PUT", body: input });
      await loadTransactions({ force: true });
      notifySuccess(t("transactions.toast.updated"));
      return true;
    } catch {
      notifyError(t("transactions.toast.updateError"));
      return false;
    }
  };

  const deleteTransaction = async (id: number) => {
    try {
      await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
      await loadTransactions({ force: true });
      notifySuccess(t("transactions.toast.deleted"));
      return true;
    } catch {
      notifyError(t("transactions.toast.deleteError"));
      return false;
    }
  };

  return {
    MANAGE_CATEGORIES_VALUE,
    transactions,
    loading,
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
    formatAmount,
    loadTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
};
