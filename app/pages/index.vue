<script setup lang="ts">
const { t } = useI18n();
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
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      class="glass-card"
      :title="$t('overview.errorTitle')"
      :description="errorMessage"
    />

    <CategoryChart
      :category-totals="categoryTotals"
      :max-category-total="maxCategoryTotal"
      :format-amount="formatAmount"
    />
  </div>
</template>
