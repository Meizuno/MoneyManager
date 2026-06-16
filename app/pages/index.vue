<script setup lang="ts">
import type { UpdateTransactionPayload } from "#shared/schemas/transaction";

const { t } = useI18n();
const {
  transactions,
  loading,
  filterCategory,
  filterType,
  filterDateFrom,
  filterDateTo,
  filterDatePreset,
  categories,
  types,
  datePresetOptions,
  typeOptions,
  getCategoryOptions,
  totals,
  formatAmount,
  loadOverview,
  updateTransaction,
  deleteTransaction,
} = useTransactions();

await loadOverview();

watch([filterCategory, filterType, filterDateFrom, filterDateTo], () => {
  loadOverview({ force: true });
});

// Mirror the active filters into the URL query so the view is
// shareable and survives a reload. Only non-default values are written
// (and explicit dates only while the preset is "custom") to keep the
// URL tidy; the composable seeds its state back from these on load.
const router = useRouter();
watch(
  [filterCategory, filterType, filterDatePreset, filterDateFrom, filterDateTo],
  () => {
    const query: Record<string, string> = {};
    if (filterCategory.value !== "all") query.category = filterCategory.value;
    if (filterType.value !== "all") query.type = filterType.value;
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
  <div class="flex flex-col gap-10">
    <UPageHeader
      :title="$t('overview.title')"
      :description="$t('overview.description')"
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">{{ $t('nav.overview') }}</UBadge>
      </template>
    </UPageHeader>

    <StatsCards :totals="totals" :format-amount="formatAmount" />

    <UAlert
      v-if="loading"
      color="neutral"
      variant="subtle"
      class="glass-card"
      :title="$t('overview.loadingTitle')"
      :description="$t('overview.loadingDesc')"
    />

    <!-- The ledger (filters + N rows) is the heavy render. Move it off the
         server: SSR still fetches the data (cheap, serialized into the
         payload), but the list renders on the client from that data — so
         the VPS does no per-row work and the list paints instantly on
         hydration. A skeleton stands in during SSR / before hydration. -->
    <ClientOnly>
      <TransactionList
        v-model:filter-category="filterCategory"
        v-model:filter-type="filterType"
        v-model:filter-date-from="filterDateFrom"
        v-model:filter-date-to="filterDateTo"
        v-model:filter-date-preset="filterDatePreset"
        :transactions="transactions"
        :type-options="typeOptions"
        :get-category-options="getCategoryOptions"
        :categories="categories"
        :types="types"
        :date-preset-options="datePresetOptions"
        :format-amount="formatAmount"
        @update="handleUpdate"
        @delete="handleDelete"
      />
      <template #fallback>
        <UCard class="glass-card">
          <USkeleton class="h-6 w-48" />
          <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-10 w-full" />
          </div>
          <div class="mt-4 space-y-3">
            <USkeleton v-for="n in 4" :key="n" class="h-20 w-full rounded-2xl" />
          </div>
        </UCard>
      </template>
    </ClientOnly>
  </div>
</template>
