type ImportPayload = {
  file: File;
  defaultCategory: string;
  defaultType: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  persisted?: boolean;
  items?: Transaction[];
};

export const useTransactions = () => {
  const transactions = useState<Transaction[]>("transactions", () => []);
  const loading = useState<boolean>("transactions_loading", () => false);
  const errorMessage = useState<string>("transactions_error", () => "");
  const statusMessage = useState<string>("transactions_status", () => "");
  const filterCategory = useState<string>("transactions_filter", () => "all");
  const localOnly = useState<boolean>("transactions_local_only", () => false);

  const typeOptions = [
    "other",
    "income",
    "expense",
    "transfer",
    "fee",
    "conversion",
    "refund",
  ];

  const categoryOptions = [
    "other",
    "groceries",
    "restaurant",
    "transport",
    "housing",
    "utilities",
    "entertainment",
    "health",
    "sport",
    "travel",
    "education",
    "shopping",
  ];

  const categories = computed(() => {
    const set = new Set<string>(["other"]);
    transactions.value.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ["all", ...list];
  });

  const totals = computed(() => {
    let income = 0;
    let expenses = 0;
    transactions.value.forEach((item) => {
      if (item.amount >= 0) {
        income += item.amount;
      } else {
        expenses += item.amount;
      }
    });
    return {
      income,
      expenses,
      net: income + expenses,
    };
  });

  const categoryTotals = computed(() => {
    const map = new Map<string, number>();
    transactions.value.forEach((item) => {
      const key = item.category || "other";
      map.set(key, (map.get(key) ?? 0) + item.amount);
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

  const loadTransactions = async (opts?: { force?: boolean }) => {
    if (localOnly.value && !opts?.force && transactions.value.length > 0) {
      return;
    }
    loading.value = true;
    resetMessages();
    try {
      const data = await apiFetch<{ items: Transaction[] }>("/api/transactions", {
        query: { category: filterCategory.value },
      });
      transactions.value = data.items ?? [];
      localOnly.value = false;
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

  const importCsv = async (payload: ImportPayload): Promise<ImportResult | null> => {
    resetMessages();
    const formData = new FormData();
    formData.append("file", payload.file);
    formData.append("defaultCategory", payload.defaultCategory || "other");
    formData.append("defaultType", payload.defaultType || "other");

    try {
      const result = await apiFetch<ImportResult>("/api/transactions/import", {
        method: "POST",
        body: formData,
      });
      statusMessage.value = `Imported ${result.imported} rows, skipped ${result.skipped}.`;
      if (result.persisted === false && result.items) {
        transactions.value = result.items;
        localOnly.value = true;
        statusMessage.value += " Not saved to database.";
      } else {
        await loadTransactions();
      }
      return result;
    } catch (error) {
      errorMessage.value = "Import failed.";
      return null;
    }
  };

  return {
    transactions,
    loading,
    errorMessage,
    statusMessage,
    filterCategory,
    typeOptions,
    categoryOptions,
    categories,
    totals,
    categoryTotals,
    maxCategoryTotal,
    formatAmount,
    loadTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    importCsv,
  };
};
