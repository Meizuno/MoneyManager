import type { RecurringTransaction } from "#shared/schemas/recurring";
import type { Transaction, TransactionType } from "#shared/schemas/transaction";

// The one add/edit window. Opened from anywhere — the header's Add
// button, the bottom bar's +, a row in a list — and rendered once, in the
// layout (components/TransactionEditor.vue).
type EditorState = {
  open: boolean;
  // null: a new transaction of `type`.
  transaction: Transaction | null;
  type: TransactionType;
  // A recurring transaction being changed, paused or deleted — the same
  // window, the same form, its schedule shown rather than its date.
  recurring: RecurringTransaction | null;
};

export const useTransactionEditor = () => {
  const state = useState<EditorState>("transaction-editor", () => ({ open: false, transaction: null, type: "expense", recurring: null }));

  const openNew = (type: TransactionType = "expense") => {
    state.value = { open: true, transaction: null, type, recurring: null };
  };
  const openEdit = (transaction: Transaction) => {
    state.value = { open: true, transaction, type: transaction.type, recurring: null };
  };
  const openRecurring = (recurring: RecurringTransaction) => {
    state.value = { open: true, transaction: null, type: recurring.type, recurring };
  };
  const close = () => {
    state.value = { ...state.value, open: false };
  };

  return { state, openNew, openEdit, openRecurring, close };
};
