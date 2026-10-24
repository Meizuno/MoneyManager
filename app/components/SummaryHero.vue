<script setup lang="ts">
// The period at a glance: what is left over (or overspent), how much of
// the income went, and income and expenses against the period before.
const props = defineProps<{
  income: number;
  expenses: number;
  // The same two figures for the period before, when there is one to
  // compare with (a month); its name for the "vs September" line.
  previous: { income: number; expenses: number; label: string } | null;
}>();

const net = computed(() => props.income - props.expenses);
const spentShare = computed(() => (props.income > 0 ? props.expenses / props.income : null));

// Whole percent change, or null when there is nothing to compare with.
const change = (now: number, before: number | undefined) =>
  before ? Math.round(((now - before) / before) * 100) : null;
const incomeChange = computed(() => change(props.income, props.previous?.income));
const expenseChange = computed(() => change(props.expenses, props.previous?.expenses));

const tiles = computed(() => [
  {
    key: "income",
    amount: props.income,
    change: incomeChange.value,
    // More income is good news, more spending isn't.
    good: (incomeChange.value ?? 0) >= 0,
    icon: "i-heroicons-arrow-trending-up",
    tone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "expenses",
    amount: props.expenses,
    change: expenseChange.value,
    good: (expenseChange.value ?? 0) <= 0,
    icon: "i-heroicons-arrow-trending-down",
    tone: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  },
]);
</script>

<template>
  <section class="panel overflow-hidden">
    <div class="grid gap-6 p-5 sm:p-7 md:grid-cols-[1.35fr_1fr] md:items-center md:gap-10">
      <div>
        <p class="text-sm font-medium text-muted">
          {{ net >= 0 ? $t('overview.leftOver') : $t('overview.overspent') }}
        </p>
        <p
          class="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl"
          :class="net >= 0 ? 'text-highlighted' : 'text-rose-600 dark:text-rose-400'"
        >
          <MoneyAmount :amount="net" />
        </p>
        <div v-if="spentShare !== null" class="mt-5">
          <div class="h-2 overflow-hidden rounded-full bg-elevated">
            <div
              class="h-full rounded-full transition-[width] duration-500"
              :class="spentShare > 1 ? 'bg-rose-500' : 'bg-linear-to-r from-cyan-400 to-cyan-600'"
              :style="{ width: `${Math.min(spentShare, 1) * 100}%` }"
            />
          </div>
          <p class="mt-2 text-xs text-muted">
            {{ $t('overview.spentShare', { percent: Math.round(spentShare * 100) }) }}
          </p>
        </div>
        <p v-else class="mt-4 text-xs text-muted">{{ $t('overview.noIncome') }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-1">
        <div v-for="tile in tiles" :key="tile.key" class="rounded-xl bg-elevated/60 p-3 sm:p-4">
          <div class="flex items-center gap-2">
            <span class="grid size-7 place-items-center rounded-full" :class="tile.tone">
              <UIcon :name="tile.icon" class="size-4" />
            </span>
            <span class="text-xs font-medium text-muted sm:text-sm">{{ $t(`stats.${tile.key}`) }}</span>
          </div>
          <p class="mt-2 font-display text-lg font-semibold text-highlighted sm:text-2xl">
            <MoneyAmount :amount="tile.amount" />
          </p>
          <p v-if="previous && tile.change !== null" class="mt-0.5 text-xs" :class="tile.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
            {{ tile.change > 0 ? '↑' : tile.change < 0 ? '↓' : '' }} {{ Math.abs(tile.change) }}%
            <span class="text-muted">{{ $t('overview.vs', { period: previous.label }) }}</span>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
