<script setup lang="ts">
defineProps<{
  categoryTotals: Array<{ category: string; total: number }>;
  maxCategoryTotal: number;
  formatAmount: (amount: number, currency?: string | null) => string;
}>();
</script>

<template>
  <UCard class="glass-card">
    <h2 class="text-xl font-semibold text-white">Spending categories</h2>
    <div class="mt-6 space-y-4">
      <div v-for="item in categoryTotals" :key="item.category">
        <div class="flex items-center justify-between text-xs font-semibold">
          <span class="text-slate-200">{{ item.category }}</span>
          <UBadge
            :color="item.total >= 0 ? 'success' : 'error'"
            variant="subtle"
            class="uppercase"
          >
            {{ formatAmount(item.total) }}
          </UBadge>
        </div>
        <div class="mt-2 h-2 w-full rounded-full bg-white/10">
          <div
            class="h-2 rounded-full"
            :class="item.total >= 0 ? 'bg-emerald-500' : 'bg-rose-500'"
            :style="{
              width: `${(Math.abs(item.total) / maxCategoryTotal) * 100}%`,
            }"
          />
        </div>
      </div>
      <p v-if="categoryTotals.length === 0" class="text-sm text-slate-400">
        Category insights will appear after importing data.
      </p>
    </div>
  </UCard>
</template>
