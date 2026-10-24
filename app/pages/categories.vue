<script setup lang="ts">
import { useSortable } from "@vueuse/integrations/useSortable";
import type { TransactionSummary } from "#shared/schemas/transaction";
import type { IncomeCategory, SplitRule } from "~/composables/useCategories";
import { currentMonth, periodLabel, periodRange } from "~/utils/period";

// The budget plan: what share of each month's income every expense
// category gets (the overview measures spending against it), and the
// categories income is filed under. Edits save as you type; the grip
// reorders.
const { t } = useI18n();
const toast = useToast();
const { apiFetch } = useAuth();
useHead({ title: t("plan.pageTitle") });

const {
  splitRules: rules,
  incomeCategories: categories,
  savingRule,
  savingCategory,
  ensureSplitRules,
  ensureIncomeCategories,
  addRule,
  updateRule,
  removeRule,
  reorderRules,
  addCategory,
  updateCategory,
  removeCategory,
  reorderCategories,
} = useCategories();

// This month's income turns the percentages into amounts.
const month = currentMonth();
const { data: summary } = await useAsyncData(
  "plan-income",
  () => apiFetch<TransactionSummary>("/api/transactions/summary", { query: periodRange(month) }),
);
await Promise.all([ensureSplitRules(), ensureIncomeCategories()]);

const income = computed(() => summary.value?.income ?? 0);
const amountOf = (percent: number) => formatMoney((income.value * Number(percent)) / 100, null, false);
const totalPercent = computed(() => rules.value.reduce((s, r) => s + Number(r.percent), 0));
const overLimit = computed(() => totalPercent.value > 100);

// Label and percent edits go to the server after a short pause; the
// v-model has already updated the shared cache.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function later(key: string, save: () => Promise<unknown>) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => void save().catch(() => failed("plan.toast.saveError")), 600));
}
const onRuleInput = (rule: SplitRule) => later(`rule:${rule.id}`, () => updateRule(rule));
const onCategoryInput = (category: IncomeCategory) => later(`category:${category.id}`, () => updateCategory(category));

function failed(title: string, error?: unknown) {
  const message = (error as { data?: { message?: string } } | undefined)?.data?.message;
  toast.add({ title: t(title), description: message, color: "error", icon: "i-heroicons-exclamation-triangle" });
}

// A category still used by transactions can't go; the server says so.
async function remove(kind: "rule" | "category", id: number) {
  try {
    await (kind === "rule" ? removeRule(id) : removeCategory(id));
  }
  catch (error) {
    failed("plan.toast.deleteError", error);
  }
}
async function add(kind: "rule" | "category") {
  try {
    await (kind === "rule" ? addRule() : addCategory());
  }
  catch (error) {
    failed("plan.toast.addError", error);
  }
}

// Drag to reorder (SortableJS): only the grip drags, so the inputs stay
// selectable. useSortable reorders the array in place; the new order is
// saved once that has settled.
const rulesEl = ref<HTMLElement | null>(null);
useSortable(rulesEl, rules, {
  handle: ".drag-handle",
  animation: 150,
  onUpdate: async () => {
    await nextTick();
    void reorderRules(rules.value.map(r => r.id));
  },
});
const categoriesEl = ref<HTMLElement | null>(null);
useSortable(categoriesEl, categories, {
  handle: ".drag-handle",
  animation: 150,
  onUpdate: async () => {
    await nextTick();
    void reorderCategories(categories.value.map(c => c.id));
  },
});
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6">
    <div>
      <h1 class="font-display text-2xl font-semibold tracking-tight text-highlighted">{{ $t('plan.title') }}</h1>
      <p class="mt-1 max-w-2xl text-sm text-muted">{{ $t('plan.description') }}</p>
    </div>

    <!-- How the income is split -->
    <section class="panel p-5 sm:p-6">
      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p class="text-sm font-medium text-muted">{{ $t('plan.allocated') }}</p>
          <p class="font-display text-3xl font-semibold" :class="overLimit ? 'text-rose-600 dark:text-rose-400' : 'text-highlighted'">
            {{ totalPercent }}%
            <span v-if="totalPercent < 100" class="text-base font-medium text-muted">
              · {{ $t('plan.unallocated', { percent: 100 - totalPercent }) }}
            </span>
          </p>
        </div>
        <p class="text-sm text-muted">
          {{ income > 0
            ? $t('plan.basedOn', { month: periodLabel(month).split(' ')[0], amount: formatMoney(income, null, false) })
            : $t('plan.noIncomeYet') }}
        </p>
      </div>
      <div class="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-elevated">
        <div
          v-for="rule in rules"
          :key="rule.id"
          class="h-full transition-[width] duration-300 first:rounded-l-full"
          :style="{ width: `${Math.min(Number(rule.percent), 100)}%`, backgroundColor: categoryHex(rule.color) }"
          :title="`${rule.label}: ${rule.percent}%`"
        />
      </div>
      <UAlert
        v-if="overLimit"
        class="mt-4"
        color="error"
        variant="subtle"
        icon="i-heroicons-exclamation-triangle"
        :title="$t('plan.overLimitTitle')"
        :description="$t('plan.overLimitDesc', { percent: totalPercent - 100 })"
      />
    </section>

    <div class="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <!-- Expense categories: each one's share -->
      <section class="panel p-5 sm:p-6">
        <header class="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('plan.expenseTitle') }}</h2>
            <p class="text-sm text-muted">{{ $t('plan.expenseDesc') }}</p>
          </div>
          <UButton icon="i-heroicons-plus" color="neutral" variant="outline" size="sm" :loading="savingRule" @click="add('rule')">
            {{ $t('common.add') }}
          </UButton>
        </header>

        <p v-if="rules.length === 0" class="rounded-xl border border-dashed border-default p-6 text-center text-sm text-muted">
          {{ $t('plan.noExpense') }}
        </p>
        <ul v-else ref="rulesEl" class="-mx-2 flex flex-col">
          <li v-for="rule in rules" :key="rule.id" class="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-elevated/50">
            <span class="drag-handle cursor-grab text-dimmed active:cursor-grabbing" :title="$t('plan.drag')">
              <UIcon name="i-lucide-grip-vertical" class="size-4" />
            </span>
            <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: categoryHex(rule.color) }" />
            <input
              v-model="rule.label"
              type="text"
              class="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm font-medium text-highlighted outline-none focus:bg-elevated"
              :placeholder="$t('plan.expensePlaceholder')"
              :aria-label="$t('plan.name')"
              @input="onRuleInput(rule)"
            >
            <label class="flex items-center rounded-lg border border-default bg-default px-2 focus-within:border-primary">
              <input
                v-model.number="rule.percent"
                type="number"
                min="0"
                max="100"
                step="1"
                class="w-10 bg-transparent py-1 text-right text-sm tabular-nums text-highlighted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                :aria-label="$t('plan.percent')"
                @input="onRuleInput(rule)"
              >
              <span class="text-xs text-muted">%</span>
            </label>
            <span class="hidden w-24 shrink-0 text-right text-sm tabular-nums text-muted sm:block">
              {{ income > 0 ? amountOf(rule.percent) : '—' }}
            </span>
            <UButton
              icon="i-heroicons-trash"
              color="neutral"
              variant="ghost"
              size="xs"
              class="opacity-60 group-hover:opacity-100 hover:text-error"
              :aria-label="$t('common.delete')"
              @click="remove('rule', rule.id)"
            />
          </li>
        </ul>
      </section>

      <!-- Income categories -->
      <section class="panel p-5 sm:p-6">
        <header class="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('plan.incomeTitle') }}</h2>
            <p class="text-sm text-muted">{{ $t('plan.incomeDesc') }}</p>
          </div>
          <UButton icon="i-heroicons-plus" color="neutral" variant="outline" size="sm" :loading="savingCategory" @click="add('category')">
            {{ $t('common.add') }}
          </UButton>
        </header>

        <p v-if="categories.length === 0" class="rounded-xl border border-dashed border-default p-6 text-center text-sm text-muted">
          {{ $t('plan.noIncomeCategories') }}
        </p>
        <ul v-else ref="categoriesEl" class="-mx-2 flex flex-col">
          <li v-for="category in categories" :key="category.id" class="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-elevated/50">
            <span class="drag-handle cursor-grab text-dimmed active:cursor-grabbing" :title="$t('plan.drag')">
              <UIcon name="i-lucide-grip-vertical" class="size-4" />
            </span>
            <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: categoryHex(category.color) }" />
            <input
              v-model="category.label"
              type="text"
              class="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm font-medium text-highlighted outline-none focus:bg-elevated"
              :placeholder="$t('plan.incomePlaceholder')"
              :aria-label="$t('plan.name')"
              @input="onCategoryInput(category)"
            >
            <UButton
              icon="i-heroicons-trash"
              color="neutral"
              variant="ghost"
              size="xs"
              class="opacity-60 group-hover:opacity-100 hover:text-error"
              :aria-label="$t('common.delete')"
              @click="remove('category', category.id)"
            />
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
