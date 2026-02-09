<script setup lang="ts">
const {
  loading,
  errorMessage,
  totals,
  categoryTotals,
  maxCategoryTotal,
  formatAmount,
  loadTransactions,
} = useTransactions();

await loadTransactions();

onMounted(() => {
  const route = useRoute();
  if (route.query.auth === "forbidden") {
    const toast = useToast();
    toast.add({
      title: "Access denied (403)",
      description: "Your account is not allowed to sign in.",
      color: "error",
    });

    navigateTo(route.path, { replace: true });
  }
});

useHead({
  title: "Money Manager",
});
</script>

<template>
  <div class="flex flex-col gap-10">
    <UPageHeader
      title="Personal cash flow studio"
      description="Track how money moves across spending categories and transaction types."
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">Overview</UBadge>
      </template>
    </UPageHeader>

    <StatsCards :totals="totals" :format-amount="formatAmount" />

    <UAlert
      v-if="loading"
      color="neutral"
      variant="subtle"
      class="glass-card"
      title="Loading data"
      description="Fetching your latest transactions."
    />
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      class="glass-card"
      title="Something went wrong"
      :description="errorMessage"
    />

    <CategoryChart
      :category-totals="categoryTotals"
      :max-category-total="maxCategoryTotal"
      :format-amount="formatAmount"
    />
  </div>
</template>
