<script setup lang="ts">
const props = defineProps<{
  totals: {
    income: number;
    expenses: number;
    net: number;
  };
  formatAmount: (amount: number, currency?: string | null) => string;
}>();

const positive = computed(() => props.totals.net >= 0);
</script>

<template>
  <section class="flex flex-col gap-2">
    <!-- Income + Expenses share one compact row -->
    <div class="grid grid-cols-2 gap-2">
      <div class="glass-card rounded-xl p-2">
        <p class="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-dimmed sm:text-xs">
          {{ $t('stats.income') }}
        </p>
        <p class="truncate text-base font-semibold text-emerald-600 sm:text-xl dark:text-emerald-300">
          {{ formatAmount(totals.income) }}
        </p>
      </div>
      <div class="glass-card rounded-xl p-2">
        <p class="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-dimmed sm:text-xs">
          {{ $t('stats.expenses') }}
        </p>
        <p class="truncate text-base font-semibold text-rose-600 sm:text-xl dark:text-rose-300">
          {{ formatAmount(totals.expenses) }}
        </p>
      </div>
    </div>

    <!-- Net balance banner (moved from the chart) -->
    <div
      class="flex items-center justify-between gap-3 rounded-xl border px-3 py-1"
      :class="positive ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-rose-400/30 bg-rose-500/10'"
    >
      <div class="flex items-center gap-2">
        <UIcon
          :name="positive ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'"
          class="h-5 w-5"
          :class="positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
        />
        <span
          class="text-xs font-semibold uppercase tracking-[0.2em]"
          :class="positive ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'"
        >
          {{ $t('salesSplit.remaining') }}
        </span>
      </div>
      <span
        class="truncate text-base font-semibold sm:text-lg"
        :class="positive ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'"
      >
        {{ positive ? '' : '-' }}{{ formatAmount(Math.abs(totals.net)) }}
      </span>
    </div>
  </section>
</template>
