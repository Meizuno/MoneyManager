<script setup lang="ts">
import type { TransactionInput } from "~/types/transaction";

const {
  transactions,
  loading,
  errorMessage,
  statusMessage,
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
  formatAmount,
  loadTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = useTransactions();

await loadTransactions();

watch([filterCategory, filterType, filterDateFrom, filterDateTo], () => {
  loadTransactions({ force: true });
});

const handleCreate = async (payload: TransactionInput) => {
  await createTransaction(payload);
};

const handleUpdate = async (payload: { id: number; input: TransactionInput }) => {
  await updateTransaction(payload.id, payload.input);
};

const handleDelete = async (id: number) => {
  await deleteTransaction(id);
};

const formRef = ref<HTMLElement | null>(null);
const focusForm = () => {
  formRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const { t } = useI18n();
useHead({ title: t("transactions.pageTitle") });
</script>

<template>
  <div class="flex flex-col gap-8">
    <UPageHeader
      :title="$t('transactions.title')"
      :description="$t('transactions.description')"
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">{{ $t('nav.transactions') }}</UBadge>
      </template>
    </UPageHeader>

    <UAlert
      v-if="loading"
      color="neutral"
      variant="subtle"
      class="glass-card"
      :title="$t('transactions.loadingTitle')"
      :description="$t('transactions.loadingDesc')"
    />
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      class="glass-card"
      :title="$t('transactions.errorTitle')"
      :description="errorMessage"
    />
    <UAlert
      v-if="statusMessage"
      color="success"
      variant="subtle"
      class="glass-card"
      :title="$t('transactions.successTitle')"
      :description="statusMessage"
    />

    <div class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div ref="formRef">
        <TransactionForm
          :type-options="typeOptions"
          :get-category-options="getCategoryOptions"
          @submit="handleCreate"
        />
      </div>
      <TransactionList
        :transactions="transactions"
        :type-options="typeOptions"
        :get-category-options="getCategoryOptions"
        :categories="categories"
        :types="types"
        :date-preset-options="datePresetOptions"
        v-model:filter-category="filterCategory"
        v-model:filter-type="filterType"
        v-model:filter-date-from="filterDateFrom"
        v-model:filter-date-to="filterDateTo"
        v-model:filter-date-preset="filterDatePreset"
        :format-amount="formatAmount"
        @update="handleUpdate"
        @delete="handleDelete"
        @focus-form="focusForm"
      />
    </div>
  </div>
</template>
