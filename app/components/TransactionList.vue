<script setup lang="ts">
import { parseDate } from "@internationalized/date";

interface SelectItem { label: string; value: string; icon?: string }

const props = defineProps<{
  transactions: Transaction[];
  typeOptions: SelectItem[];
  getCategoryOptions: (type: string) => SelectItem[];
  formatAmount: (amount: number, currency?: string | null) => string;
  filterCategory: string;
  categories: SelectItem[];
  filterType: string;
  types: SelectItem[];
  filterDateFrom: string;
  filterDateTo: string;
  filterDatePreset: string;
  datePresetOptions: SelectItem[];
}>();

const emit = defineEmits<{
  (event: "update", payload: { id: number; input: TransactionInput }): void;
  (event: "delete", id: number): void;
  (event: "focus-form"): void;
  (event: "update:filterCategory", value: string): void;
  (event: "update:filterType", value: string): void;
  (event: "update:filterDateFrom", value: string): void;
  (event: "update:filterDateTo", value: string): void;
  (event: "update:filterDatePreset", value: string): void;
}>();

const editingId = ref<number | null>(null);
const editDateOpen = ref(false);
const rangeDateOpen = ref(false);
const editItem = ref({
  date: "",
  name: "",
  amount: null as number | null,
  currency: "",
  type: "expense",
  category: "",
});

const editCategoryOptions = computed(() => props.getCategoryOptions(editItem.value.type));

watch(() => editItem.value.type, (type) => {
  const opts = props.getCategoryOptions(type);
  if (!opts.some((o) => o.value === editItem.value.category)) {
    editItem.value.category = opts[0]?.value ?? "";
  }
});
const totalAmount = computed(() =>
  props.transactions.reduce((sum, item) => {
    const abs = Math.abs(item.amount ?? 0);
    return sum + (item.type === "income" ? abs : -abs);
  }, 0),
);
const hasTransactions = computed(() => props.transactions.length > 0);
const safeParseDate = (value: string) => {
  try {
    return value ? parseDate(value) : undefined;
  } catch {
    return undefined;
  }
};
const editDateValue = computed({
  get: () => safeParseDate(editItem.value.date),
  set: (value) => {
    editItem.value.date = value ? value.toString() : "";
  },
});
const dateRangeValue = computed({
  get: () => ({
    start: safeParseDate(props.filterDateFrom),
    end: safeParseDate(props.filterDateTo),
  }),
  set: (value) => {
    emit(
      "update:filterDateFrom",
      value?.start ? value.start.toString() : "",
    );
    emit(
      "update:filterDateTo",
      value?.end ? value.end.toString() : "",
    );
  },
});

const startEdit = (item: Transaction) => {
  editingId.value = item.id;
  editItem.value = {
    date: item.date,
    name: item.name,
    amount: item.amount,
    currency: item.currency ?? "",
    type: item.type ?? "other",
    category: item.category ?? "other",
  };
};

const formatDate = (iso: string) => {
  if (!iso) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

const cancelEdit = () => {
  editingId.value = null;
};

const submitEdit = (id: number) => {
  emit("update", {
    id,
    input: {
      date: editItem.value.date,
      name: editItem.value.name,
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
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-white">{{ $t('transactions.listTitle') }}</h2>
        <p class="mt-1 text-sm text-slate-300">{{ $t('transactions.listDesc') }}</p>
      </div>
      <div class="rounded-2xl bg-white/5 px-4 py-2 text-right">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ $t('transactions.netTotal') }}</p>
        <p
          class="text-lg font-semibold"
          :class="totalAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'"
        >
          {{ formatAmount(totalAmount) }}
        </p>
      </div>
    </div>
    <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
      <div class="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-3">
        <UFormField
          :label="$t('transactions.filterCategory')"
          :help="$t('transactions.filterCategoryHelp')"
          class="w-full"
        >
          <USelect
            :model-value="filterCategory"
            :items="categories"
            :leading-icon="categories.find(o => o.value === filterCategory)?.icon"
            class="w-full"
            @update:model-value="emit('update:filterCategory', $event as string)"
          />
        </UFormField>
        <UFormField :label="$t('transactions.filterType')" :help="$t('transactions.filterTypeHelp')">
          <USelect
            :model-value="filterType"
            :items="types"
            :leading-icon="types.find(o => o.value === filterType)?.icon"
            class="w-full"
            @update:model-value="emit('update:filterType', $event as string)"
          />
        </UFormField>
        <UFormField :label="$t('transactions.datePreset')" :help="$t('transactions.datePresetHelp')">
          <USelect
            :model-value="filterDatePreset"
            :items="datePresetOptions"
            class="w-full"
            @update:model-value="emit('update:filterDatePreset', $event as string)"
          />
        </UFormField>
        <div v-if="filterDatePreset === 'custom'" class="md:col-span-2 xl:col-span-4">
          <UFormField :label="$t('transactions.dateRange')">
            <UPopover v-model:open="rangeDateOpen" :content="{ side: 'bottom', sideOffset: 8 }">
              <template #anchor>
                <UInputDate v-model="dateRangeValue" range locale="cs" class="w-full">
                  <template #trailing>
                    <UButton
                      icon="i-heroicons-calendar-days"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      @click="rangeDateOpen = !rangeDateOpen"
                    />
                  </template>
                </UInputDate>
              </template>
              <template #content>
                <UCalendar v-model="dateRangeValue" range />
              </template>
            </UPopover>
          </UFormField>
        </div>
      </div>
      <div class="text-sm text-slate-400">
        {{ transactions.length }} {{ $t('transactions.shown') }}
      </div>
    </div>
    <div class="mt-4 space-y-3">
      <UCard
        v-if="hasTransactions"
        v-for="item in transactions"
        :key="item.id"
        class="surface-panel"
      >
        <template v-if="editingId === item.id">
          <div class="grid gap-3 md:grid-cols-2">
            <UFormField :label="$t('form.date')">
              <UPopover v-model:open="editDateOpen" :content="{ side: 'bottom', sideOffset: 8 }">
                <template #anchor>
                  <UInputDate v-model="editDateValue" locale="cs">
                    <template #trailing>
                      <UButton
                        icon="i-heroicons-calendar-days"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        @click="editDateOpen = !editDateOpen"
                      />
                    </template>
                  </UInputDate>
                </template>
                <template #content>
                  <UCalendar v-model="editDateValue" />
                </template>
              </UPopover>
            </UFormField>
            <UFormField :label="$t('form.name')">
              <UInput v-model="editItem.name" />
            </UFormField>
            <UFormField :label="$t('form.amount')">
              <UInputNumber v-model="editItem.amount" :step="0.01" />
            </UFormField>
            <UFormField :label="$t('form.currency')">
              <UInput v-model="editItem.currency" />
            </UFormField>
            <UFormField :label="$t('form.type')">
              <USelect
                v-model="editItem.type"
                :items="typeOptions"
                :leading-icon="typeOptions.find(o => o.value === editItem.type)?.icon"
              />
            </UFormField>
            <UFormField :label="$t('form.category')">
              <USelect
                v-model="editItem.category"
                :items="editCategoryOptions"
                :leading-icon="editCategoryOptions.find(o => o.value === editItem.category)?.icon"
              />
            </UFormField>
          </div>
          <div class="mt-3 flex gap-2">
            <UButton color="primary" variant="solid" @click="submitEdit(item.id)">
              {{ $t('transactions.saveChanges') }}
            </UButton>
            <UButton variant="outline" color="neutral" @click="cancelEdit">
              {{ $t('common.cancel') }}
            </UButton>
          </div>
        </template>
        <template v-else>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {{ formatDate(item.date) }}
              </p>
              <p class="mt-1 text-sm font-semibold text-white">
                {{ item.name }}
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
                :class="item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'"
              >
                {{ item.type === 'income' ? '' : '-' }}{{ formatAmount(Math.abs(item.amount), item.currency) }}
              </p>
              <div class="mt-2 flex items-center justify-end gap-2">
                <UButton size="sm" variant="outline" color="neutral" @click="startEdit(item)">
                  {{ $t('common.edit') }}
                </UButton>
                <UButton
                  size="sm"
                  color="error"
                  variant="subtle"
                  @click="emit('delete', item.id)"
                >
                  {{ $t('common.delete') }}
                </UButton>
              </div>
            </div>
          </div>
        </template>
      </UCard>
      <UCard v-else class="surface-panel border border-dashed border-white/10">
        <div class="flex flex-col items-start gap-3">
          <div>
            <p class="text-sm font-semibold text-white">{{ $t('transactions.emptyTitle') }}</p>
            <p class="mt-1 text-sm text-slate-400">{{ $t('transactions.emptyDesc') }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton color="primary" variant="solid" to="/import">
              {{ $t('transactions.importCsv') }}
            </UButton>
            <UButton variant="outline" color="neutral" @click="$emit('focus-form')">
              {{ $t('transactions.addManually') }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </UCard>
</template>
