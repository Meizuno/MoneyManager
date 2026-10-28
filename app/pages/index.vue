<script setup lang="ts">
import type { OverviewResponse } from "#shared/schemas/overview";
import { addMonths } from "#shared/utils/months";
import { budgetRows, incomeRows, unallocated } from "~/utils/budget";
import { elapsedShare, isMonth, periodLabel } from "~/utils/period";

// The month's budget: what is left, each category against its plan, where
// the income came from, the last twelve months, and the latest entries.
// One request (/api/overview) per period, made during SSR.
definePageMeta({ period: "month" });
const { t } = useI18n();
const { apiFetch } = useAuth();
const { hydrate } = useCategories();
const { openNew } = useTransactionEditor();
const { period, range } = usePeriod();

const { data, status } = await useAsyncData(
  "overview",
  () => apiFetch<OverviewResponse>("/api/overview", { query: range.value }),
  { watch: [range] },
);

// The form's category chips read the same cache.
watch(data, (overview) => {
  if (overview) hydrate({ splitRules: overview.splitRules, incomeCategories: overview.incomeCategories });
}, { immediate: true });

const items = computed(() => data.value?.items ?? []);
const summary = computed(() => data.value?.summary ?? { income: 0, expenses: 0, net: 0, incomeCount: 0, expenseCount: 0 });
const budget = computed(() => budgetRows(data.value?.splitRules ?? [], items.value, summary.value.income));
const income = computed(() => incomeRows(data.value?.incomeCategories ?? [], items.value));
const spare = computed(() => unallocated(data.value?.splitRules ?? [], summary.value.income));
const elapsed = computed(() => elapsedShare(period.value));
const recent = computed(() => items.value.slice(0, 8));

// The month before, from the trend, for the "vs September" lines.
const previous = computed(() => {
  if (!isMonth(period.value)) return null;
  const month = addMonths(period.value, -1);
  const totals = data.value?.trend.find(m => m.month === month);
  if (!totals) return null;
  return { income: totals.income, expenses: totals.expenses, label: periodLabel(month).split(" ")[0]! };
});

function openMonth(month: string) {
  period.value = month;
}

onMounted(() => {
  const route = useRoute();
  if (route.query.auth === "forbidden") {
    useNotice().failed(t("auth.forbidden"), t("auth.forbiddenDesc"));
    navigateTo(route.path, { replace: true });
  }
});

useHead({ title: t("overview.pageTitle") });
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6" :class="{ 'opacity-60 transition-opacity': status === 'pending' }">
    <!-- On a phone it is in the header (layouts/default.vue). -->
    <div class="-ml-2 hidden items-center justify-between gap-3 sm:flex">
      <PeriodPicker />
    </div>

    <SummaryHero :income="summary.income" :expenses="summary.expenses" :previous="previous" />

    <div class="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div class="flex min-w-0 flex-col gap-4 sm:gap-6">
        <BudgetCard
          v-if="budget.length"
          :rows="budget"
          :period="period"
          :elapsed="elapsed"
          :unallocated="spare"
        />
        <section v-else class="panel p-6">
          <UEmpty
            icon="i-heroicons-chart-pie"
            :title="$t('budget.emptyTitle')"
            :description="$t('budget.emptyDesc')"
            :actions="[{ label: $t('budget.setUp'), to: '/categories', icon: 'i-heroicons-arrow-right' }]"
            variant="naked"
          />
        </section>

        <ClientOnly>
          <TrendChart v-if="data?.trend.length" :trend="data.trend" :selected="isMonth(period) ? period : null" @select="openMonth" />
          <template #fallback>
            <section class="panel h-80 p-6"><USkeleton class="h-full w-full" /></section>
          </template>
        </ClientOnly>
      </div>

      <div class="flex min-w-0 flex-col gap-4 sm:gap-6">
        <section class="panel p-5 sm:p-6">
          <header class="mb-3 flex items-center justify-between">
            <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('recent.title') }}</h2>
            <UButton
              v-if="items.length"
              :to="{ path: '/transactions', query: { period: period } }"
              color="neutral"
              variant="link"
              size="sm"
              trailing-icon="i-heroicons-arrow-right"
              class="px-0"
            >
              {{ $t('recent.all', { count: items.length }) }}
            </UButton>
          </header>
          <TransactionList v-if="recent.length" :transactions="recent" :day-totals="false" plain />
          <UEmpty
            v-else
            icon="i-heroicons-banknotes"
            :title="$t('recent.emptyTitle')"
            :description="$t('recent.emptyDesc')"
            :actions="[{ label: $t('nav.add'), icon: 'i-heroicons-plus', onClick: () => openNew() }]"
            variant="naked"
            size="sm"
          />
        </section>

        <IncomeCard :rows="income" :period="period" />
      </div>
    </div>
  </div>
</template>
