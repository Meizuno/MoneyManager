<script setup lang="ts">
import type { BudgetRow } from "~/utils/budget";

// Each expense category against its share of the period's income: what is
// left to spend, or how far over it went. In a period that is still
// running, a mark on each bar shows how far through it today is — a bar
// past the mark is spending ahead of plan. A row opens that category's
// transactions.
const props = defineProps<{
  rows: BudgetRow[];
  period: string;
  // 0–1 through the period, or null when it is over.
  elapsed: number | null;
  // The share of income no category claims, when there is one.
  unallocated: { percent: number; amount: number } | null;
}>();

const total = computed(() => ({
  planned: props.rows.reduce((s, r) => s + r.planned, 0),
  spent: props.rows.reduce((s, r) => s + r.spent, 0),
}));

const share = (row: BudgetRow) => (row.planned > 0 ? row.spent / row.planned : null);
const link = (row: BudgetRow) => ({ path: "/transactions", query: { period: props.period, type: "expense", category: row.id } });
const whole = (n: number) => formatMoney(n, null, false);
const OVER = "repeating-linear-gradient(-45deg, #f43f5e 0 5px, #be123c 5px 10px)";
</script>

<template>
  <section class="panel p-5 sm:p-6">
    <header class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('budget.title') }}</h2>
        <p class="text-sm text-muted">{{ $t('budget.subtitle') }}</p>
      </div>
      <span v-if="elapsed !== null" class="mt-1 flex shrink-0 items-center gap-1.5 text-xs text-muted">
        <span class="h-3 w-0.5 rounded-full bg-(--ui-text-highlighted) opacity-60" />
        {{ $t('budget.today') }}
      </span>
    </header>

    <ul class="-mx-2 flex flex-col">
      <li v-for="row in rows" :key="row.id">
        <NuxtLink :to="link(row)" class="block rounded-xl px-2 py-2.5 transition-colors hover:bg-elevated/60">
          <div class="flex items-center gap-2.5">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: row.color }" />
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ row.label }}</span>
            <span
              v-if="row.planned > 0"
              class="shrink-0 text-sm font-semibold tabular-nums"
              :class="row.spent > row.planned ? 'text-rose-600 dark:text-rose-400' : 'text-highlighted'"
            >
              {{ row.spent > row.planned
                ? $t('budget.over', { amount: whole(row.spent - row.planned) })
                : $t('budget.left', { amount: whole(row.planned - row.spent) }) }}
            </span>
          </div>
          <div class="relative mt-2 h-2 rounded-full bg-elevated">
            <!-- Over budget, the bar turns striped red: a category can be
                 red itself, but none is striped. -->
            <div
              class="h-full rounded-full transition-[width] duration-500"
              :style="(share(row) ?? 0) > 1
                ? { width: '100%', background: OVER }
                : { width: `${(share(row) ?? 0) * 100}%`, backgroundColor: row.color }"
            />
            <span
              v-if="elapsed !== null && row.planned > 0"
              class="absolute -inset-y-1 w-0.5 rounded-full bg-(--ui-text-highlighted) opacity-60"
              :style="{ left: `${elapsed * 100}%` }"
            />
          </div>
          <div class="mt-1.5 flex justify-between text-xs tabular-nums text-muted">
            <span v-if="row.planned > 0">{{ $t('budget.spentOf', { spent: formatNumber(row.spent), planned: formatNumber(row.planned) }) }}</span>
            <span v-else>{{ $t('budget.spentNoPlan', { spent: formatNumber(row.spent) }) }}</span>
            <span v-if="share(row) !== null" :class="{ 'font-medium text-rose-600 dark:text-rose-400': share(row)! > 1 }">
              {{ Math.round(share(row)! * 100) }}%
            </span>
          </div>
        </NuxtLink>
      </li>
    </ul>

    <footer class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-default pt-3 text-xs text-muted">
      <span>
        {{ $t('budget.total', { spent: whole(total.spent), planned: whole(total.planned) }) }}
      </span>
      <span v-if="unallocated">
        {{ $t('budget.unallocated', { percent: unallocated.percent, amount: whole(unallocated.amount) }) }}
      </span>
    </footer>
  </section>
</template>
