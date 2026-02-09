<script setup lang="ts">
import { parseDate } from "@internationalized/date";
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
  name: "",
  amount: null as number | null,
  currency: "",
  type: "other",
  category: "other",
});
const formDateOpen = ref(false);
const isValid = computed(
  () => Boolean(form.value.date) && Boolean(form.value.name) && form.value.amount !== null,
);
const safeParseDate = (value: string) => {
  try {
    return value ? parseDate(value) : undefined;
  } catch {
    return undefined;
  }
};
const formDateValue = computed({
  get: () => safeParseDate(form.value.date),
  set: (value) => {
    form.value.date = value ? value.toString() : "";
  },
});
const clearForm = () => {
  form.value = {
    date: getToday(),
    name: "",
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
    name: form.value.name,
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
          <UPopover v-model:open="formDateOpen" :content="{ side: 'bottom', sideOffset: 8 }">
            <template #anchor>
              <UInputDate v-model="formDateValue" class="w-full">
                <template #trailing>
                  <UButton
                    icon="i-heroicons-calendar-days"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="formDateOpen = !formDateOpen"
                  />
                </template>
              </UInputDate>
            </template>
            <template #content>
              <UCalendar v-model="formDateValue" />
            </template>
          </UPopover>
        </UFormField>
        <UFormField label="Name" help="Keep it short so it’s easy to scan.">
          <UInput v-model="form.name" placeholder="Coffee with team" class="w-full" />
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
          Required: date, name, amount.
        </p>
      </div>
    </div>
  </UCard>
</template>
