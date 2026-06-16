import type { Transaction, TransactionSummary, CreateTransactionPayload, UpdateTransactionPayload } from "#shared/schemas/transaction";
import type { OverviewResponse } from "#shared/schemas/overview";

export const useTransactions = () => {
  const { t } = useI18n();

  const transactions = useState<Transaction[]>("transactions", () => []);
  const loading = useState<boolean>("transactions_loading", () => false);

  // DB-side aggregates for the overview stats. Sourced from
  // /api/transactions/summary so the totals don't depend on fetching
  // every matching row.
  const summary = useState<TransactionSummary>("transactions_summary", () => ({
    income: 0,
    expenses: 0,
    net: 0,
    incomeCount: 0,
    expenseCount: 0,
  }));

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

  // Reference lists are owned by useCategories (single source of truth,
  // smart cache). The form dropdowns read them here; the categories page
  // edits them there — same useState, so edits stay in sync.
  const { splitRules, incomeCategories, ensureSplitRules, ensureIncomeCategories, hydrate: hydrateCategories } = useCategories();

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

  const totals = computed(() => ({
    income: summary.value.income,
    expenses: summary.value.expenses,
    net: summary.value.net,
  }));

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

  // The active filters as API query params, shared by the list and
  // summary fetches. "all" / empty are UI sentinels for "no filter" and
  // are dropped to undefined — the server's `type` is a strict
  // income|expense enum and 400s on "all", so omitting the param leaves
  // the filter simply absent.
  const filterQuery = () => ({
    category:
      filterCategory.value && filterCategory.value !== "all"
        ? filterCategory.value
        : undefined,
    type: normalizedFilterType.value !== "all" ? normalizedFilterType.value : undefined,
    dateFrom: filterDateFrom.value || undefined,
    dateTo: filterDateTo.value || undefined,
  });

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

  // Make sure the form's category dropdowns have data. Fetch-once via the
  // useCategories cache — no-ops when the lists are already loaded.
  const ensureCategories = () => Promise.all([ensureSplitRules(), ensureIncomeCategories()]);

  const loadSummary = async () => {
    try {
      summary.value = await apiFetch<TransactionSummary>("/api/transactions/summary", {
        query: filterQuery(),
      });
    } catch {
      // Keep the last known summary on failure; the list load surfaces
      // the error toast so we don't double-notify here.
    }
  };

  const overviewLoaded = useState<boolean>("overview_loaded", () => false);

  // Single-request loader for the overview: the /api/overview BFF returns
  // the list, summary, and both category lists resolved in-process, so
  // SSR makes one round-trip instead of four. Hydrates the shared
  // category cache so the form dropdowns reuse it without refetching.
  const loadOverview = async (opts?: { force?: boolean }) => {
    if (!opts?.force && overviewLoaded.value) return;
    loading.value = true;
    try {
      const data = await apiFetch<OverviewResponse>("/api/overview", { query: filterQuery() });
      transactions.value = data.items ?? [];
      summary.value = data.summary;
      hydrateCategories({ splitRules: data.splitRules, incomeCategories: data.incomeCategories });
      overviewLoaded.value = true;
    } catch {
      notifyError(t("transactions.toast.loadError"));
    } finally {
      loading.value = false;
    }
  };

  const createTransaction = async (input: CreateTransactionPayload) => {
    try {
      await apiFetch("/api/transactions", { method: "POST", body: input });
      await loadOverview({ force: true });
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
      await loadOverview({ force: true });
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
      await loadOverview({ force: true });
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
    ensureCategories,
    categories,
    types,
    datePresetOptions,
    totals,
    summary,
    formatAmount,
    loadOverview,
    loadSummary,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
};
