<script setup lang="ts">
import type { UpdateTransactionPayload } from "#shared/schemas/transaction";

const { t } = useI18n();
const {
  transactions,
  loading,
  filterDateFrom,
  filterDateTo,
  filterDatePreset,
  typeOptions,
  getCategoryOptions,
  totals,
  formatAmount,
  loadOverview,
  updateTransaction,
  deleteTransaction,
} = useTransactions();

// Reference lists for the chart's category colours / percent allocation.
// loadOverview hydrates these (single source of truth in useCategories).
const { splitRules, incomeCategories } = useCategories();

await loadOverview();

watch([filterDateFrom, filterDateTo], () => {
  loadOverview({ force: true });
});

// Mirror the selected month into the URL query so the view is shareable
// and survives a reload (the composable seeds its state back from these).
const router = useRouter();
watch(
  [filterDatePreset, filterDateFrom, filterDateTo],
  () => {
    const query: Record<string, string> = {};
    if (filterDatePreset.value !== "this-month") query.preset = filterDatePreset.value;
    if (filterDatePreset.value === "custom") {
      if (filterDateFrom.value) query.dateFrom = filterDateFrom.value;
      if (filterDateTo.value) query.dateTo = filterDateTo.value;
    }
    router.replace({ query });
  },
);

const handleUpdate = async (payload: { id: number; input: UpdateTransactionPayload }) => {
  await updateTransaction(payload.id, payload.input);
};

const handleDelete = async (id: number) => {
  await deleteTransaction(id);
};

onMounted(() => {
  const route = useRoute();
  if (route.query.auth === "forbidden") {
    const toast = useToast();
    toast.add({
      title: t("auth.forbidden"),
      description: t("auth.forbiddenDesc"),
      color: "error",
    });

    navigateTo(route.path, { replace: true });
  }
});

useHead({ title: t("overview.pageTitle") });
</script>

<template>
  <div class="flex flex-col gap-8">
    <StatsCards :totals="totals" :format-amount="formatAmount" />

    <UAlert
      v-if="loading"
      color="neutral"
      variant="subtle"
      class="glass-card"
      :title="$t('overview.loadingTitle')"
      :description="$t('overview.loadingDesc')"
    />

    <!-- One combined view: filters + chart + the category-grouped, editable
         ledger (each category drills down to its transactions). Client-only
         (canvas + heavy render); the data is already in the SSR payload, so
         it paints instantly on hydration. -->
    <ClientOnly>
      <OverviewChart
        v-model:filter-date-from="filterDateFrom"
        v-model:filter-date-to="filterDateTo"
        v-model:filter-date-preset="filterDatePreset"
        :transactions="transactions"
        :expense-categories="splitRules"
        :income-categories="incomeCategories"
        :type-options="typeOptions"
        :get-category-options="getCategoryOptions"
        :format-amount="formatAmount"
        @update="handleUpdate"
        @delete="handleDelete"
      />
      <template #fallback>
        <UCard class="glass-card">
          <USkeleton class="h-6 w-48" />
          <USkeleton class="mt-4 h-72 w-full sm:h-80" />
        </UCard>
      </template>
    </ClientOnly>
  </div>
</template>
