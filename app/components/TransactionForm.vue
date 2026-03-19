<script setup lang="ts">
import { parseDate } from "@internationalized/date";
import type { TransactionInput } from "~/types/transaction";

interface SelectItem { label: string; value: string; icon?: string }

const props = defineProps<{
  typeOptions: SelectItem[];
  getCategoryOptions: (type: string) => SelectItem[];
}>();

const emit = defineEmits<{
  (event: "submit", payload: TransactionInput): void;
}>();

const getToday = () => new Date().toISOString().slice(0, 10);
const form = ref({
  date: getToday(),
  name: "",
  amount: null as number | null,
  currency: "CZK",
  type: "expense",
  category: "rental", // first expense category value
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

const currentCategoryOptions = computed(() => props.getCategoryOptions(form.value.type));

watch(() => form.value.type, (type) => {
  form.value.category = props.getCategoryOptions(type)[0]?.value ?? "";
});

const clearForm = () => {
  const type = props.typeOptions[0]?.value ?? "expense";
  form.value = {
    date: getToday(),
    name: "",
    amount: null,
    currency: "CZK",
    type,
    category: props.getCategoryOptions(type)[0]?.value ?? "",
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
        <h2 class="text-xl font-semibold text-white">{{ $t('form.title') }}</h2>
        <p class="mt-1 text-sm text-slate-300">{{ $t('form.description') }}</p>
      </div>
      <UBadge color="primary" variant="subtle">{{ $t('form.badge') }}</UBadge>
    </div>
    <div class="mt-6 grid gap-3">
      <div class="grid gap-3 md:grid-cols-2">
        <UFormField :label="$t('form.date')" :help="$t('form.dateHelp')">
          <UPopover v-model:open="formDateOpen" :content="{ side: 'bottom', sideOffset: 8 }">
            <template #anchor>
              <UInputDate v-model="formDateValue" locale="cs" class="w-full">
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
        <UFormField :label="$t('form.name')" :help="$t('form.nameHelp')">
          <UInput v-model="form.name" :placeholder="$t('form.namePlaceholder')" class="w-full" />
        </UFormField>
        <UFormField :label="$t('form.amount')" :help="$t('form.amountHelp')">
          <UInputNumber
            v-model="form.amount"
            :step="1"
            :min="0"
            placeholder="12.50"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="$t('form.currency')" :help="$t('form.currencyHelp')">
          <UInput v-model="form.currency" :placeholder="$t('form.currencyPlaceholder')" class="w-full" />
        </UFormField>
        <UFormField :label="$t('form.type')" :help="$t('form.typeHelp')">
          <USelect
            v-model="form.type"
            :items="typeOptions"
            :leading-icon="typeOptions.find(o => o.value === form.type)?.icon"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="$t('form.category')" :help="$t('form.categoryHelp')">
          <USelect
            v-model="form.category"
            :items="currentCategoryOptions"
            :leading-icon="currentCategoryOptions.find(o => o.value === form.category)?.icon"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton color="primary" variant="solid" :disabled="!isValid" @click="submitForm">
          {{ $t('form.addButton') }}
        </UButton>
        <UButton color="neutral" variant="outline" @click="clearForm">
          {{ $t('common.clear') }}
        </UButton>
        <p class="text-xs text-slate-400">{{ $t('common.required') }}</p>
      </div>
    </div>
  </UCard>
</template>
