<script setup lang="ts">
import type { IncomeRow } from "~/utils/budget";

// Where the period's income came from, by income category, largest first.
const props = defineProps<{ rows: IncomeRow[]; period: string }>();

const total = computed(() => props.rows.reduce((s, r) => s + r.amount, 0));
const sorted = computed(() => [...props.rows].filter(r => r.amount > 0).sort((a, b) => b.amount - a.amount));
const link = (row: IncomeRow) => ({ path: "/transactions", query: { period: props.period, type: "income", category: row.id } });
</script>

<template>
  <section class="panel p-5 sm:p-6">
    <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('incomeCard.title') }}</h2>
    <ul v-if="sorted.length" class="-mx-2 mt-2 flex flex-col">
      <li v-for="row in sorted" :key="row.id">
        <NuxtLink :to="link(row)" class="block rounded-xl px-2 py-2 transition-colors hover:bg-elevated/60">
          <div class="flex items-center gap-2.5 text-sm">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: row.color }" />
            <span class="min-w-0 flex-1 truncate font-medium text-highlighted">{{ row.label }}</span>
            <span class="tabular-nums text-highlighted">{{ formatNumber(row.amount) }}</span>
          </div>
          <div class="mt-1.5 ml-5 h-1 rounded-full bg-elevated">
            <div class="h-full rounded-full" :style="{ width: `${(row.amount / total) * 100}%`, backgroundColor: row.color }" />
          </div>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="mt-2 text-sm text-muted">{{ $t('incomeCard.empty') }}</p>
  </section>
</template>
