<script setup lang="ts">
import type { CreateTransactionPayload } from "#shared/schemas/transaction";

const {
  typeOptions,
  getCategoryOptions,
  MANAGE_CATEGORIES_VALUE,
  ensureCategories,
  createTransaction,
} = useTransactions();

// The list lives on the overview page now; this page is just the add
// form, so we only need the category lists that feed the dropdowns.
await ensureCategories();

const handleCreate = async (payload: CreateTransactionPayload) => {
  await createTransaction(payload);
};

const { t } = useI18n();
useHead({ title: t("transactions.pageTitle") });
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <TransactionForm
      :type-options="typeOptions"
      :get-category-options="getCategoryOptions"
      :manage-categories-value="MANAGE_CATEGORIES_VALUE"
      @submit="handleCreate"
    />
  </div>
</template>
