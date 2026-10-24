import { currentMonth, isMonth, isPeriod, periodLabel, periodRange, stepPeriod, type Period } from "~/utils/period";

// The page's period, kept in the address (`?period=`) so a reload or a
// shared link shows the same span. The current month is the default and
// stays out of the address. `allowAll` lets a page offer "All time".
export function usePeriod(options: { allowAll?: boolean } = {}) {
  const route = useRoute();
  const router = useRouter();
  const thisMonth = currentMonth();

  const period = computed<Period>({
    get: () => {
      const value = route.query.period;
      return isPeriod(value, options.allowAll ?? false) ? value : thisMonth;
    },
    set: (value) => {
      void router.replace({ query: { ...route.query, period: value === thisMonth ? undefined : value } });
    },
  });

  const range = computed(() => periodRange(period.value));
  const label = computed(() => periodLabel(period.value));
  // Nothing has happened after this month or this year yet.
  const canStepForward = computed(() => {
    if (isMonth(period.value)) return period.value < thisMonth;
    if (period.value === "all") return false;
    return period.value < thisMonth.slice(0, 4);
  });

  function step(n: number) {
    period.value = stepPeriod(period.value, n);
  }

  return { period, range, label, thisMonth, canStepForward, step };
}
