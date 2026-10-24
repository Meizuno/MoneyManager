<script setup lang="ts">
import type { Transaction } from "#shared/schemas/transaction";

// Transactions grouped by day, newest first, each day with its net. A row
// opens the edit window. Amounts are shown without the currency unless a
// row isn't in CZK — on a list of CZK it would only be noise. `plain`
// drops the boxes around each day, for a list that already sits in a card.
const props = withDefaults(defineProps<{
  transactions: Transaction[];
  dayTotals?: boolean;
  plain?: boolean;
}>(), { dayTotals: true, plain: false });

const { colorOf } = useCategories();
const { openEdit } = useTransactionEditor();
const today = localDay();

const days = computed(() => {
  const groups: { day: string; items: Transaction[]; net: number }[] = [];
  const sorted = [...props.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  for (const tx of sorted) {
    let group = groups.at(-1);
    if (!group || group.day !== tx.date) {
      group = { day: tx.date, items: [], net: 0 };
      groups.push(group);
    }
    group.items.push(tx);
    group.net += tx.type === "income" ? tx.amount : -tx.amount;
  }
  return groups;
});

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatNumber(Math.abs(n))}`;
const foreign = (tx: Transaction) => tx.currency && tx.currency.toUpperCase() !== "CZK";
</script>

<template>
  <div class="flex flex-col" :class="plain ? 'gap-3' : 'gap-5'">
    <section v-for="group in days" :key="group.day">
      <header class="flex items-baseline justify-between px-1 text-xs font-medium text-muted" :class="plain ? 'pb-1' : 'pb-2'">
        <span>{{ dayHeading(group.day, today) }}</span>
        <span v-if="dayTotals" class="tabular-nums">{{ signed(group.net) }}</span>
      </header>
      <ul :class="plain ? '-mx-2' : 'divide-y divide-default overflow-hidden rounded-2xl border border-default bg-default'">
        <li v-for="tx in group.items" :key="`${tx.type}:${tx.id}`">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center gap-3 text-left transition-colors hover:bg-elevated/60 focus-visible:bg-elevated/60 focus-visible:outline-none"
            :class="plain ? 'rounded-xl px-2 py-2' : 'px-3 py-2.5 sm:px-4'"
            @click="openEdit(tx)"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold"
              :style="{ backgroundColor: `${colorOf(tx.type, tx.category.id)}22`, color: colorOf(tx.type, tx.category.id) }"
            >
              {{ (tx.category.label || tx.name).charAt(0).toUpperCase() }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-highlighted">{{ tx.name }}</span>
              <span class="block truncate text-xs text-muted">{{ tx.category.label }}</span>
            </span>
            <span
              class="shrink-0 text-sm font-semibold tabular-nums"
              :class="tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-highlighted'"
            >
              {{ tx.type === 'income' ? '+' : '−' }}{{ formatNumber(tx.amount) }}
              <span v-if="foreign(tx)" class="ml-0.5 text-xs font-medium text-muted">{{ tx.currency }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
