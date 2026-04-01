<script setup lang="ts">
import { parseDate } from "@internationalized/date";
import type { SelectItem } from "@nuxt/ui";
import type { TransactionInput } from "~/types/transaction";

interface CategoryItem {
  label: string;
  value: string;
  icon?: string;
  chip?: { color: string };
}

const props = defineProps<{
  typeOptions: SelectItem[];
  getCategoryOptions: (type: string) => CategoryItem[];
  manageCategoriesValue: string;
}>();

const router = useRouter();

const emit = defineEmits<{
  (event: "submit", payload: TransactionInput): void;
}>();

const getToday = () => new Date().toISOString().slice(0, 10);

const firstCategory = (type: string) =>
  props.getCategoryOptions(type).find(o => o.value !== props.manageCategoriesValue)?.value ?? "";

const form = ref({
  date: getToday(),
  name: "",
  amount: null as number | null,
  currency: "CZK",
  type: "expense",
  category: "",
});

onMounted(() => {
  form.value.category = firstCategory(form.value.type);
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

const currentCategoryOptions = computed<CategoryItem[]>(() => props.getCategoryOptions(form.value.type));
const currentCategoryOptionsForSelect = computed(() => currentCategoryOptions.value as SelectItem[]);

function getChip(value: string) {
  return currentCategoryOptions.value.find(o => o.value === value)?.chip;
}

watch(() => form.value.type, (type) => {
  form.value.category = firstCategory(type);
});

watch(currentCategoryOptions, (options) => {
  const real = options.filter(o => o.value !== props.manageCategoriesValue);
  const stillValid = real.some(o => o.value === form.value.category);
  if (!stillValid) {
    form.value.category = real[0]?.value ?? "";
  }
});

watch(() => form.value.category, (val) => {
  if (val === props.manageCategoriesValue) {
    form.value.category = currentCategoryOptions.value.find(o => o.value !== props.manageCategoriesValue)?.value ?? "";
    router.push(form.value.type === "income" ? "/income-categories" : "/sales-split");
  }
});

const clearForm = () => {
  const type = props.typeOptions[0]?.value ?? "expense";
  form.value = {
    date: getToday(),
    name: "",
    amount: null,
    currency: "CZK",
    type,
    category: firstCategory(type),
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
            :items="currentCategoryOptionsForSelect"
            :placeholder="$t('form.categoryPlaceholder')"
            class="w-full"
          >
            <template #leading="{ modelValue }">
              <span
                v-if="modelValue && getChip(modelValue as string)"
                class="ms-2.5 inline-block h-2 w-2 shrink-0 rounded-full"
                :style="{ backgroundColor: `var(--color-${getChip(modelValue as string)!.color}-400)` }"
              />
            </template>
            <template #item-leading="{ item }">
              <span
                v-if="(item as CategoryItem).chip"
                class="flex size-4 items-center justify-center"
              >
                <span
                  class="h-2 w-2 rounded-full"
                  :style="{ backgroundColor: `var(--color-${(item as CategoryItem).chip!.color}-400)` }"
                />
              </span>
              <UIcon
                v-else-if="(item as CategoryItem).icon"
                :name="(item as CategoryItem).icon!"
                class="size-4 shrink-0"
              />
            </template>
          </USelect>
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
