// Single source of truth for the two reference lists — expense
// categories (sales-split rules) and income categories — shared by the
// transaction form's dropdowns and the categories management page.
//
// Smart cache: each list is fetched once (ensure*) and served from
// useState afterwards. Invalidation is event-based, not time-based — the
// CRUD helpers persist to the API and then update the cached array in
// place, so an edit IS the cache update and every consumer stays fresh
// without a watcher mirror. refresh() forces a reload for the rare
// external-change case (another tab, MCP, …).
export interface SplitRule {
  id: number
  label: string
  percent: number
  color: string
}

export interface IncomeCategory {
  id: number
  label: string
  color: string
}

export const useCategories = () => {
  const { t } = useI18n();
  const { apiFetch } = useAuth();

  const splitRules = useState<SplitRule[]>("categories_split_rules", () => []);
  const incomeCategories = useState<IncomeCategory[]>("categories_income", () => []);
  const splitLoaded = useState<boolean>("categories_split_loaded", () => false);
  const incomeLoaded = useState<boolean>("categories_income_loaded", () => false);
  const savingRule = useState<boolean>("categories_saving_rule", () => false);
  const savingCategory = useState<boolean>("categories_saving_category", () => false);

  // ---- loads (fetch-once unless forced) -----------------------------------
  const loadSplitRules = async (force = false) => {
    if (!force && splitLoaded.value) return;
    try {
      const data = await apiFetch<{ rules: SplitRule[] }>("/api/sales-split");
      splitRules.value = data.rules ?? [];
      splitLoaded.value = true;
    } catch { /* leave cache as-is; a later ensure retries while unloaded */ }
  };
  const ensureSplitRules = () => loadSplitRules(false);

  const loadIncomeCategories = async (force = false) => {
    if (!force && incomeLoaded.value) return;
    try {
      incomeCategories.value = await apiFetch<IncomeCategory[]>("/api/income-categories") ?? [];
      incomeLoaded.value = true;
    } catch { /* leave cache as-is */ }
  };
  const ensureIncomeCategories = () => loadIncomeCategories(false);

  const ensureLoaded = () => Promise.all([ensureSplitRules(), ensureIncomeCategories()]);
  const refresh = () => Promise.all([loadSplitRules(true), loadIncomeCategories(true)]);

  // Seed both lists from data fetched elsewhere (e.g. the /api/overview
  // BFF) and mark them loaded, so the fetch-once cache treats them as
  // populated and no extra per-list request is made.
  const hydrate = (data: { splitRules?: SplitRule[], incomeCategories?: IncomeCategory[] }) => {
    if (data.splitRules) {
      splitRules.value = data.splitRules;
      splitLoaded.value = true;
    }
    if (data.incomeCategories) {
      incomeCategories.value = data.incomeCategories;
      incomeLoaded.value = true;
    }
  };

  // ---- expense categories (sales-split rules) CRUD ------------------------
  const addRule = async () => {
    savingRule.value = true;
    try {
      const rule = await apiFetch<SplitRule>("/api/sales-split", {
        method: "POST",
        body: { label: t("salesSplit.newRule"), percent: 10 },
      });
      splitRules.value = [...splitRules.value, rule];
    } finally { savingRule.value = false; }
  };

  // Persist an edit. The bound object already lives in `splitRules`, so
  // the cache is current; this just writes it through to the server.
  const updateRule = (rule: SplitRule) =>
    apiFetch(`/api/sales-split/${rule.id}`, {
      method: "PUT",
      body: { label: rule.label, percent: rule.percent },
    });

  const removeRule = async (id: number) => {
    await apiFetch(`/api/sales-split/${id}`, { method: "DELETE" });
    splitRules.value = splitRules.value.filter((r) => r.id !== id);
  };

  // ---- income categories CRUD ---------------------------------------------
  const addCategory = async () => {
    savingCategory.value = true;
    try {
      const cat = await apiFetch<IncomeCategory>("/api/income-categories", {
        method: "POST",
        body: { label: t("incomeCategories.newCategory") },
      });
      incomeCategories.value = [...incomeCategories.value, cat];
    } finally { savingCategory.value = false; }
  };

  const updateCategory = (cat: IncomeCategory) =>
    apiFetch(`/api/income-categories/${cat.id}`, {
      method: "PUT",
      body: { label: cat.label },
    });

  const removeCategory = async (id: number) => {
    await apiFetch(`/api/income-categories/${id}`, { method: "DELETE" });
    incomeCategories.value = incomeCategories.value.filter((c) => c.id !== id);
  };

  return {
    splitRules,
    incomeCategories,
    savingRule,
    savingCategory,
    ensureSplitRules,
    ensureIncomeCategories,
    ensureLoaded,
    hydrate,
    refresh,
    addRule,
    updateRule,
    removeRule,
    addCategory,
    updateCategory,
    removeCategory,
  };
};
