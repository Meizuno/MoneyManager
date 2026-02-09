<script setup lang="ts">
import { ref } from "vue";
import type { Transaction, TransactionInput } from "~/types/transaction";

const props = defineProps<{
  transactions: Transaction[];
  typeOptions: string[];
  categoryOptions: string[];
  formatAmount: (amount: number, currency?: string | null) => string;
}>();

const emit = defineEmits<{
  (event: "update", payload: { id: number; input: TransactionInput }): void;
  (event: "delete", id: number): void;
}>();

const editingId = ref<number | null>(null);
const editItem = ref({
  date: "",
  description: "",
  amount: null as number | null,
  currency: "",
  type: "other",
  category: "other",
});

const startEdit = (item: Transaction) => {
  editingId.value = item.id;
  editItem.value = {
    date: item.date,
    description: item.description,
    amount: item.amount,
    currency: item.currency ?? "",
    type: item.type ?? "other",
    category: item.category ?? "other",
  };
};

const cancelEdit = () => {
  editingId.value = null;
};

const submitEdit = (id: number) => {
  emit("update", {
    id,
    input: {
      date: editItem.value.date,
      description: editItem.value.description,
      amount: editItem.value.amount ?? "",
      currency: editItem.value.currency,
      type: editItem.value.type || "other",
      category: editItem.value.category || "other",
    },
  });
  editingId.value = null;
};
</script>

<template>
  <UCard class="glass-card">
    <h2 class="text-xl font-semibold text-white">Transactions</h2>
    <div class="mt-4 space-y-3">
      <UCard
        v-for="item in transactions"
        :key="item.id"
        class="surface-panel"
      >
        <template v-if="editingId === item.id">
          <div class="grid gap-3 md:grid-cols-2">
            <UFormField label="Date">
              <UInput v-model="editItem.date" />
            </UFormField>
            <UFormField label="Description">
              <UInput v-model="editItem.description" />
            </UFormField>
            <UFormField label="Amount">
              <UInputNumber v-model="editItem.amount" :step="0.01" />
            </UFormField>
            <UFormField label="Currency">
              <UInput v-model="editItem.currency" />
            </UFormField>
            <UFormField label="Type">
              <USelect v-model="editItem.type" :items="typeOptions" />
            </UFormField>
            <UFormField label="Spending category">
              <USelect v-model="editItem.category" :items="categoryOptions" />
            </UFormField>
          </div>
          <div class="mt-3 flex gap-2">
            <UButton color="primary" variant="solid" @click="submitEdit(item.id)">
              Save
            </UButton>
            <UButton variant="outline" color="neutral" @click="cancelEdit">
              Cancel
            </UButton>
          </div>
        </template>
        <template v-else>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {{ item.date }}
              </p>
              <p class="mt-1 text-sm font-semibold text-white">
                {{ item.description }}
              </p>
              <div class="mt-2 flex flex-wrap gap-2">
                <UBadge variant="subtle" color="primary">
                  {{ item.type || "other" }}
                </UBadge>
                <UBadge variant="subtle" color="secondary">
                  {{ item.category || "other" }}
                </UBadge>
              </div>
            </div>
            <div class="text-right">
              <p
                class="text-lg font-semibold"
                :class="item.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'"
              >
                {{ formatAmount(item.amount, item.currency) }}
              </p>
              <div class="mt-2 flex items-center justify-end gap-2">
                <UButton size="sm" variant="outline" color="neutral" @click="startEdit(item)">
                  Edit
                </UButton>
                <UButton
                  size="sm"
                  color="error"
                  variant="subtle"
                  @click="emit('delete', item.id)"
                >
                  Delete
                </UButton>
              </div>
            </div>
          </div>
        </template>
      </UCard>
      <p v-if="transactions.length === 0" class="text-sm text-slate-500">
        No transactions yet. Import a CSV or add your first entry.
      </p>
    </div>
  </UCard>
</template>
