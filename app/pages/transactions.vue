<script setup lang="ts">
import { ref, watch } from "vue";
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
  categoryOptions,
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

useHead({
  title: "Transactions",
});
</script>

<template>
  <div class="flex flex-col gap-8">
    <UPageHeader
      title="Manage entries"
      description="Add manual entries, tidy imports, and keep your ledger accurate."
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">Transactions</UBadge>
      </template>
    </UPageHeader>

    <UAlert
      v-if="loading"
      color="neutral"
      variant="subtle"
      class="glass-card"
      title="Loading transactions"
      description="Syncing your latest entries."
    />
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      class="glass-card"
      title="Action failed"
      :description="errorMessage"
    />
    <UAlert
      v-if="statusMessage"
      color="success"
      variant="subtle"
      class="glass-card"
      title="Update complete"
      :description="statusMessage"
    />

    <div class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div ref="formRef">
        <TransactionForm
          :type-options="typeOptions"
          :category-options="categoryOptions"
          @submit="handleCreate"
        />
      </div>
      <TransactionList
        :transactions="transactions"
        :type-options="typeOptions"
        :category-options="categoryOptions"
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
