<script setup lang="ts">
const { t } = useI18n();
useHead({ title: t("categoriesPage.pageTitle") });

const { totals, formatAmount, loadTransactions, splitRules, incomeCategories } = useTransactions();
const { apiFetch } = useAuth();
await loadTransactions();

interface Rule {
  id: number;
  label: string;
  percent: number;
  color: string;
}

interface Category {
  id: number;
  label: string;
  color: string;
}

// 20 predefined colors — index matches server's SPLIT_COLORS order.
// Shared by both expense (sales-split) and income groups. `text` carries
// a dark-mode pair: the -300 shade reads well on the dark glass card, but
// needs the darker -600 to stay legible on the light theme's surfaces.
const COLOR_CLASSES: Record<string, { text: string; bar: string; badge: string }> = {
  cyan:    { text: "text-cyan-600 dark:text-cyan-300",       bar: "bg-cyan-400",    badge: "bg-cyan-500/15 border-cyan-400/30 text-cyan-300" },
  violet:  { text: "text-violet-600 dark:text-violet-300",   bar: "bg-violet-400",  badge: "bg-violet-500/15 border-violet-400/30 text-violet-300" },
  amber:   { text: "text-amber-600 dark:text-amber-300",     bar: "bg-amber-400",   badge: "bg-amber-500/15 border-amber-400/30 text-amber-300" },
  emerald: { text: "text-emerald-600 dark:text-emerald-300", bar: "bg-emerald-400", badge: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300" },
  rose:    { text: "text-rose-600 dark:text-rose-300",       bar: "bg-rose-400",    badge: "bg-rose-500/15 border-rose-400/30 text-rose-300" },
  sky:     { text: "text-sky-600 dark:text-sky-300",         bar: "bg-sky-400",     badge: "bg-sky-500/15 border-sky-400/30 text-sky-300" },
  indigo:  { text: "text-indigo-600 dark:text-indigo-300",   bar: "bg-indigo-400",  badge: "bg-indigo-500/15 border-indigo-400/30 text-indigo-300" },
  pink:    { text: "text-pink-600 dark:text-pink-300",       bar: "bg-pink-400",    badge: "bg-pink-500/15 border-pink-400/30 text-pink-300" },
  orange:  { text: "text-orange-600 dark:text-orange-300",   bar: "bg-orange-400",  badge: "bg-orange-500/15 border-orange-400/30 text-orange-300" },
  teal:    { text: "text-teal-600 dark:text-teal-300",       bar: "bg-teal-400",    badge: "bg-teal-500/15 border-teal-400/30 text-teal-300" },
  purple:  { text: "text-purple-600 dark:text-purple-300",   bar: "bg-purple-400",  badge: "bg-purple-500/15 border-purple-400/30 text-purple-300" },
  yellow:  { text: "text-yellow-600 dark:text-yellow-300",   bar: "bg-yellow-400",  badge: "bg-yellow-500/15 border-yellow-400/30 text-yellow-300" },
  red:     { text: "text-red-600 dark:text-red-300",         bar: "bg-red-400",     badge: "bg-red-500/15 border-red-400/30 text-red-300" },
  blue:    { text: "text-blue-600 dark:text-blue-300",       bar: "bg-blue-400",    badge: "bg-blue-500/15 border-blue-400/30 text-blue-300" },
  green:   { text: "text-green-600 dark:text-green-300",     bar: "bg-green-400",   badge: "bg-green-500/15 border-green-400/30 text-green-300" },
  fuchsia: { text: "text-fuchsia-600 dark:text-fuchsia-300", bar: "bg-fuchsia-400", badge: "bg-fuchsia-500/15 border-fuchsia-400/30 text-fuchsia-300" },
  lime:    { text: "text-lime-600 dark:text-lime-300",       bar: "bg-lime-400",    badge: "bg-lime-500/15 border-lime-400/30 text-lime-300" },
  slate:   { text: "text-slate-600 dark:text-slate-300",     bar: "bg-slate-400",   badge: "bg-slate-500/15 border-slate-400/30 text-slate-300" },
  zinc:    { text: "text-zinc-600 dark:text-zinc-300",       bar: "bg-zinc-400",    badge: "bg-zinc-500/15 border-zinc-400/30 text-zinc-300" },
};

// ---------------------------------------------------------------------------
// Expense categories (sales-split rules) — percent allocation of income.
// ---------------------------------------------------------------------------
const rules = ref<Rule[]>([]);
const savingRule = ref(false);

watch(rules, (newRules) => {
  splitRules.value = newRules.map(r => ({ id: r.id, label: r.label, color: r.color }));
}, { deep: true });

function colorOfRule(rule: Rule) {
  return COLOR_CLASSES[rule.color] ?? COLOR_CLASSES.cyan!;
}

async function loadRulesFromApi(): Promise<Rule[]> {
  try {
    const data = await apiFetch<{ rules: Rule[] }>("/api/sales-split");
    return data.rules ?? [];
  } catch { return []; }
}

async function addRule() {
  savingRule.value = true;
  try {
    const rule = await apiFetch<Rule>("/api/sales-split", {
      method: "POST",
      body: { label: t("salesSplit.newRule"), percent: 10 },
    });
    rules.value.push(rule);
  } finally { savingRule.value = false; }
}

const ruleTimers: Record<number, ReturnType<typeof setTimeout>> = {};
function onRuleInput(rule: Rule) {
  clearTimeout(ruleTimers[rule.id]);
  ruleTimers[rule.id] = setTimeout(async () => {
    await apiFetch(`/api/sales-split/${rule.id}`, {
      method: "PUT",
      body: { label: rule.label, percent: rule.percent },
    });
  }, 600);
}

async function removeRule(id: number) {
  await apiFetch(`/api/sales-split/${id}`, { method: "DELETE" });
  rules.value = rules.value.filter((r) => r.id !== id);
}

const totalPercent = computed(() => rules.value.reduce((s, r) => s + Number(r.percent), 0));
const overLimit = computed(() => totalPercent.value > 100);
const income = computed(() => totals.value.income);
const splitAmount = (percent: number) => (income.value * percent) / 100;

// ---------------------------------------------------------------------------
// Income categories — label-only classification of income transactions.
// ---------------------------------------------------------------------------
const categories = ref<Category[]>([]);
const savingCategory = ref(false);

watch(categories, (newCats) => {
  incomeCategories.value = newCats.map(c => ({ id: c.id, label: c.label, color: c.color }));
}, { deep: true });

function colorOfCategory(cat: Category) {
  return COLOR_CLASSES[cat.color] ?? COLOR_CLASSES.cyan!;
}

async function loadCategoriesFromApi(): Promise<Category[]> {
  try {
    const data = await apiFetch<{ categories: Category[] }>("/api/income-categories");
    return data.categories ?? [];
  } catch { return []; }
}

async function addCategory() {
  savingCategory.value = true;
  try {
    const cat = await apiFetch<Category>("/api/income-categories", {
      method: "POST",
      body: { label: t("incomeCategories.newCategory") },
    });
    categories.value.push(cat);
  } finally { savingCategory.value = false; }
}

const categoryTimers: Record<number, ReturnType<typeof setTimeout>> = {};
function onCategoryInput(cat: Category) {
  clearTimeout(categoryTimers[cat.id]);
  categoryTimers[cat.id] = setTimeout(async () => {
    await apiFetch(`/api/income-categories/${cat.id}`, {
      method: "PUT",
      body: { label: cat.label },
    });
  }, 600);
}

async function removeCategory(id: number) {
  await apiFetch(`/api/income-categories/${id}`, { method: "DELETE" });
  categories.value = categories.value.filter((c) => c.id !== id);
}

// ---------------------------------------------------------------------------
onMounted(async () => {
  [rules.value, categories.value] = await Promise.all([
    loadRulesFromApi(),
    loadCategoriesFromApi(),
  ]);
});
</script>

<template>
  <div class="flex flex-col gap-12">
    <UPageHeader
      :title="$t('categoriesPage.title')"
      :description="$t('categoriesPage.description')"
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">{{ $t('categoriesPage.badge') }}</UBadge>
      </template>
    </UPageHeader>

    <!-- Expense categories (sales split) -->
    <section id="expense" class="flex flex-col gap-6 scroll-mt-28">
      <div>
        <h2 class="text-xl font-semibold text-highlighted">{{ $t('salesSplit.title') }}</h2>
        <p class="mt-1 text-sm text-dimmed">{{ $t('salesSplit.description') }}</p>
      </div>

      <!-- Income summary -->
      <div class="grid gap-4 md:grid-cols-3">
        <UCard class="glass-card">
          <p class="text-xs font-semibold uppercase tracking-[0.25em] text-dimmed">{{ $t('salesSplit.totalIncome') }}</p>
          <p class="mt-3 text-2xl font-semibold text-emerald-300">{{ formatAmount(income) }}</p>
        </UCard>
        <UCard class="glass-card">
          <p class="text-xs font-semibold uppercase tracking-[0.25em] text-dimmed">{{ $t('salesSplit.allocated') }}</p>
          <p class="mt-3 text-2xl font-semibold" :class="overLimit ? 'text-rose-300' : 'text-cyan-300'">
            {{ totalPercent }}%
          </p>
        </UCard>
        <UCard class="glass-card">
          <p class="text-xs font-semibold uppercase tracking-[0.25em] text-dimmed">{{ $t('salesSplit.remaining') }}</p>
          <p class="mt-3 text-2xl font-semibold text-highlighted">{{ formatAmount(splitAmount(Math.max(0, 100 - totalPercent))) }}</p>
          <p class="mt-1 text-xs text-dimmed">{{ Math.max(0, 100 - totalPercent) }}{{ $t('salesSplit.unallocated') }}</p>
        </UCard>
      </div>

      <UAlert
        v-if="overLimit" color="error" variant="subtle" class="glass-card"
        :title="$t('salesSplit.overLimitTitle')" :description="$t('salesSplit.overLimitDesc')" />

      <!-- Rules -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-highlighted">{{ $t('salesSplit.rulesTitle') }}</h3>
          <UButton icon="i-heroicons-plus" color="primary" variant="subtle" size="sm" :loading="savingRule" @click="addRule">
            {{ $t('salesSplit.addRule') }}
          </UButton>
        </div>

        <div v-if="rules.length === 0" class="glass-card rounded-2xl p-6 text-center text-dimmed">
          {{ $t('salesSplit.noRules') }}
        </div>

        <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div
            v-for="rule in rules" :key="rule.id"
            class="glass-card flex items-center gap-2 rounded-xl px-3 py-2.5">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :class="colorOfRule(rule).bar" />
            <input
              v-model="rule.label"
              type="text"
              class="min-w-0 flex-1 bg-transparent text-sm text-highlighted placeholder:text-dimmed outline-none"
              :placeholder="$t('salesSplit.labelPlaceholder')"
              @input="onRuleInput(rule)"
            >
            <input
              v-model.number="rule.percent"
              type="number" min="0" max="100" step="1"
              class="w-14 rounded-lg border border-default bg-elevated px-2 py-1 text-center text-sm text-highlighted outline-none focus:border-cyan-400/50"
              @input="onRuleInput(rule)"
            >
            <span class="text-xs text-dimmed">%</span>
            <span :class="['text-sm font-semibold', colorOfRule(rule).text]">
              {{ formatAmount(splitAmount(rule.percent)) }}
            </span>
            <UButton
              icon="i-heroicons-trash" color="error" variant="ghost" size="xs"
              :aria-label="$t('common.delete')" @click="removeRule(rule.id)" />
          </div>
        </div>
      </div>

      <!-- Overview bar -->
      <UCard v-if="rules.length > 0" class="glass-card">
        <p class="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-dimmed">{{ $t('salesSplit.allocationOverview') }}</p>
        <div class="flex h-4 w-full overflow-hidden rounded-full bg-elevated">
          <div
            v-for="rule in rules" :key="rule.id"
            :class="colorOfRule(rule).bar"
            :style="{ width: Math.min(Number(rule.percent), 100) + '%' }"
            :title="`${rule.label}: ${rule.percent}%`"
            class="h-full transition-all duration-300"
          />
        </div>
        <div class="mt-3 flex flex-wrap gap-4">
          <div v-for="rule in rules" :key="rule.id" class="flex items-center gap-1.5 text-xs text-muted">
            <span class="inline-block h-2.5 w-2.5 rounded-full" :class="colorOfRule(rule).bar" />
            {{ rule.label }} — {{ rule.percent }}%
          </div>
          <div v-if="totalPercent < 100" class="flex items-center gap-1.5 text-xs text-dimmed">
            <span class="inline-block h-2.5 w-2.5 rounded-full bg-accented" />
            {{ $t('salesSplit.unallocatedLabel') }} — {{ 100 - totalPercent }}%
          </div>
        </div>
      </UCard>
    </section>

    <div class="h-px w-full bg-elevated" />

    <!-- Income categories -->
    <section id="income" class="flex flex-col gap-6 scroll-mt-28">
      <div>
        <h2 class="text-xl font-semibold text-highlighted">{{ $t('incomeCategories.title') }}</h2>
        <p class="mt-1 text-sm text-dimmed">{{ $t('incomeCategories.description') }}</p>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-highlighted">{{ $t('incomeCategories.title') }}</h3>
          <UButton icon="i-heroicons-plus" color="primary" variant="subtle" size="sm" :loading="savingCategory" @click="addCategory">
            {{ $t('incomeCategories.addCategory') }}
          </UButton>
        </div>

        <div v-if="categories.length === 0" class="glass-card rounded-2xl p-6 text-center text-dimmed">
          {{ $t('incomeCategories.noCategories') }}
        </div>

        <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div
            v-for="cat in categories" :key="cat.id"
            class="glass-card flex items-center gap-2 rounded-xl px-3 py-2.5">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :class="colorOfCategory(cat).bar" />
            <input
              v-model="cat.label"
              type="text"
              class="min-w-0 flex-1 bg-transparent text-sm text-highlighted placeholder:text-dimmed outline-none"
              :placeholder="$t('incomeCategories.labelPlaceholder')"
              @input="onCategoryInput(cat)"
            >
            <UButton
              icon="i-heroicons-trash" color="error" variant="ghost" size="xs"
              :aria-label="$t('common.delete')" @click="removeCategory(cat.id)" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
