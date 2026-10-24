<script setup lang="ts">
import { Bar } from "vue-chartjs";
import type { ChartOptions, TooltipItem } from "chart.js";
import type { MonthTotals } from "#shared/schemas/transaction";
import { periodLabel, shortMonthLabel } from "~/utils/period";

// Income and expenses month by month. The month on screen is in full
// colour and the rest are muted; a click anywhere in a month's column
// opens that month. Client-only (a canvas).
const props = defineProps<{ trend: MonthTotals[]; selected: string | null }>();
const emit = defineEmits<{ select: [month: string] }>();

const { t } = useI18n();
const colorMode = useColorMode();

const INCOME = "#10b981";
const EXPENSE = "#f43f5e";
const shade = (hex: string, month: string) => (!props.selected || month === props.selected ? hex : `${hex}55`);
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const data = computed(() => ({
  labels: props.trend.map(m => shortMonthLabel(m.month)),
  datasets: [
    {
      label: t("stats.income"),
      data: props.trend.map(m => m.income),
      backgroundColor: props.trend.map(m => shade(INCOME, m.month)),
      borderRadius: 4,
      maxBarThickness: 18,
    },
    {
      label: t("stats.expenses"),
      data: props.trend.map(m => m.expenses),
      backgroundColor: props.trend.map(m => shade(EXPENSE, m.month)),
      borderRadius: 4,
      maxBarThickness: 18,
    },
  ],
}));

const options = computed<ChartOptions<"bar">>(() => {
  const dark = colorMode.value === "dark";
  const ink = dark ? "#94a3b8" : "#64748b";
  const monthAt = (items: TooltipItem<"bar">[]) => props.trend[items[0]?.dataIndex ?? -1];
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: "index", intersect: false },
    onClick: (_event, elements) => {
      const month = props.trend[elements[0]?.index ?? -1]?.month;
      if (month) emit("select", month);
    },
    onHover: (event, elements) => {
      const target = event.native?.target as HTMLElement | undefined;
      if (target) target.style.cursor = elements.length ? "pointer" : "default";
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15,23,42,0.94)",
        padding: 10,
        cornerRadius: 10,
        boxPadding: 4,
        callbacks: {
          title: items => periodLabel(monthAt(items)?.month ?? ""),
          label: item => ` ${item.dataset.label}: ${formatMoney(item.parsed.y ?? 0, null, false)}`,
          footer: (items) => {
            const month = monthAt(items);
            if (!month) return "";
            const net = month.income - month.expenses;
            return `${t("trend.net")}: ${net < 0 ? "−" : "+"}${formatMoney(Math.abs(net), null, false)}`;
          },
        },
      },
    },
    scales: {
      // Level labels; on a phone every other month is skipped instead.
      x: { grid: { display: false }, border: { display: false }, ticks: { color: ink, maxRotation: 0 } },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: dark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.06)" },
        ticks: { color: ink, maxTicksLimit: 5, callback: value => compact.format(Number(value)) },
      },
    },
  };
});
</script>

<template>
  <section class="panel p-5 sm:p-6">
    <header class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('trend.title') }}</h2>
      <div class="flex items-center gap-4 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-emerald-500" />{{ $t('stats.income') }}</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-sm bg-rose-500" />{{ $t('stats.expenses') }}</span>
      </div>
    </header>
    <div class="h-56 sm:h-64">
      <Bar :data="data" :options="options" />
    </div>
  </section>
</template>
