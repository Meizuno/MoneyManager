<script setup lang="ts">
import type { CreateTransactionPayload } from "#shared/schemas/transaction";

const {
  typeOptions,
  getCategoryOptions,
  MANAGE_CATEGORIES_VALUE,
  loadSplitRules,
  loadIncomeCategories,
  createTransaction,
} = useTransactions();

// The list lives on the overview page now; this page is just the add
// form, so we only need the category lists that feed the dropdowns.
await Promise.all([loadSplitRules(), loadIncomeCategories()]);

const handleCreate = async (payload: CreateTransactionPayload) => {
  await createTransaction(payload);
};

const { t } = useI18n();
useHead({ title: t("transactions.pageTitle") });
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <UPageHeader
      :title="$t('transactions.title')"
      :description="$t('transactions.description')"
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">{{ $t('nav.transactions') }}</UBadge>
      </template>
    </UPageHeader>

    <TransactionForm
      :type-options="typeOptions"
      :get-category-options="getCategoryOptions"
      :manage-categories-value="MANAGE_CATEGORIES_VALUE"
      @submit="handleCreate"
    />
  </div>
</template>
