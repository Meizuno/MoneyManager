<script setup lang="ts">
import { computed, ref } from "vue";
import type { TransactionInput } from "~/types/transaction";

const props = defineProps<{
  typeOptions: string[];
  categoryOptions: string[];
}>();

const emit = defineEmits<{
  (event: "submit", payload: TransactionInput): void;
}>();

const getToday = () => new Date().toISOString().slice(0, 10);
const form = ref({
  date: getToday(),
  description: "",
  amount: null as number | null,
  currency: "",
  type: "other",
  category: "other",
});
const isValid = computed(
  () => Boolean(form.value.date) && Boolean(form.value.description) && form.value.amount !== null,
);
const clearForm = () => {
  form.value = {
    date: getToday(),
    description: "",
    amount: null,
    currency: "",
    type: props.typeOptions[0] ?? "other",
    category: props.categoryOptions[0] ?? "other",
  };
};

const submitForm = () => {
  if (!isValid.value) return;
  emit("submit", {
    date: form.value.date,
    description: form.value.description,
    amount: form.value.amount ?? "",
    currency: form.value.currency,
    type: form.value.type || "other",
    category: form.value.category || "other",
  });
  clearForm();
};
</script>

<template>
  <UCard class="glass-card">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-white">Add transaction</h2>
        <p class="mt-1 text-sm text-slate-300">
          Capture manual entries like cash spending or transfers.
        </p>
      </div>
      <UBadge color="primary" variant="subtle">Manual entry</UBadge>
    </div>
    <div class="mt-6 grid gap-3">
      <div class="grid gap-3 md:grid-cols-2">
        <UFormField label="Date" help="Use the posting date from your statement.">
          <UInput v-model="form.date" type="date" placeholder="2026-02-08" class="w-full" />
        </UFormField>
        <UFormField label="Description" help="Keep it short so it’s easy to scan.">
          <UInput v-model="form.description" placeholder="Coffee with team" class="w-full" />
        </UFormField>
        <UFormField label="Amount" help="Use negative values for expenses.">
          <UInputNumber
            v-model="form.amount"
            :step="0.01"
            placeholder="-12.50"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Currency" help="ISO currency code, e.g. USD.">
          <UInput v-model="form.currency" placeholder="USD" class="w-full" />
        </UFormField>
        <UFormField label="Type" help="Income, expense, transfer, or other.">
          <USelect v-model="form.type" :items="typeOptions" class="w-full" />
        </UFormField>
        <UFormField label="Spending category" help="Pick the closest match.">
          <USelect v-model="form.category" :items="categoryOptions" class="w-full" />
        </UFormField>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton color="primary" variant="solid" :disabled="!isValid" @click="submitForm">
          Add transaction
        </UButton>
        <UButton color="neutral" variant="outline" @click="clearForm">
          Clear
        </UButton>
        <p class="text-xs text-slate-400">
          Required: date, description, amount.
        </p>
      </div>
    </div>
  </UCard>
</template>
