<script setup lang="ts">
import { computed, ref } from "vue";
import { parseDate } from "@internationalized/date";

const props = defineProps<{
  transactions: Transaction[];
  typeOptions: string[];
  categoryOptions: string[];
  formatAmount: (amount: number, currency?: string | null) => string;
  filterCategory: string;
  categories: string[];
  filterType: string;
  types: string[];
  filterDateFrom: string;
  filterDateTo: string;
  filterDatePreset: string;
  datePresetOptions: { label: string; value: string }[];
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
  description: "",
  amount: null as number | null,
  currency: "",
  type: "other",
  category: "other",
});
const totalAmount = computed(() =>
  props.transactions.reduce((sum, item) => sum + (item.amount ?? 0), 0),
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
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-white">Transactions</h2>
        <p class="mt-1 text-sm text-slate-300">
          Review, edit, or clean up entries from imports and manual adds.
        </p>
      </div>
      <div class="rounded-2xl bg-white/5 px-4 py-2 text-right">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Net total</p>
        <p
          class="text-lg font-semibold"
          :class="totalAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'"
        >
          {{ formatAmount(totalAmount) }}
        </p>
      </div>
    </div>
    <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
      <div class="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-3">
        <UFormField
          label="Filter by category"
          help="Narrow the list to a single spending category."
          class="w-full"
        >
          <USelect
            :model-value="filterCategory"
            :items="categories"
            class="w-full"
            @update:model-value="emit('update:filterCategory', $event as string)"
          />
        </UFormField>
        <UFormField label="Filter by type" help="Show only a single transaction type.">
          <USelect
            :model-value="filterType"
            :items="types"
            class="w-full"
            @update:model-value="emit('update:filterType', $event as string)"
          />
        </UFormField>
        <UFormField label="Date preset" help="Quickly scope a common range.">
          <USelect
            :model-value="filterDatePreset"
            :items="datePresetOptions"
            class="w-full"
            @update:model-value="emit('update:filterDatePreset', $event as string)"
          />
        </UFormField>
        <div v-if="filterDatePreset === 'custom'" class="md:col-span-2 xl:col-span-4">
          <UFormField label="Date range">
            <UPopover v-model:open="rangeDateOpen" :content="{ side: 'bottom', sideOffset: 8 }">
              <template #anchor>
                <UInputDate v-model="dateRangeValue" range class="w-full">
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
        {{ transactions.length }} entries shown
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
            <UFormField label="Date">
              <UPopover v-model:open="editDateOpen" :content="{ side: 'bottom', sideOffset: 8 }">
                <template #anchor>
                  <UInputDate v-model="editDateValue">
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
              Save changes
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
      <UCard v-else class="surface-panel border border-dashed border-white/10">
        <div class="flex flex-col items-start gap-3">
          <div>
            <p class="text-sm font-semibold text-white">No transactions yet</p>
            <p class="mt-1 text-sm text-slate-400">
              Import a CSV for bulk entries or add a manual transaction.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton color="primary" variant="solid" to="/import">
              Import CSV
            </UButton>
            <UButton variant="outline" color="neutral" @click="$emit('focus-form')">
              Add manually
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </UCard>
</template>
