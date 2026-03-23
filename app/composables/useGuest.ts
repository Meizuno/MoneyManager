const GUEST_KEY = "mm_guest";
const TX_KEY = "mm_guest_transactions";

export const useGuest = () => {
  const isGuest = useState<boolean>("guest_mode", () => false);

  const initGuest = () => {
    if (import.meta.client) {
      isGuest.value = localStorage.getItem(GUEST_KEY) === "true";
    }
  };

  const enterGuest = () => {
    isGuest.value = true;
    if (import.meta.client) localStorage.setItem(GUEST_KEY, "true");
  };

  const exitGuest = () => {
    isGuest.value = false;
    if (import.meta.client) {
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(TX_KEY);
    }
  };

  const loadGuestTransactions = (): Transaction[] => {
    if (!import.meta.client) return [];
    try { return JSON.parse(localStorage.getItem(TX_KEY) ?? "[]"); } catch { return []; }
  };

  const saveGuestTransactions = (items: Transaction[]) => {
    if (import.meta.client) localStorage.setItem(TX_KEY, JSON.stringify(items));
  };

  return { isGuest, initGuest, enterGuest, exitGuest, loadGuestTransactions, saveGuestTransactions };
};
