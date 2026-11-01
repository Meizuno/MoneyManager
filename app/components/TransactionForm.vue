<script setup lang="ts">
import { parseDate } from "@internationalized/date";
import type { RecurringTransaction } from "#shared/schemas/recurring";
import type { CategorySuggestion, Transaction, TransactionType } from "#shared/schemas/transaction";
import { RECURRENCE_UNITS, type RecurrenceUnit } from "#shared/utils/recurrence";

// The add/edit form inside TransactionEditor. The amount comes first and
// large, the category is one tap on a chip, the date defaults to today.
// An empty name takes the category's — the API requires one, and "Groceries
// 450" is most of what a quick entry needs.
//
// A new entry needs no category picked. Left alone, it goes where the last
// entry of the same name went, or to the default (the server's
// suggest-category, the same rule its create runs), and the chip it will go
// to is outlined with why, so nothing is filed out of sight. A tap picks a
// category outright; a tap on the picked one hands it back to that rule.
//
// A new entry can repeat — every N days, weeks, months or years from its
// date, until a date or for good — and is then saved as a recurring
// transaction, which the server writes on each date. Opened on one
// (`recurring`), the form changes what it writes from now on, pauses it, or
// deletes it; its schedule is shown, not edited.
const props = defineProps<{
  transaction: Transaction | null;
  recurring?: RecurringTransaction | null;
  type: TransactionType;
}>();
const emit = defineEmits<{ done: [] }>();

const { categoriesFor, ensureLoaded } = useCategories();
const { createTransaction, updateTransaction, deleteTransaction } = useTransactions();
const { createRecurring, updateRecurring, deleteRecurring, scheduleLabel } = useRecurring();
const { apiFetch } = useAuth();

const rule = props.recurring ?? null;
// Something that exists already: nothing is suggested for it, and it can be
// deleted.
const editing = props.transaction !== null || rule !== null;
const today = localDay();
const yesterday = previousDay(today);

const form = reactive({
  type: props.transaction?.type ?? rule?.type ?? props.type,
  amount: (props.transaction?.amount ?? rule?.amount)?.toFixed(2) ?? "",
  currency: props.transaction?.currency ?? rule?.currency ?? "CZK",
  name: props.transaction?.name ?? rule?.name ?? "",
  category: props.transaction?.category.id ?? rule?.category.id ?? null as number | null,
  date: props.transaction?.date ?? rule?.start_date ?? today,
  repeat: (rule?.unit ?? "none") as "none" | RecurrenceUnit,
  every: String(rule?.every ?? 1),
  until: rule?.end_date ?? null as string | null,
  paused: rule?.paused ?? false,
});
const repeating = computed(() => form.repeat !== "none");
const every = computed(() => {
  const n = Number(form.every);
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null;
});

const categories = computed(() => categoriesFor(form.type));
const chosen = computed(() => categories.value.find(c => c.id === form.category));
watch(() => form.type, () => {
  if (!chosen.value) form.category = null;
});

// What an unpicked category would be, for the type and name as they stand.
// `suggestedFor` is the type and name the answer was given for, so a stale
// one is never shown against a name that has since changed.
const suggestion = ref<CategorySuggestion["category"]>(null);
const suggestedFor = ref<string | null>(null);
const asked = computed(() => `${form.type}|${form.name.trim().toLowerCase()}`);
const settled = computed(() => suggestedFor.value === asked.value);
const auto = computed(() => {
  if (editing || form.category !== null || !settled.value || !suggestion.value) return undefined;
  const id = suggestion.value.id;
  return categories.value.find(c => c.id === id);
});
// Nothing picked, and the rule has nothing to offer either.
const needsChoice = computed(() => !editing && !chosen.value && settled.value && !auto.value);

let asking: ReturnType<typeof setTimeout> | undefined;
let latest = 0;
async function suggest() {
  clearTimeout(asking);
  const question = asked.value;
  const mine = ++latest;
  let answer: CategorySuggestion["category"] = null;
  try {
    answer = (await apiFetch<CategorySuggestion>("/api/transactions/suggest-category", {
      query: { type: form.type, name: form.name.trim() },
    })).category;
  }
  catch { /* no suggestion: a category has to be picked */ }
  if (mine !== latest) return;
  suggestion.value = answer;
  suggestedFor.value = question;
}
watch(asked, () => {
  if (editing || form.category !== null) return;
  clearTimeout(asking);
  asking = setTimeout(() => void suggest(), 250);
});

function pick(id: number) {
  // The picked chip again: back to the rule, on a new entry. An edit keeps
  // the category it has — nothing is looked up for one.
  if (form.category === id && !editing) {
    form.category = null;
    if (!settled.value) void suggest();
    return;
  }
  form.category = id;
}

const amount = computed(() => parseAmount(form.amount));
// Unsettled counts as fine: save waits for the answer rather than the
// button going dead for a moment after every keystroke in the name.
const valid = computed(() => amount.value !== null && amount.value > 0 && Boolean(form.date)
  && (chosen.value !== undefined || auto.value !== undefined || (!editing && !settled.value))
  && (!repeating.value || (every.value !== null && (!form.until || form.until >= form.date))));

// The end date's calendar, and the repeat's own words for the schedule.
const untilOpen = ref(false);
const untilDate = computed({
  get: () => {
    try {
      return form.until ? parseDate(form.until) : undefined;
    }
    catch {
      return undefined;
    }
  },
  set: (value) => {
    if (!value) return;
    form.until = value.toString();
    untilOpen.value = false;
  },
});
const untilMin = computed(() => {
  try {
    return parseDate(form.date);
  }
  catch {
    return undefined;
  }
});
const schedule = computed(() => (repeating.value && every.value !== null
  ? scheduleLabel(form.repeat as RecurrenceUnit, every.value)
  : ""));

const calendarOpen = ref(false);
const calendarDate = computed({
  get: () => {
    try {
      return parseDate(form.date);
    }
    catch {
      return undefined;
    }
  },
  set: (value) => {
    if (!value) return;
    form.date = value.toString();
    calendarOpen.value = false;
  },
});
const otherDay = computed(() => form.date !== today && form.date !== yesterday);

// A new entry starts at the amount; an edit leaves the keyboard closed.
// Deferred: the dialog places its own focus once it has opened, and would
// otherwise take it straight back.
const amountField = ref<HTMLInputElement | null>(null);
onMounted(() => {
  void ensureLoaded();
  if (!editing) {
    void suggest();
    setTimeout(() => amountField.value?.focus(), 50);
  }
});
onBeforeUnmount(() => clearTimeout(asking));

const saving = ref(false);
async function save() {
  if (!valid.value || saving.value) return;
  saving.value = true;
  if (!chosen.value && !settled.value) await suggest();
  const category = chosen.value ?? auto.value;
  if (!category) {
    saving.value = false;
    return;
  }
  const input = {
    date: form.date,
    name: form.name.trim() || category.label,
    amount: amount.value!,
    currency: form.currency.trim().toUpperCase() || "CZK",
    type: form.type,
    category: category.id,
  };
  let ok: boolean;
  if (rule) {
    ok = await updateRecurring(rule.id, {
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      end_date: form.until,
      paused: form.paused,
    });
  }
  else if (repeating.value && !props.transaction) {
    ok = await createRecurring({
      type: input.type,
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      unit: form.repeat as RecurrenceUnit,
      every: every.value!,
      start_date: form.date,
      end_date: form.until,
    });
  }
  else {
    ok = props.transaction
      ? await updateTransaction(props.transaction.id, input)
      : await createTransaction(input);
  }
  saving.value = false;
  if (ok) emit("done");
}

// Deleting takes two clicks: the first arms the button for a few seconds.
const armed = ref(false);
let disarm: ReturnType<typeof setTimeout> | undefined;
async function remove() {
  if (!props.transaction && !rule) return;
  if (!armed.value) {
    armed.value = true;
    disarm = setTimeout(() => (armed.value = false), 3000);
    return;
  }
  clearTimeout(disarm);
  saving.value = true;
  const ok = rule ? await deleteRecurring(rule.id) : await deleteTransaction(props.transaction!.id);
  saving.value = false;
  if (ok) emit("done");
}
onBeforeUnmount(() => clearTimeout(disarm));

const TYPES = [
  { value: "expense", icon: "i-heroicons-arrow-trending-down" },
  { value: "income", icon: "i-heroicons-arrow-trending-up" },
] as const;
const REPEATS = ["none", ...RECURRENCE_UNITS] as const;
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="save">
    <!-- Expense / income -->
    <div class="grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1" role="radiogroup" :aria-label="$t('form.type')">
      <button
        v-for="option in TYPES"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="form.type === option.value"
        :disabled="rule !== null && form.type !== option.value"
        class="flex cursor-pointer items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
        :class="form.type === option.value
          ? 'bg-default text-highlighted shadow-sm'
          : 'text-muted hover:text-highlighted'"
        @click="form.type = option.value"
      >
        <UIcon
          :name="option.icon"
          class="size-4"
          :class="form.type === option.value ? (option.value === 'income' ? 'text-emerald-500' : 'text-rose-500') : ''"
        />
        {{ $t(`types.${option.value}`) }}
      </button>
    </div>

    <!-- Amount, with the currency beside it -->
    <label class="flex items-center gap-3 rounded-2xl border border-default bg-default px-4 py-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <input
        ref="amountField"
        v-model="form.amount"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0.00"
        :aria-label="$t('form.amount')"
        class="min-w-0 flex-1 bg-transparent font-display text-3xl font-semibold tabular-nums text-highlighted outline-none placeholder:text-dimmed"
      >
      <input
        v-model="form.currency"
        maxlength="3"
        autocomplete="off"
        :aria-label="$t('form.currency')"
        class="w-12 bg-transparent text-right text-sm font-semibold uppercase text-muted outline-none"
      >
    </label>

    <!-- Category -->
    <div>
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-medium text-default">{{ $t('form.category') }}</span>
        <NuxtLink to="/categories" class="text-xs font-medium text-primary hover:underline" @click="emit('done')">
          {{ $t('form.manageCategories') }}
        </NuxtLink>
      </div>
      <div v-if="categories.length" class="flex flex-wrap gap-2">
        <button
          v-for="category in categories"
          :key="category.id"
          type="button"
          :aria-pressed="form.category === category.id"
          class="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition"
          :class="form.category === category.id
            ? 'font-medium text-highlighted'
            : auto?.id === category.id
              ? 'border-dashed font-medium text-highlighted'
              : 'border-default text-default hover:bg-elevated'"
          :style="form.category === category.id
            ? { backgroundColor: `${categoryHex(category.color)}26`, borderColor: categoryHex(category.color) }
            : auto?.id === category.id
              ? { borderColor: categoryHex(category.color) }
              : {}"
          @click="pick(category.id)"
        >
          <span class="size-2 rounded-full" :style="{ backgroundColor: categoryHex(category.color) }" />
          {{ category.label }}
          <span
            v-if="auto?.id === category.id && suggestion"
            class="-mr-1 rounded-full bg-elevated px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted"
          >{{ $t(suggestion.source === 'previous' ? 'form.autoPrevious' : 'form.autoDefault') }}</span>
        </button>
      </div>
      <p v-else class="text-sm text-muted">
        {{ $t(form.type === 'income' ? 'form.noIncomeCategories' : 'form.noExpenseCategories') }}
      </p>
      <p v-if="categories.length && needsChoice && form.name.trim()" class="mt-2 text-xs text-warning">
        {{ $t('form.chooseCategory') }}
      </p>
      <p v-else-if="categories.length && !editing && !chosen" class="mt-2 text-xs text-muted">
        {{ $t('form.autoHint') }}
      </p>
    </div>

    <!-- Name -->
    <UFormField :label="$t('form.name')" :hint="$t('form.optional')">
      <UInput
        v-model="form.name"
        :placeholder="chosen?.label ?? auto?.label ?? $t('form.namePlaceholder')"
        size="lg"
        class="w-full"
      />
    </UFormField>

    <!-- Date: when it happened, or when a repeat starts. A recurring
         transaction's start is fixed, so its form has none. -->
    <div v-if="!rule">
      <span class="mb-2 block text-sm font-medium text-default">{{ $t(repeating ? 'form.starts' : 'form.date') }}</span>
      <div class="flex flex-wrap gap-2">
        <UButton
          size="sm"
          :color="form.date === today ? 'primary' : 'neutral'"
          :variant="form.date === today ? 'soft' : 'outline'"
          @click="form.date = today"
        >
          {{ $t('form.today') }}
        </UButton>
        <UButton
          size="sm"
          :color="form.date === yesterday ? 'primary' : 'neutral'"
          :variant="form.date === yesterday ? 'soft' : 'outline'"
          @click="form.date = yesterday"
        >
          {{ $t('form.yesterday') }}
        </UButton>
        <UPopover v-model:open="calendarOpen">
          <UButton
            size="sm"
            icon="i-heroicons-calendar-days"
            :color="otherDay ? 'primary' : 'neutral'"
            :variant="otherDay ? 'soft' : 'outline'"
          >
            {{ otherDay ? shortDay(form.date) : $t('form.otherDay') }}
          </UButton>
          <template #content>
            <UCalendar v-model="calendarDate" locale="en-GB" class="p-2" />
          </template>
        </UPopover>
      </div>
    </div>

    <!-- Repeat: on a new entry, never or every N units; on a recurring one,
         its schedule, its end and whether it is running. An edit of a
         single transaction has none — that is one occurrence. -->
    <div v-if="!transaction">
      <span class="mb-2 block text-sm font-medium text-default">{{ $t('form.repeat') }}</span>
      <div v-if="!rule" class="flex flex-wrap gap-2">
        <UButton
          v-for="option in REPEATS"
          :key="option"
          size="sm"
          :color="form.repeat === option ? 'primary' : 'neutral'"
          :variant="form.repeat === option ? 'soft' : 'outline'"
          @click="form.repeat = option"
        >
          {{ $t(`form.repeats.${option}`) }}
        </UButton>
      </div>
      <p v-else class="flex items-center gap-2 text-sm text-default">
        <UIcon name="i-heroicons-arrow-path" class="size-4 text-muted" />
        {{ scheduleLabel(rule.unit, rule.every) }} · {{ $t('form.from', { date: shortDay(rule.start_date) }) }}
      </p>

      <div v-if="repeating" class="mt-3 flex flex-col gap-3 rounded-2xl border border-default p-3">
        <label v-if="!rule" class="flex items-center gap-2 text-sm text-default">
          {{ $t('form.every') }}
          <input
            v-model="form.every"
            inputmode="numeric"
            maxlength="3"
            :aria-label="$t('form.every')"
            class="w-12 rounded-lg border border-default bg-default px-2 py-1 text-center tabular-nums text-highlighted outline-none focus:border-primary"
          >
          {{ $t(`recurring.units.${form.repeat}`, every ?? 1) }}
          <span v-if="schedule" class="ml-auto text-xs text-muted">{{ schedule }}</span>
        </label>

        <div class="flex items-center gap-2 text-sm text-default">
          <span>{{ $t('form.until') }}</span>
          <UPopover v-model:open="untilOpen">
            <UButton size="sm" color="neutral" variant="outline" icon="i-heroicons-calendar-days">
              {{ form.until ? shortDay(form.until) : $t('form.noEnd') }}
            </UButton>
            <template #content>
              <UCalendar v-model="untilDate" :min-value="untilMin" locale="en-GB" class="p-2" />
            </template>
          </UPopover>
          <UButton
            v-if="form.until"
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark"
            :aria-label="$t('form.noEnd')"
            @click="form.until = null"
          />
        </div>

        <USwitch v-if="rule" v-model="form.paused" :label="$t('form.paused')" :description="$t('form.pausedHint')" />
        <p v-else class="text-xs text-muted">{{ $t('form.repeatHint') }}</p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 pt-1">
      <UButton
        v-if="editing"
        color="error"
        :variant="armed ? 'soft' : 'ghost'"
        size="lg"
        :icon="armed ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-trash'"
        :disabled="saving"
        @click="remove"
      >
        {{ armed ? $t('form.confirmDelete') : $t('common.delete') }}
      </UButton>
      <UButton type="submit" size="lg" block class="flex-1" :disabled="!valid" :loading="saving">
        {{ editing
          ? $t('form.saveChanges')
          : repeating
            ? $t(form.type === 'income' ? 'form.addRecurringIncome' : 'form.addRecurringExpense')
            : $t(form.type === 'income' ? 'form.addIncome' : 'form.addExpense') }}
      </UButton>
    </div>
  </form>
</template>
