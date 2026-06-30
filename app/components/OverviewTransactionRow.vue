<script setup lang="ts">
import { parseDate } from "@internationalized/date";
import type { Transaction, UpdateTransactionPayload } from "#shared/schemas/transaction";

// A single transaction row, used by both of the overview's views:
// the category-grouped drill-down and the flat chronological list. It
// owns its own display/edit toggle so each row edits independently —
// the parent only hears about committed changes (update) and deletes.
interface SelectItem { label: string; value: string; icon?: string }

const props = defineProps<{
  transaction: Transaction;
  typeOptions: SelectItem[];
  getCategoryOptions: (type: string) => SelectItem[];
  // When provided, a coloured category chip is shown before the name
  // (flat-list view, where the category isn't implied by a heading).
  categoryLabel?: string;
  categoryColor?: string;
}>();

const emit = defineEmits<{
  (event: "update", payload: { id: number; input: UpdateTransactionPayload }): void;
  (event: "delete", id: number): void;
}>();

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (iso: string) => {
  if (!iso) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};
const safeParseDate = (value: string) => {
  try {
    return value ? parseDate(value) : undefined;
  } catch {
    return undefined;
  }
};

const editing = ref(false);
const editDateOpen = ref(false);
const editItem = ref({
  date: "", name: "", amount: null as number | null, currency: "", type: "expense", category: "",
});
const editCategoryOptions = computed(() => props.getCategoryOptions(editItem.value.type));
watch(() => editItem.value.type, (type) => {
  const opts = props.getCategoryOptions(type);
  if (!opts.some(o => o.value === editItem.value.category)) {
    editItem.value.category = opts[0]?.value ?? "";
  }
});
const editDateValue = computed({
  get: () => safeParseDate(editItem.value.date),
  set: (value) => { editItem.value.date = value ? value.toString() : ""; },
});

const startEdit = () => {
  const tx = props.transaction;
  editItem.value = {
    date: tx.date,
    name: tx.name,
    amount: tx.amount,
    currency: tx.currency ?? "",
    type: tx.type ?? "expense",
    category: tx.category.id ? String(tx.category.id) : "",
  };
  editing.value = true;
};
const cancelEdit = () => { editing.value = false; };
const submitEdit = () => {
  emit("update", {
    id: props.transaction.id,
    input: {
      date: editItem.value.date,
      name: editItem.value.name,
      amount: editItem.value.amount ?? "",
      currency: editItem.value.currency,
      type: editItem.value.type as "income" | "expense",
      category: editItem.value.category || undefined,
    },
  });
  editing.value = false;
};
</script>

<template>
  <!-- Inline edit -->
  <template v-if="editing">
    <div class="grid gap-2 sm:grid-cols-2">
      <UFormField :label="$t('form.date')" size="sm">
        <UPopover v-model:open="editDateOpen" :content="{ side: 'bottom', sideOffset: 8 }">
          <template #anchor>
            <UInputDate v-model="editDateValue" locale="cs" size="sm" class="w-full">
              <template #trailing>
                <UButton icon="i-heroicons-calendar-days" color="neutral" variant="ghost" size="xs" @click="editDateOpen = !editDateOpen" />
              </template>
            </UInputDate>
          </template>
          <template #content>
            <UCalendar v-model="editDateValue" locale="cs" />
          </template>
        </UPopover>
      </UFormField>
      <UFormField :label="$t('form.name')" size="sm">
        <UInput v-model="editItem.name" size="sm" class="w-full" />
      </UFormField>
      <UFormField :label="$t('form.amount')" size="sm">
        <UInputNumber v-model="editItem.amount" size="sm" class="w-full" :step="0.01" :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }" />
      </UFormField>
      <UFormField :label="$t('form.currency')" size="sm">
        <UInput v-model="editItem.currency" size="sm" class="w-full" />
      </UFormField>
      <UFormField :label="$t('form.type')" size="sm">
        <USelect v-model="editItem.type" :items="typeOptions" :leading-icon="typeOptions.find(o => o.value === editItem.type)?.icon" size="sm" class="w-full" />
      </UFormField>
      <UFormField :label="$t('form.category')" size="sm">
        <USelect v-model="editItem.category" :items="editCategoryOptions" :leading-icon="editCategoryOptions.find(o => o.value === editItem.category)?.icon" size="sm" class="w-full" />
      </UFormField>
    </div>
    <div class="mt-2 flex gap-2">
      <UButton color="primary" variant="solid" size="xs" @click="submitEdit">
        {{ $t('transactions.saveChanges') }}
      </UButton>
      <UButton variant="outline" color="neutral" size="xs" @click="cancelEdit">
        {{ $t('common.cancel') }}
      </UButton>
    </div>
  </template>
  <!-- Display -->
  <div v-else class="flex items-center gap-2 text-xs text-muted">
    <span class="shrink-0 text-dimmed">{{ formatDate(transaction.date) }}</span>
    <span
      v-if="categoryLabel"
      class="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-toned dark:bg-slate-800"
    >
      <span class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: categoryColor ?? '#94a3b8' }" />
      {{ categoryLabel }}
    </span>
    <span class="min-w-0 flex-1 truncate text-toned">{{ transaction.name }}</span>
    <span class="shrink-0 font-medium text-toned">{{ fmt(Math.abs(transaction.amount)) }}</span>
    <UButton icon="i-heroicons-pencil-square" color="neutral" variant="ghost" size="xs" :aria-label="$t('common.edit')" @click="startEdit" />
    <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs" :aria-label="$t('common.delete')" @click="emit('delete', transaction.id)" />
  </div>
</template>
