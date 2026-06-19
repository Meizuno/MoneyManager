<script setup lang="ts">
// Placeholder for the overview chart while its data loads (filter change)
// or before client hydration. Mirrors the card's shape: title + month
// select, the chart area, and a few category rows.
</script>

<template>
  <UCard class="glass-card" :ui="{ body: 'px-3 py-4 sm:p-6' }">
    <div class="flex items-center justify-between gap-3">
      <USkeleton class="h-5 w-40" />
      <USkeleton class="h-8 w-28 shrink-0" />
    </div>
    <USkeleton class="mt-5 h-72 w-full sm:h-80" />
    <div class="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
      <USkeleton v-for="n in 6" :key="n" class="h-11 w-full rounded-xl" />
    </div>
  </UCard>
</template>
