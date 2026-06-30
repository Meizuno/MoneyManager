<script setup lang="ts">
import { Bar } from "vue-chartjs";
import type { Transaction, UpdateTransactionPayload } from "#shared/schemas/transaction";
import type { SplitRule, IncomeCategory } from "~/composables/useCategories";

// Combined overview: filters + two switchable views of the same period.
// The "chart" view is an Allocated-vs-Spent bar chart plus a
// category-grouped ledger (each category expands to its transactions,
// editable inline). The "list" view is a flat, chronological transaction
// list — same rows, editable inline. A segmented toggle in the header
// flips between them. Rendered client-only (canvas).
interface SelectItem { label: string; value: string; icon?: string }

type LegendItem = {
  label: string;
  value: number;
  allocated?: number;
  percent: number;
  color: string;
  transactions: Transaction[];
};
type LegendGroup = { label: string; items: LegendItem[] };

const TAILWIND_COLORS: Record<string, string> = {
  cyan: "#06b6d4", violet: "#8b5cf6", amber: "#f59e0b", emerald: "#10b981",
  rose: "#f43f5e", sky: "#0ea5e9", indigo: "#6366f1", pink: "#ec4899",
  orange: "#f97316", teal: "#14b8a6", lime: "#84cc16", red: "#ef4444",
  green: "#22c55e", blue: "#3b82f6", purple: "#a855f7", yellow: "#eab308",
  gray: "#94a3b8", slate: "#94a3b8", zinc: "#94a3b8", fuchsia: "#d946ef",
};
const colorOf = (name: string) => TAILWIND_COLORS[name] ?? "#94a3b8";

const props = defineProps<{
  transactions: Transaction[];
  expenseCategories: SplitRule[];
  incomeCategories: IncomeCategory[];
  typeOptions: SelectItem[];
  getCategoryOptions: (type: string) => SelectItem[];
  filterDateFrom: string;
  filterDateTo: string;
  filterDatePreset: string;
}>();

const emit = defineEmits<{
  (event: "update", payload: { id: number; input: UpdateTransactionPayload }): void;
  (event: "delete", id: number): void;
  (
    event: "update:filterDateFrom" | "update:filterDateTo" | "update:filterDatePreset",
    value: string
  ): void;
}>();

const { t } = useI18n();
const round2 = (n: number) => Math.round(n * 100) / 100;
// Plain 2-decimal number — the chart legend shows amounts without a
// currency symbol (everything here is the user's base currency).
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// --- Aggregation ---------------------------------------------------------
const expenses = computed(() => props.transactions.filter(tx => tx.type === "expense"));
const incomes = computed(() => props.transactions.filter(tx => tx.type === "income"));

const incomeCatById = computed(() => new Map(props.incomeCategories.map(c => [c.id, c])));
const totalIncome = computed(() => round2(incomes.value.reduce((s, i) => s + Math.abs(i.amount), 0)));

const incomeLegend = computed<LegendItem[]>(() => {
  const byLabel = new Map<string, { total: number; color: string; txs: Transaction[] }>();
  for (const tx of incomes.value) {
    const cat = incomeCatById.value.get(tx.category.id);
    const label = cat?.label ?? tx.category.label ?? t("categories.other");
    const color = cat ? colorOf(cat.color) : "#94a3b8";
    const entry = byLabel.get(label) ?? { total: 0, color, txs: [] };
    entry.total += Math.abs(tx.amount);
    entry.txs.push(tx);
    byLabel.set(label, entry);
  }
  return [...byLabel.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([label, { total, color, txs }]) => ({
      label,
      value: round2(total),
      percent: totalIncome.value > 0 ? Math.round((total / totalIncome.value) * 100) : 0,
      color,
      transactions: [...txs].sort((a, b) => b.date.localeCompare(a.date)),
    }));
});

type ExpenseRow = { label: string; allocated: number; spent: number; percent: number; color: string; transactions: Transaction[] };

const expenseRows = computed<ExpenseRow[]>(() => {
  const cats = props.expenseCategories;
  const txByCat = new Map<number, Transaction[]>();
  for (const tx of expenses.value) {
    const list = txByCat.get(tx.category.id) ?? [];
    list.push(tx);
    txByCat.set(tx.category.id, list);
  }
  const rows: ExpenseRow[] = cats.map((c) => {
    const txs = txByCat.get(c.id) ?? [];
    const spent = txs.reduce((s, x) => s + Math.abs(x.amount), 0);
    const allocated = round2((totalIncome.value * c.percent) / 100);
    return {
      label: c.label,
      allocated,
      spent: round2(spent),
      percent: allocated > 0 ? Math.round((spent / allocated) * 100) : 0,
      color: colorOf(c.color),
      transactions: [...txs].sort((a, b) => b.date.localeCompare(a.date)),
    };
  });
  const knownIds = new Set(cats.map(c => c.id));
  const orphans: Transaction[] = [];
  for (const [catId, txs] of txByCat.entries()) {
    if (!knownIds.has(catId)) orphans.push(...txs);
  }
  if (orphans.length) {
    rows.push({
      label: t("categories.other"),
      allocated: 0,
      spent: round2(orphans.reduce((s, x) => s + Math.abs(x.amount), 0)),
      percent: 0,
      color: "#94a3b8",
      transactions: [...orphans].sort((a, b) => b.date.localeCompare(a.date)),
    });
  }
  return rows.sort((a, b) => b.allocated - a.allocated);
});

const legendGroupsNormalized = computed<LegendGroup[]>(() => {
  const groups: LegendGroup[] = [];
  const expenseItems: LegendItem[] = expenseRows.value.map(e => ({
    label: e.label, value: e.spent, allocated: e.allocated, percent: e.percent, color: e.color, transactions: e.transactions,
  }));
  if (expenseItems.length) groups.push({ label: t("stats.expenses"), items: expenseItems });
  if (incomeLegend.value.length) groups.push({ label: t("stats.income"), items: incomeLegend.value });
  return groups;
});

const hasTransactions = computed(() => props.transactions.length > 0);

// --- View toggle (chart vs flat list) ------------------------------------
const viewMode = ref<"chart" | "list">("chart");
const viewOptions = computed(() => [
  { value: "chart" as const, icon: "i-heroicons-chart-bar", label: t("overview.viewChart") },
  { value: "list" as const, icon: "i-heroicons-list-bullet", label: t("overview.viewList") },
]);

// Category id → colour, across both expense and income categories, so the
// flat list can show a coloured chip per row (the grouped view gets its
// colour from the category heading instead).
const catColorById = computed(() => {
  const m = new Map<number, string>();
  for (const c of props.expenseCategories) m.set(c.id, colorOf(c.color));
  for (const c of props.incomeCategories) m.set(c.id, colorOf(c.color));
  return m;
});
const flatTransactions = computed(() =>
  [...props.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
);

// --- Chart ---------------------------------------------------------------
const chartData = computed(() => {
  const items = expenseRows.value;
  if (!items.length) return null;
  const colors = items.map(e => e.color);
  const common = { borderColor: "rgba(255,255,255,0.6)", borderWidth: 1.5, borderRadius: 8 };
  return {
    labels: items.map(e => `${e.label} (${e.percent}%)`),
    datasets: [
      { label: t("salesSplit.allocated"), data: items.map(e => e.allocated), backgroundColor: colors.map(c => c + "80"), ...common },
      { label: t("salesSplit.amountField"), data: items.map(e => e.spent), backgroundColor: colors, ...common },
    ],
  };
});

type ChartLike = {
  canvas?: HTMLCanvasElement;
  setActiveElements: (els: unknown[]) => void;
  update: () => void;
  tooltip?: {
    getActiveElements?: () => { index: number }[];
    setActiveElements: (els: unknown[], pos: { x: number, y: number }) => void;
  };
};
const chartRef = ref<{ chart?: ChartLike } | null>(null);

function dismissTooltip() {
  const chart = chartRef.value?.chart;
  if (!chart) return;
  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chart.update();
}

if (import.meta.client) {
  const onOutside = (e: PointerEvent) => {
    const canvas = chartRef.value?.chart?.canvas;
    if (canvas && !canvas.contains(e.target as Node)) dismissTooltip();
  };
  onMounted(() => document.addEventListener("pointerdown", onOutside));
  onUnmounted(() => document.removeEventListener("pointerdown", onOutside));
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index" as const, intersect: false },
  animation: { duration: 600, easing: "easeOutQuart" as const },
  onClick(_evt: unknown, elements: { index: number }[], chart: unknown) {
    const c = chart as ChartLike;
    const active = c.tooltip?.getActiveElements?.() ?? [];
    if (elements.length === 0 || (active.length && elements[0]?.index === active[0]?.index)) {
      dismissTooltip();
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(15,23,42,0.92)",
      titleColor: "#f8fafc",
      bodyColor: "#e2e8f0",
      borderColor: "rgba(148,163,184,0.2)",
      borderWidth: 1,
      padding: 10,
      cornerRadius: 10,
    },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.16)" }, border: { display: false }, ticks: { color: "#64748b" } },
    x: { grid: { display: false }, border: { display: false }, ticks: { color: "#475569" } },
  },
};


// --- Month filter --------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");

// Options are "YYYY-M" per month plus "YYYY-0" for a whole year, from
// today back to the first selectable month (January 2026).
const NAV_START = new Date(2026, 0, 1);
const monthOptions = computed(() => {
  const now = new Date();
  const years: { label: string; value: string }[] = [];
  for (let y = now.getFullYear(); y >= NAV_START.getFullYear(); y--) {
    years.push({ label: `${y} — Full year`, value: `${y}-0` });
  }
  const months: { label: string; value: string }[] = [];
  const start = NAV_START;
  let d = new Date(now.getFullYear(), now.getMonth(), 1);
  while (d >= start) {
    months.push({
      label: d.toLocaleString("en", { month: "long", year: "numeric" }),
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
    });
    d = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  }
  return [...years, ...months];
});

// Derive the picker's value from the active date range — a Jan 1 → Dec 31
// span reads as the whole year, otherwise the month of `dateFrom`.
const selectedMonth = computed(() => {
  const from = props.filterDateFrom;
  if (!from) {
    const n = new Date();
    return `${n.getFullYear()}-${n.getMonth() + 1}`;
  }
  const [yearStr, monthStr] = from.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month === 1 && props.filterDateTo === `${year}-12-31`) return `${year}-0`;
  return `${year}-${month}`;
});

function onMonthChange(value: string) {
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  emit("update:filterDatePreset", "custom");
  if (month === 0) {
    emit("update:filterDateFrom", `${year}-01-01`);
    emit("update:filterDateTo", `${year}-12-31`);
    return;
  }
  const lastDay = new Date(year, month, 0).getDate();
  emit("update:filterDateFrom", `${year}-${pad(month)}-01`);
  emit("update:filterDateTo", `${year}-${pad(month)}-${pad(lastDay)}`);
}

// --- Collapsable category drill-down -------------------------------------
// Keyed by `${group.label}:${item.label}` so the same label under both
// Expenses and Income expands independently.
const expandedCategories = ref<Set<string>>(new Set());
function toggleCategory(key: string) {
  const next = new Set(expandedCategories.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedCategories.value = next;
}
const { onEnter: onExpandEnter, onAfterEnter: onExpandAfterEnter, onLeave: onExpandLeave } = useExpandAnimation();
</script>

<template>
  <UCard
    class="glass-card relative overflow-hidden rounded-2xl bg-linear-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800"
    :ui="{ body: 'px-3 py-4 sm:p-6' }"
  >
    <!-- Ambient glow (ai-chat ProseChart style) -->
    <div class="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-cyan-400/10 blur-2xl" />
    <div class="pointer-events-none absolute -bottom-16 -left-12 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl" />
    <div class="relative">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h4 class="truncate text-base font-semibold text-highlighted">{{ $t('overview.chartTitle') }}</h4>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <!-- Chart ↔ list view toggle -->
        <UButtonGroup v-if="hasTransactions" size="sm">
          <UButton
            v-for="opt in viewOptions"
            :key="opt.value"
            :icon="opt.icon"
            :color="viewMode === opt.value ? 'primary' : 'neutral'"
            :variant="viewMode === opt.value ? 'solid' : 'subtle'"
            :aria-label="opt.label"
            :title="opt.label"
            @click="viewMode = opt.value"
          />
        </UButtonGroup>
        <USelect
          :model-value="selectedMonth"
          :items="monthOptions"
          size="sm"
          color="neutral"
          variant="subtle"
          @update:model-value="onMonthChange($event as string)"
        />
      </div>
    </div>

    <template v-if="hasTransactions">
      <!-- Chart view: bar chart + category-grouped editable ledger -->
      <template v-if="viewMode === 'chart'">
      <!-- Chart -->
      <div v-if="chartData" class="mt-4 h-72 sm:h-80">
        <Bar ref="chartRef" :data="chartData" :options="chartOptions" />
      </div>

      <!-- Category-grouped, editable ledger -->
      <div class="mt-3 space-y-3">
        <div v-for="group in legendGroupsNormalized" :key="group.label">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-dimmed">{{ group.label }}</p>
          <div class="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
            <div
              v-for="item in group.items"
              :key="`${group.label}:${item.label}`"
              class="group min-w-0 overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/50"
            >
              <!-- Header: click to expand this category's transactions inline. -->
              <div
                class="flex items-center gap-2 px-3 py-2"
                :class="item.transactions.length ? 'cursor-pointer select-none' : ''"
                @click="item.transactions.length ? toggleCategory(`${group.label}:${item.label}`) : undefined"
              >
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
                  <span class="min-w-0 flex-1 truncate text-xs font-medium text-toned">{{ item.label }}</span>
                  <span class="shrink-0 whitespace-nowrap text-xs text-muted">
                    {{ fmt(item.value) }}
                    <template v-if="item.allocated"> / {{ fmt(item.allocated) }}</template>
                    ({{ item.percent }}%)
                  </span>
                  <UIcon
                    v-if="item.transactions.length"
                    :name="expandedCategories.has(`${group.label}:${item.label}`) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                    class="h-3.5 w-3.5 shrink-0 text-dimmed"
                  />
                </div>
                <div class="px-3 pb-1">
                  <div class="relative h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/70">
                    <div
                      class="h-1.5 rounded-full transition-all"
                      :style="{
                        width: item.percent > 0 ? `${Math.min(item.percent, 100)}%` : '2px',
                        backgroundColor: item.percent > 100 ? '#ef4444' : item.color,
                      }"
                    />
                  </div>
                </div>

              <!-- Collapsable drill-down: transactions for this category, editable -->
              <Transition @enter="onExpandEnter" @after-enter="onExpandAfterEnter" @leave="onExpandLeave">
                <div
                  v-if="expandedCategories.has(`${group.label}:${item.label}`) && item.transactions.length"
                  class="space-y-2 border-t border-slate-200/70 px-3 py-2 dark:border-slate-700/60"
                >
                  <div v-for="tx in item.transactions" :key="tx.id">
                    <OverviewTransactionRow
                      :transaction="tx"
                      :type-options="typeOptions"
                      :get-category-options="getCategoryOptions"
                      @update="emit('update', $event)"
                      @delete="emit('delete', $event)"
                    />
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>
      </template>

      <!-- List view: flat, chronological, editable transaction list -->
      <div v-else class="mt-4 space-y-1.5">
        <div
          v-for="tx in flatTransactions"
          :key="tx.id"
          class="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-900/50"
        >
          <OverviewTransactionRow
            :transaction="tx"
            :type-options="typeOptions"
            :get-category-options="getCategoryOptions"
            :category-label="tx.category.label || $t('categories.other')"
            :category-color="catColorById.get(tx.category.id)"
            @update="emit('update', $event)"
            @delete="emit('delete', $event)"
          />
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else class="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-default p-6">
      <div>
        <p class="text-sm font-semibold text-highlighted">{{ $t('transactions.emptyTitle') }}</p>
        <p class="mt-1 text-sm text-dimmed">{{ $t('transactions.emptyDesc') }}</p>
      </div>
      <UButton color="primary" variant="solid" to="/transactions">
        {{ $t('transactions.addManually') }}
      </UButton>
    </div>
    </div>
  </UCard>
</template>
