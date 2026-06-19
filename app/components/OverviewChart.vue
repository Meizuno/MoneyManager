<script setup lang="ts">
import { parseDate } from "@internationalized/date";
import { Bar } from "vue-chartjs";
import type { Transaction, UpdateTransactionPayload } from "#shared/schemas/transaction";
import type { SplitRule, IncomeCategory } from "~/composables/useCategories";

// Combined overview: filters + an Allocated-vs-Spent bar chart + a
// category-grouped ledger. The grouped legend IS the transaction list —
// each category expands to its transactions, editable inline — so the
// data is shown once, not duplicated across a chart and a separate list.
// Rendered client-only (canvas), driven by the period's transactions.
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
    x: { grid: { display: false }, border: { display: false }, ticks: { color: "#64748b" } },
  },
};


// --- Month filter --------------------------------------------------------
const safeParseDate = (value: string) => {
  try {
    return value ? parseDate(value) : undefined;
  } catch {
    return undefined;
  }
};
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

// --- Inline edit ---------------------------------------------------------
const editingId = ref<number | null>(null);
const editDateOpen = ref(false);
const editItem = ref({
  date: "", name: "", amount: null as number | null, currency: "", type: "expense", category: "",
});
const editCategoryOptions = computed(() => props.getCategoryOptions(editItem.value.type));
watch(() => editItem.value.type, (type) => {
  const opts = props.getCategoryOptions(type);
  if (!opts.some(o => o.value === editItem.value.category)) {
    editItem.value.category = opts[0]?.value ?? "";
  }
});
const editDateValue = computed({
  get: () => safeParseDate(editItem.value.date),
  set: (value) => { editItem.value.date = value ? value.toString() : ""; },
});
const formatDate = (iso: string) => {
  if (!iso) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};
const startEdit = (item: Transaction) => {
  editingId.value = item.id;
  editItem.value = {
    date: item.date,
    name: item.name,
    amount: item.amount,
    currency: item.currency ?? "",
    type: item.type ?? "expense",
    category: item.category.id ? String(item.category.id) : "",
  };
};
const cancelEdit = () => { editingId.value = null; };
const submitEdit = (id: number) => {
  emit("update", {
    id,
    input: {
      date: editItem.value.date,
      name: editItem.value.name,
      amount: editItem.value.amount ?? "",
      currency: editItem.value.currency,
      type: editItem.value.type as "income" | "expense",
      category: editItem.value.category || undefined,
    },
  });
  editingId.value = null;
};
</script>

<template>
  <UCard class="glass-card" :ui="{ body: 'px-3 py-4 sm:p-6' }">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h4 class="truncate text-base font-semibold text-highlighted">{{ $t('overview.chartTitle') }}</h4>
      </div>
      <USelect
        :model-value="selectedMonth"
        :items="monthOptions"
        size="sm"
        color="neutral"
        variant="subtle"
        class="shrink-0"
        @update:model-value="onMonthChange($event as string)"
      />
    </div>

    <template v-if="hasTransactions">
      <!-- Chart -->
      <div v-if="chartData" class="mt-4 h-72 sm:h-80">
        <Bar ref="chartRef" :data="chartData" :options="chartOptions" />
      </div>

      <!-- Category-grouped, editable ledger -->
      <div class="mt-3 space-y-3">
        <div v-for="group in legendGroupsNormalized" :key="group.label">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-dimmed">{{ group.label }}</p>
          <div class="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
            <UPopover
              v-for="item in group.items"
              :key="`${group.label}:${item.label}`"
              :ui="{ content: 'w-[var(--reka-popper-anchor-width)]' }"
            >
              <!-- Trigger: the category card stays a fixed height, so a
                   neighbour never stretches and no row gap appears. -->
              <div class="group surface-panel min-w-0 cursor-pointer overflow-hidden rounded-xl">
                <div class="flex items-center gap-2 px-3 py-2">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
                  <span class="min-w-0 flex-1 truncate text-xs font-medium text-toned">{{ item.label }}</span>
                  <span class="shrink-0 whitespace-nowrap text-xs text-muted">
                    {{ fmt(item.value) }}
                    <template v-if="item.allocated"> / {{ fmt(item.allocated) }}</template>
                    ({{ item.percent }}%)
                  </span>
                  <UIcon name="i-heroicons-chevron-down" class="h-3.5 w-3.5 shrink-0 text-dimmed transition-transform group-data-[state=open]:rotate-180" />
                </div>
                <div class="px-3 pb-1">
                  <div class="relative h-1.5 rounded-full bg-elevated">
                    <div
                      class="h-1.5 rounded-full transition-all"
                      :style="{
                        width: item.percent > 0 ? `${Math.min(item.percent, 100)}%` : '2px',
                        backgroundColor: item.percent > 100 ? '#ef4444' : item.color,
                      }"
                    />
                  </div>
                </div>
              </div>

              <!-- Drill-down: transactions for this category, editable -->
              <template #content>
                <div class="max-h-[60vh] space-y-2 overflow-y-auto p-3">
                  <template v-if="item.transactions.length">
                  <div v-for="tx in item.transactions" :key="tx.id">
                    <!-- Inline edit -->
                    <template v-if="editingId === tx.id">
                      <div class="grid gap-2 sm:grid-cols-2">
                        <UFormField :label="$t('form.date')" size="sm">
                          <UPopover v-model:open="editDateOpen" :content="{ side: 'bottom', sideOffset: 8 }">
                            <template #anchor>
                              <UInputDate v-model="editDateValue" locale="cs" size="sm" class="w-full">
                                <template #trailing>
                                  <UButton icon="i-heroicons-calendar-days" color="neutral" variant="ghost" size="xs" @click="editDateOpen = !editDateOpen" />
                                </template>
                              </UInputDate>
                            </template>
                            <template #content>
                              <UCalendar v-model="editDateValue" locale="cs" />
                            </template>
                          </UPopover>
                        </UFormField>
                        <UFormField :label="$t('form.name')" size="sm">
                          <UInput v-model="editItem.name" size="sm" class="w-full" />
                        </UFormField>
                        <UFormField :label="$t('form.amount')" size="sm">
                          <UInputNumber v-model="editItem.amount" size="sm" class="w-full" :step="0.01" :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }" />
                        </UFormField>
                        <UFormField :label="$t('form.currency')" size="sm">
                          <UInput v-model="editItem.currency" size="sm" class="w-full" />
                        </UFormField>
                        <UFormField :label="$t('form.type')" size="sm">
                          <USelect v-model="editItem.type" :items="typeOptions" :leading-icon="typeOptions.find(o => o.value === editItem.type)?.icon" size="sm" class="w-full" />
                        </UFormField>
                        <UFormField :label="$t('form.category')" size="sm">
                          <USelect v-model="editItem.category" :items="editCategoryOptions" :leading-icon="editCategoryOptions.find(o => o.value === editItem.category)?.icon" size="sm" class="w-full" />
                        </UFormField>
                      </div>
                      <div class="mt-2 flex gap-2">
                        <UButton color="primary" variant="solid" size="xs" @click="submitEdit(tx.id)">
                          {{ $t('transactions.saveChanges') }}
                        </UButton>
                        <UButton variant="outline" color="neutral" size="xs" @click="cancelEdit">
                          {{ $t('common.cancel') }}
                        </UButton>
                      </div>
                    </template>
                    <!-- Display -->
                    <div v-else class="flex items-center gap-2 text-xs text-muted">
                      <span class="shrink-0 text-dimmed">{{ formatDate(tx.date) }}</span>
                      <span class="min-w-0 flex-1 truncate text-toned">{{ tx.name }}</span>
                      <span class="shrink-0 font-medium text-toned">{{ fmt(Math.abs(tx.amount)) }}</span>
                      <UButton icon="i-heroicons-pencil-square" color="neutral" variant="ghost" size="xs" :aria-label="$t('common.edit')" @click="startEdit(tx)" />
                      <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs" :aria-label="$t('common.delete')" @click="emit('delete', tx.id)" />
                    </div>
                  </div>
                  </template>
                  <p v-else class="px-1 py-3 text-center text-xs text-dimmed">
                    {{ $t('transactions.emptyDesc') }}
                  </p>
                </div>
              </template>
            </UPopover>
          </div>
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
  </UCard>
</template>
