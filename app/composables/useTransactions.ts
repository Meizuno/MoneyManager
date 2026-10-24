import type { CreateTransactionPayload, UpdateTransactionPayload } from "#shared/schemas/transaction";

// Writing transactions: create, update and delete, each with its toast.
// Afterwards every useAsyncData on the page is refreshed (the overview,
// the transaction list), so whatever is on screen shows the change.
export const useTransactions = () => {
  const { t } = useI18n();
  const toast = useToast();
  const { apiFetch } = useAuth();

  // The server's own message when it sent one ("Category is required"),
  // else just the title.
  const reasonOf = (error: unknown) => {
    const data = (error as { data?: { message?: string } } | null)?.data;
    return typeof data?.message === "string" ? data.message : undefined;
  };

  const run = async (request: () => Promise<unknown>, done: string, failed: string) => {
    try {
      await request();
      toast.add({ title: t(done), color: "success", icon: "i-heroicons-check-circle" });
      await refreshNuxtData();
      return true;
    }
    catch (error) {
      toast.add({ title: t(failed), description: reasonOf(error), color: "error", icon: "i-heroicons-exclamation-triangle" });
      return false;
    }
  };

  const createTransaction = (input: CreateTransactionPayload) =>
    run(() => apiFetch("/api/transactions", { method: "POST", body: input }),
      "transactions.toast.added", "transactions.toast.addError");

  const updateTransaction = (id: number, input: UpdateTransactionPayload) =>
    run(() => apiFetch(`/api/transactions/${id}`, { method: "PUT", body: input }),
      "transactions.toast.updated", "transactions.toast.updateError");

  const deleteTransaction = (id: number) =>
    run(() => apiFetch(`/api/transactions/${id}`, { method: "DELETE" }),
      "transactions.toast.deleted", "transactions.toast.deleteError");

  return { createTransaction, updateTransaction, deleteTransaction };
};
