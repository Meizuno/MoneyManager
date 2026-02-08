<script setup lang="ts">
import { watch } from "vue";
import type { TransactionInput } from "~/types/transaction";

const {
  transactions,
  loading,
  errorMessage,
  statusMessage,
  filterCategory,
  categories,
  typeOptions,
  categoryOptions,
  formatAmount,
  loadTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = useTransactions();

await loadTransactions();

watch(filterCategory, () => {
  loadTransactions();
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

useHead({
  title: "Transactions",
});
</script>

<template>
  <div class="flex flex-col gap-8">
    <UPageHeader
      title="Manage entries"
      description="Add manual entries or edit existing transactions."
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="cyan" variant="subtle">Transactions</UBadge>
      </template>
    </UPageHeader>

    <UFormField label="Filter spending category" class="max-w-xs">
      <USelect v-model="filterCategory" :items="categories" />
    </UFormField>

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
      color="rose"
      variant="subtle"
      class="glass-card"
      title="Action failed"
      :description="errorMessage"
    />
    <UAlert
      v-if="statusMessage"
      color="emerald"
      variant="subtle"
      class="glass-card"
      title="Update complete"
      :description="statusMessage"
    />

    <div class="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <TransactionForm
        :type-options="typeOptions"
        :category-options="categoryOptions"
        @submit="handleCreate"
      />
      <TransactionList
        :transactions="transactions"
        :type-options="typeOptions"
        :category-options="categoryOptions"
        :format-amount="formatAmount"
        @update="handleUpdate"
        @delete="handleDelete"
      />
    </div>
  </div>
</template>
