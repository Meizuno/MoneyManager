<script setup lang="ts">
import { ref } from "vue";
import type { TransactionInput } from "~/types/transaction";

const props = defineProps<{
  typeOptions: string[];
  categoryOptions: string[];
}>();

const emit = defineEmits<{
  (event: "submit", payload: TransactionInput): void;
}>();

const form = ref({
  date: "",
  description: "",
  amount: null as number | null,
  currency: "",
  type: "other",
  category: "other",
});

const submitForm = () => {
  emit("submit", {
    date: form.value.date,
    description: form.value.description,
    amount: form.value.amount ?? "",
    currency: form.value.currency,
    type: form.value.type || "other",
    category: form.value.category || "other",
  });
  form.value = {
    date: "",
    description: "",
    amount: null,
    currency: "",
    type: props.typeOptions[0] ?? "other",
    category: props.categoryOptions[0] ?? "other",
  };
};
</script>

<template>
  <UCard class="glass-card">
    <h2 class="text-xl font-semibold text-white">Add transaction</h2>
    <div class="mt-6 grid gap-3">
      <UFormField label="Date">
        <UInput v-model="form.date" placeholder="2026-02-08" />
      </UFormField>
      <UFormField label="Description">
        <UInput v-model="form.description" placeholder="Description" />
      </UFormField>
      <div class="grid gap-3 md:grid-cols-2">
        <UFormField label="Amount">
          <UInputNumber v-model="form.amount" :step="0.01" placeholder="Amount" />
        </UFormField>
        <UFormField label="Currency">
          <UInput v-model="form.currency" placeholder="CZK" />
        </UFormField>
      </div>
      <UFormField label="Type">
        <USelect v-model="form.type" :items="typeOptions" />
      </UFormField>
      <UFormField label="Spending category">
        <USelect v-model="form.category" :items="categoryOptions" />
      </UFormField>
      <UButton color="primary" variant="solid" @click="submitForm">
        Add transaction
      </UButton>
    </div>
  </UCard>
</template>
