<script setup lang="ts">
const { t } = useI18n();
useHead({ title: t("salesSplit.pageTitle") });

const { totals, formatAmount, loadTransactions, splitRules } = useTransactions();
const { loggedIn, apiFetch } = useAuth();
const { isGuest } = useGuest();
await loadTransactions();

interface Rule {
  id: number;
  label: string;
  percent: number;
  color: string;
}

// 20 predefined colors — index matches server's SPLIT_COLORS order
const COLOR_CLASSES: Record<string, { text: string; bar: string; badge: string }> = {
  cyan:    { text: "text-cyan-300",    bar: "bg-cyan-400",    badge: "bg-cyan-500/15 border-cyan-400/30 text-cyan-300" },
  violet:  { text: "text-violet-300",  bar: "bg-violet-400",  badge: "bg-violet-500/15 border-violet-400/30 text-violet-300" },
  amber:   { text: "text-amber-300",   bar: "bg-amber-400",   badge: "bg-amber-500/15 border-amber-400/30 text-amber-300" },
  emerald: { text: "text-emerald-300", bar: "bg-emerald-400", badge: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300" },
  rose:    { text: "text-rose-300",    bar: "bg-rose-400",    badge: "bg-rose-500/15 border-rose-400/30 text-rose-300" },
  sky:     { text: "text-sky-300",     bar: "bg-sky-400",     badge: "bg-sky-500/15 border-sky-400/30 text-sky-300" },
  indigo:  { text: "text-indigo-300",  bar: "bg-indigo-400",  badge: "bg-indigo-500/15 border-indigo-400/30 text-indigo-300" },
  pink:    { text: "text-pink-300",    bar: "bg-pink-400",    badge: "bg-pink-500/15 border-pink-400/30 text-pink-300" },
  orange:  { text: "text-orange-300",  bar: "bg-orange-400",  badge: "bg-orange-500/15 border-orange-400/30 text-orange-300" },
  teal:    { text: "text-teal-300",    bar: "bg-teal-400",    badge: "bg-teal-500/15 border-teal-400/30 text-teal-300" },
  purple:  { text: "text-purple-300",  bar: "bg-purple-400",  badge: "bg-purple-500/15 border-purple-400/30 text-purple-300" },
  yellow:  { text: "text-yellow-300",  bar: "bg-yellow-400",  badge: "bg-yellow-500/15 border-yellow-400/30 text-yellow-300" },
  red:     { text: "text-red-300",     bar: "bg-red-400",     badge: "bg-red-500/15 border-red-400/30 text-red-300" },
  blue:    { text: "text-blue-300",    bar: "bg-blue-400",    badge: "bg-blue-500/15 border-blue-400/30 text-blue-300" },
  green:   { text: "text-green-300",   bar: "bg-green-400",   badge: "bg-green-500/15 border-green-400/30 text-green-300" },
  fuchsia: { text: "text-fuchsia-300", bar: "bg-fuchsia-400", badge: "bg-fuchsia-500/15 border-fuchsia-400/30 text-fuchsia-300" },
  lime:    { text: "text-lime-300",    bar: "bg-lime-400",    badge: "bg-lime-500/15 border-lime-400/30 text-lime-300" },
  slate:   { text: "text-slate-300",   bar: "bg-slate-400",   badge: "bg-slate-500/15 border-slate-400/30 text-slate-300" },
  zinc:    { text: "text-zinc-300",    bar: "bg-zinc-400",    badge: "bg-zinc-500/15 border-zinc-400/30 text-zinc-300" },
};

const GUEST_KEY = "mm_guest_splits";
const rules = ref<Rule[]>([]);
const saving = ref(false);

watch(rules, (newRules) => {
  splitRules.value = newRules.map(r => ({ id: r.id, label: r.label, color: r.color }));
}, { deep: true });

function colorOf(rule: Rule) {
  return COLOR_CLASSES[rule.color] ?? COLOR_CLASSES.cyan!;
}

// --- Load ---
async function loadFromApi(): Promise<Rule[]> {
  try {
    const data = await apiFetch<{ rules: Rule[] }>("/api/sales-split");
    return data.rules ?? [];
  } catch { return []; }
}

function loadFromStorage(): Rule[] {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) ?? "[]"); } catch { return []; }
}

function defaultRules(): Rule[] {
  return [
    { id: 1, label: t("salesSplit.defaultTaxes"),   percent: 25, color: "amber" },
    { id: 2, label: t("salesSplit.defaultSavings"),  percent: 20, color: "cyan" },
  ];
}

onMounted(async () => {
  if (isGuest.value) {
    const stored = loadFromStorage();
    rules.value = stored.length ? stored : defaultRules();
  } else if (loggedIn.value) {
    rules.value = await loadFromApi();
  }
});

// --- Guest helpers ---
let guestNextId = computed(() => rules.value.reduce((m, r) => Math.max(m, r.id), 0) + 1);
const GUEST_COLORS = Object.keys(COLOR_CLASSES);
function guestNextColor() { return GUEST_COLORS[rules.value.length % GUEST_COLORS.length] as string; }
function saveGuest() { localStorage.setItem(GUEST_KEY, JSON.stringify(rules.value)); }

// --- Add ---
async function addRule() {
  if (isGuest.value) {
    rules.value.push({ id: guestNextId.value, label: t("salesSplit.newRule"), percent: 10, color: guestNextColor() });
    saveGuest();
    return;
  }
  saving.value = true;
  try {
    const rule = await apiFetch<Rule>("/api/sales-split", {
      method: "POST",
      body: { label: t("salesSplit.newRule"), percent: 10 },
    });
    rules.value.push(rule);
  } finally { saving.value = false; }
}

// --- Update (debounced) ---
const timers: Record<number, ReturnType<typeof setTimeout>> = {};

function onInput(rule: Rule) {
  if (isGuest.value) { saveGuest(); return; }
  clearTimeout(timers[rule.id]);
  timers[rule.id] = setTimeout(async () => {
    await apiFetch(`/api/sales-split/${rule.id}`, {
      method: "PUT",
      body: { label: rule.label, percent: rule.percent },
    });
  }, 600);
}

// --- Delete ---
async function removeRule(id: number) {
  if (isGuest.value) {
    rules.value = rules.value.filter((r) => r.id !== id);
    saveGuest();
    return;
  }
  await apiFetch(`/api/sales-split/${id}`, { method: "DELETE" });
  rules.value = rules.value.filter((r) => r.id !== id);
}

// --- Computed ---
const totalPercent = computed(() => rules.value.reduce((s, r) => s + Number(r.percent), 0));
const overLimit = computed(() => totalPercent.value > 100);
const income = computed(() => totals.value.income);
const splitAmount = (percent: number) => (income.value * percent) / 100;
</script>

<template>
  <div class="flex flex-col gap-10">
    <UPageHeader
      :title="$t('salesSplit.title')"
      :description="$t('salesSplit.description')"
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">{{ $t('salesSplit.badge') }}</UBadge>
      </template>
    </UPageHeader>

    <!-- Income summary -->
    <section class="grid gap-4 md:grid-cols-3">
      <UCard class="glass-card">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{{ $t('salesSplit.totalIncome') }}</p>
        <p class="mt-3 text-2xl font-semibold text-emerald-300">{{ formatAmount(income) }}</p>
      </UCard>
      <UCard class="glass-card">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{{ $t('salesSplit.allocated') }}</p>
        <p class="mt-3 text-2xl font-semibold" :class="overLimit ? 'text-rose-300' : 'text-cyan-300'">
          {{ totalPercent }}%
        </p>
      </UCard>
      <UCard class="glass-card">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{{ $t('salesSplit.remaining') }}</p>
        <p class="mt-3 text-2xl font-semibold text-white">{{ formatAmount(splitAmount(Math.max(0, 100 - totalPercent))) }}</p>
        <p class="mt-1 text-xs text-slate-400">{{ Math.max(0, 100 - totalPercent) }}{{ $t('salesSplit.unallocated') }}</p>
      </UCard>
    </section>

    <UAlert v-if="overLimit" color="error" variant="subtle" class="glass-card"
      :title="$t('salesSplit.overLimitTitle')" :description="$t('salesSplit.overLimitDesc')" />

    <!-- Rules -->
    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-white">{{ $t('salesSplit.rulesTitle') }}</h2>
        <UButton icon="i-heroicons-plus" color="primary" variant="subtle" size="sm" :loading="saving" @click="addRule">
          {{ $t('salesSplit.addRule') }}
        </UButton>
      </div>

      <div v-if="rules.length === 0" class="glass-card rounded-2xl p-6 text-center text-slate-400">
        {{ $t('salesSplit.noRules') }}
      </div>

      <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div v-for="rule in rules" :key="rule.id"
          class="glass-card flex items-center gap-2 rounded-xl px-3 py-2.5">
          <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :class="colorOf(rule).bar" />
          <input
            v-model="rule.label"
            type="text"
            class="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            :placeholder="$t('salesSplit.labelPlaceholder')"
            @input="onInput(rule)"
          />
          <input
            v-model.number="rule.percent"
            type="number" min="0" max="100" step="1"
            class="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-center text-sm text-white outline-none focus:border-cyan-400/50"
            @input="onInput(rule)"
          />
          <span class="text-xs text-slate-400">%</span>
          <span :class="['text-sm font-semibold', colorOf(rule).text]">
            {{ formatAmount(splitAmount(rule.percent)) }}
          </span>
          <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs"
            :aria-label="$t('common.delete')" @click="removeRule(rule.id)" />
        </div>
      </div>
    </section>

    <!-- Overview bar -->
    <UCard v-if="rules.length > 0" class="glass-card">
      <p class="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{{ $t('salesSplit.allocationOverview') }}</p>
      <div class="flex h-4 w-full overflow-hidden rounded-full bg-white/5">
        <div
          v-for="rule in rules" :key="rule.id"
          :class="colorOf(rule).bar"
          :style="{ width: Math.min(Number(rule.percent), 100) + '%' }"
          :title="`${rule.label}: ${rule.percent}%`"
          class="h-full transition-all duration-300"
        />
      </div>
      <div class="mt-3 flex flex-wrap gap-4">
        <div v-for="rule in rules" :key="rule.id" class="flex items-center gap-1.5 text-xs text-slate-300">
          <span class="inline-block h-2.5 w-2.5 rounded-full" :class="colorOf(rule).bar" />
          {{ rule.label }} — {{ rule.percent }}%
        </div>
        <div v-if="totalPercent < 100" class="flex items-center gap-1.5 text-xs text-slate-500">
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-white/10" />
          {{ $t('salesSplit.unallocatedLabel') }} — {{ 100 - totalPercent }}%
        </div>
      </div>
    </UCard>
  </div>
</template>
