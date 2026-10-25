<script setup lang="ts">
import type { Transaction, TransactionType } from "#shared/schemas/transaction";

// Every transaction of a period (a month, a year or all time), searchable
// and filtered by type and category. The period is fetched; search, type
// and category filter what is already here, so they answer as you type.
// All of it lives in the address, so the overview can link straight to
// "Groceries in October".
definePageMeta({ period: "all" });
const { t } = useI18n();
const { apiFetch } = useAuth();
const { splitRules, incomeCategories, ensureLoaded, colorOf } = useCategories();
const { openNew } = useTransactionEditor();
const { range } = usePeriod({ allowAll: true });
const route = useRoute();
const router = useRouter();

const { data, status } = await useAsyncData(
  "transactions",
  () => apiFetch<{ items: Transaction[] }>("/api/transactions", { query: range.value }),
  { watch: [range] },
);
await ensureLoaded();

const setQuery = (changes: Record<string, string | undefined>) =>
  router.replace({ query: { ...route.query, ...changes } });

const type = computed<TransactionType | "all">({
  get: () => (route.query.type === "income" || route.query.type === "expense" ? route.query.type : "all"),
  set: value => void setQuery({ type: value === "all" ? undefined : value, category: undefined }),
});

// The two category lists are separate tables whose ids can coincide, so a
// category is picked together with its type: "expense:3".
const category = computed<string>({
  get: () => (type.value !== "all" && typeof route.query.category === "string" ? `${type.value}:${route.query.category}` : "all"),
  set: (value) => {
    if (value === "all") return void setQuery({ category: undefined });
    const [kind, id] = value.split(":");
    void setQuery({ type: kind, category: id });
  },
});

const categoryItems = computed(() => [
  { label: t("filters.allCategories"), value: "all" },
  ...(splitRules.value.length ? [{ type: "label" as const, label: t("stats.expenses") }] : []),
  ...splitRules.value.map(c => ({ label: c.label, value: `expense:${c.id}`, color: categoryHex(c.color) })),
  ...(incomeCategories.value.length ? [{ type: "label" as const, label: t("stats.income") }] : []),
  ...incomeCategories.value.map(c => ({ label: c.label, value: `income:${c.id}`, color: categoryHex(c.color) })),
]);
const chosenColor = computed(() => {
  const [kind, id] = category.value.split(":");
  return id ? colorOf(kind as TransactionType, Number(id)) : undefined;
});

// Search is typed into a local ref and written to the address a moment
// later, so the history isn't rewritten on every key.
const search = ref(typeof route.query.q === "string" ? route.query.q : "");
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void setQuery({ q: value.trim() || undefined }), 300);
});

const typeTabs = computed(() => [
  { label: t("types.all"), value: "all" },
  { label: t("stats.expenses"), value: "expense" },
  { label: t("stats.income"), value: "income" },
]);

const filtered = computed(() => {
  const needle = search.value.trim().toLowerCase();
  const [, categoryId] = category.value.split(":");
  return (data.value?.items ?? []).filter(tx =>
    (type.value === "all" || tx.type === type.value)
    && (!categoryId || tx.category.id === Number(categoryId))
    && (!needle || tx.name.toLowerCase().includes(needle) || tx.category.label.toLowerCase().includes(needle)),
  );
});

const totals = computed(() => {
  let income = 0;
  let expenses = 0;
  for (const tx of filtered.value) {
    if (tx.type === "income") income += tx.amount;
    else expenses += tx.amount;
  }
  return { income, expenses };
});

const filtering = computed(() => type.value !== "all" || category.value !== "all" || search.value.trim() !== "");
function clearFilters() {
  search.value = "";
  void setQuery({ type: undefined, category: undefined, q: undefined });
}

useHead({ title: t("transactions.pageTitle") });
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-5">
    <!-- On a phone it is in the header (layouts/default.vue). -->
    <div class="-ml-2 hidden sm:block">
      <PeriodPicker allow-all />
    </div>

    <div class="panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
      <UInput
        v-model="search"
        icon="i-heroicons-magnifying-glass"
        :placeholder="$t('filters.search')"
        class="w-full sm:flex-1"
        :ui="{ trailing: 'pe-1' }"
      >
        <template v-if="search" #trailing>
          <UButton color="neutral" variant="link" size="sm" icon="i-heroicons-x-mark" :aria-label="$t('filters.clearSearch')" @click="search = ''" />
        </template>
      </UInput>
      <div class="flex gap-2">
        <UTabs v-model="type" :items="typeTabs" :content="false" size="sm" class="shrink-0" />
        <USelect v-model="category" :items="categoryItems" class="min-w-0 flex-1 sm:w-48 sm:flex-none" :aria-label="$t('filters.category')">
          <template #leading>
            <span v-if="chosenColor" class="ms-1 size-2 rounded-full" :style="{ backgroundColor: chosenColor }" />
          </template>
          <template #item-leading="{ item }">
            <span v-if="(item as { color?: string }).color" class="size-2 rounded-full" :style="{ backgroundColor: (item as { color?: string }).color }" />
          </template>
        </USelect>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-muted" :class="{ 'opacity-60': status === 'pending' }">
      <span>{{ $t('transactions.count', { count: filtered.length }, filtered.length) }}</span>
      <span v-if="totals.income" class="tabular-nums text-emerald-600 dark:text-emerald-400">+{{ formatNumber(totals.income) }}</span>
      <span v-if="totals.expenses" class="tabular-nums text-highlighted">−{{ formatNumber(totals.expenses) }}</span>
      <UButton v-if="filtering" color="neutral" variant="link" size="sm" class="ml-auto px-0" icon="i-heroicons-x-mark" @click="clearFilters">
        {{ $t('filters.clear') }}
      </UButton>
    </div>

    <TransactionList
      v-if="filtered.length"
      :transactions="filtered"
      :page-size="100"
      :class="{ 'opacity-60 transition-opacity': status === 'pending' }"
    />
    <section v-else class="panel p-6">
      <UEmpty
        :icon="filtering ? 'i-heroicons-magnifying-glass' : 'i-heroicons-banknotes'"
        :title="filtering ? $t('transactions.noMatchTitle') : $t('transactions.emptyTitle')"
        :description="filtering ? $t('transactions.noMatchDesc') : $t('transactions.emptyDesc')"
        :actions="filtering
          ? [{ label: $t('filters.clear'), color: 'neutral', variant: 'outline', onClick: clearFilters }]
          : [{ label: $t('nav.add'), icon: 'i-heroicons-plus', onClick: () => openNew() }]"
        variant="naked"
      />
    </section>
  </div>
</template>
