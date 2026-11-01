import type { CreateRecurringPayload, RecurringTransaction, UpdateRecurringPayload } from "#shared/schemas/recurring";
import type { RecurrenceUnit } from "#shared/utils/recurrence";

// Recurring transactions: make, change and delete one, each with its
// notice, and how a schedule is said ("Every month", "Every 2 weeks").
// Afterwards every useAsyncData on the page is refreshed — making one may
// already have written its first occurrence into the list behind it.
export const useRecurring = () => {
  const { t } = useI18n();
  const notice = useNotice();
  const { apiFetch } = useAuth();

  const reasonOf = (error: unknown) => {
    const data = (error as { data?: { message?: string } } | null)?.data;
    return typeof data?.message === "string" ? data.message : undefined;
  };

  const run = async (request: () => Promise<unknown>, done: string, failed: string) => {
    try {
      await request();
      notice.done(t(done));
      await refreshNuxtData();
      return true;
    }
    catch (error) {
      notice.failed(t(failed), reasonOf(error));
      return false;
    }
  };

  const listRecurring = () => apiFetch<RecurringTransaction[]>("/api/recurring");

  const createRecurring = (input: CreateRecurringPayload) =>
    run(() => apiFetch("/api/recurring", { method: "POST", body: input }),
      "recurring.toast.added", "recurring.toast.addError");

  const updateRecurring = (id: number, input: UpdateRecurringPayload, done = "recurring.toast.updated") =>
    run(() => apiFetch(`/api/recurring/${id}`, { method: "PUT", body: input }),
      done, "recurring.toast.updateError");

  const deleteRecurring = (id: number) =>
    run(() => apiFetch(`/api/recurring/${id}`, { method: "DELETE" }),
      "recurring.toast.deleted", "recurring.toast.deleteError");

  // "Every month", "Every 2 weeks".
  const scheduleLabel = (unit: RecurrenceUnit, every: number) =>
    every === 1
      ? t(`recurring.each.${unit}`)
      : t("recurring.everyN", { count: every, unit: t(`recurring.units.${unit}`, every) });

  return { listRecurring, createRecurring, updateRecurring, deleteRecurring, scheduleLabel };
};
