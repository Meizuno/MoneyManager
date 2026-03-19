<script setup lang="ts">
defineProps<{
  totals: {
    income: number;
    expenses: number;
    net: number;
  };
  formatAmount: (amount: number, currency?: string | null) => string;
}>();
</script>

<template>
  <section class="grid gap-4 md:grid-cols-3">
    <UCard class="glass-card">
      <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
        {{ $t('stats.income') }}
      </p>
      <p class="mt-3 text-2xl font-semibold text-emerald-300">
        {{ formatAmount(totals.income) }}
      </p>
    </UCard>
    <UCard class="glass-card">
      <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
        {{ $t('stats.expenses') }}
      </p>
      <p class="mt-3 text-2xl font-semibold text-rose-300">
        {{ formatAmount(totals.expenses) }}
      </p>
    </UCard>
    <UCard class="glass-card">
      <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
        {{ $t('stats.net') }}
      </p>
      <p class="mt-3 text-2xl font-semibold text-white">
        {{ formatAmount(totals.net) }}
      </p>
    </UCard>
  </section>
</template>
