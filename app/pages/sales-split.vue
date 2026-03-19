<script setup lang="ts">
const { t } = useI18n();
useHead({ title: t("salesSplit.pageTitle") });

const { totals, formatAmount, loadTransactions } = useTransactions();
const { loggedIn, apiFetch } = useAuth();
await loadTransactions();

interface Split {
  id: number;
  label: string;
  percent: number;
  color: string;
}

const COLORS = [
  "text-cyan-300 bg-cyan-500/15 border-cyan-400/30",
  "text-violet-300 bg-violet-500/15 border-violet-400/30",
  "text-amber-300 bg-amber-500/15 border-amber-400/30",
  "text-emerald-300 bg-emerald-500/15 border-emerald-400/30",
  "text-rose-300 bg-rose-500/15 border-rose-400/30",
  "text-sky-300 bg-sky-500/15 border-sky-400/30",
];

const BAR_COLORS = [
  "bg-cyan-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-rose-400",
  "bg-sky-400",
];

const STORAGE_KEY = "sales-split-rules";
const nextId = ref(1);
const splits = ref<Split[]>([]);

function defaultSplits(): Split[] {
  nextId.value = 3;
  return [
    { id: 1, label: t("salesSplit.defaultTaxes"), percent: 25, color: COLORS[2] },
    { id: 2, label: t("salesSplit.defaultSavings"), percent: 20, color: COLORS[0] },
  ];
}

function setSplits(list: Split[]) {
  splits.value = list;
  const maxId = list.reduce((m, s) => Math.max(m, s.id), 0);
  nextId.value = maxId + 1;
}

function loadFromStorage(): Split[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as Split[];
    }
  } catch {}
  return defaultSplits();
}

async function loadFromApi(): Promise<Split[]> {
  try {
    const data = await apiFetch<{ rules: Split[] }>("/api/sales-split");
    return data.rules?.length ? data.rules : defaultSplits();
  } catch {
    return defaultSplits();
  }
}

onMounted(async () => {
  if (loggedIn.value) {
    setSplits(await loadFromApi());
  } else {
    setSplits(loadFromStorage());
  }
});

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (loggedIn.value) {
      await apiFetch("/api/sales-split", {
        method: "PUT",
        body: { rules: splits.value },
      });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(splits.value));
    }
  }, 600);
}

function addSplit() {
  const colorIndex = splits.value.length % COLORS.length;
  splits.value.push({
    id: nextId.value++,
    label: t("salesSplit.newRule"),
    percent: 10,
    color: COLORS[colorIndex],
  });
  save();
}

function removeSplit(id: number) {
  splits.value = splits.value.filter((s) => s.id !== id);
  save();
}

function onInput() {
  save();
}

const totalPercent = computed(() =>
  splits.value.reduce((sum, s) => sum + Number(s.percent), 0)
);

const overLimit = computed(() => totalPercent.value > 100);

const income = computed(() => totals.value.income);

function splitAmount(percent: number) {
  return (income.value * percent) / 100;
}

function barWidth(id: number) {
  const s = splits.value.find((x) => x.id === id);
  if (!s) return "0%";
  return Math.min(Number(s.percent), 100) + "%";
}

function barColor(index: number) {
  return BAR_COLORS[index % BAR_COLORS.length];
}
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
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
          {{ $t('salesSplit.totalIncome') }}
        </p>
        <p class="mt-3 text-2xl font-semibold text-emerald-300">
          {{ formatAmount(income) }}
        </p>
      </UCard>
      <UCard class="glass-card">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
          {{ $t('salesSplit.allocated') }}
        </p>
        <p
          class="mt-3 text-2xl font-semibold"
          :class="overLimit ? 'text-rose-300' : 'text-cyan-300'"
        >
          {{ totalPercent }}%
        </p>
      </UCard>
      <UCard class="glass-card">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
          {{ $t('salesSplit.remaining') }}
        </p>
        <p class="mt-3 text-2xl font-semibold text-white">
          {{ formatAmount(splitAmount(Math.max(0, 100 - totalPercent))) }}
        </p>
        <p class="mt-1 text-xs text-slate-400">{{ Math.max(0, 100 - totalPercent) }}{{ $t('salesSplit.unallocated') }}</p>
      </UCard>
    </section>

    <UAlert
      v-if="overLimit"
      color="error"
      variant="subtle"
      class="glass-card"
      :title="$t('salesSplit.overLimitTitle')"
      :description="$t('salesSplit.overLimitDesc')"
    />

    <!-- Split rules -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-white">{{ $t('salesSplit.rulesTitle') }}</h2>
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          variant="subtle"
          size="sm"
          @click="addSplit"
        >
          {{ $t('salesSplit.addRule') }}
        </UButton>
      </div>

      <div v-if="splits.length === 0" class="glass-card rounded-2xl p-8 text-center text-slate-400">
        {{ $t('salesSplit.noRules') }}
      </div>

      <UCard
        v-for="(split, index) in splits"
        :key="split.id"
        class="glass-card"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <!-- Label -->
          <div class="flex-1">
            <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {{ $t('salesSplit.labelField') }}
            </label>
            <input
              v-model="split.label"
              type="text"
              class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/50 focus:ring-0"
              :placeholder="$t('salesSplit.labelPlaceholder')"
              @input="onInput"
            />
          </div>

          <!-- Percent -->
          <div class="w-full sm:w-36">
            <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {{ $t('salesSplit.percentField') }}
            </label>
            <input
              v-model.number="split.percent"
              type="number"
              min="0"
              max="100"
              step="1"
              class="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
              @input="onInput"
            />
          </div>

          <!-- Amount result -->
          <div class="w-full sm:w-44">
            <p class="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {{ $t('salesSplit.amountField') }}
            </p>
            <p :class="['text-xl font-semibold', split.color.split(' ')[0]]">
              {{ formatAmount(splitAmount(split.percent)) }}
            </p>
          </div>

          <!-- Delete -->
          <UButton
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            size="sm"
            :aria-label="$t('common.delete')"
            class="self-start sm:self-center"
            @click="removeSplit(split.id)"
          />
        </div>

        <!-- Bar -->
        <div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="barColor(index)"
            :style="{ width: barWidth(split.id) }"
          />
        </div>
      </UCard>
    </section>

    <!-- Visual summary bar -->
    <UCard v-if="splits.length > 0" class="glass-card">
      <p class="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
        {{ $t('salesSplit.allocationOverview') }}
      </p>
      <div class="flex h-4 w-full overflow-hidden rounded-full bg-white/5">
        <div
          v-for="(split, index) in splits"
          :key="split.id"
          :class="barColor(index)"
          :style="{ width: Math.min(Number(split.percent), 100) + '%' }"
          :title="`${split.label}: ${split.percent}%`"
          class="h-full transition-all duration-300"
        />
      </div>
      <div class="mt-3 flex flex-wrap gap-4">
        <div
          v-for="(split, index) in splits"
          :key="split.id"
          class="flex items-center gap-1.5 text-xs text-slate-300"
        >
          <span class="inline-block h-2.5 w-2.5 rounded-full" :class="barColor(index)" />
          {{ split.label }} — {{ split.percent }}%
        </div>
        <div v-if="totalPercent < 100" class="flex items-center gap-1.5 text-xs text-slate-500">
          <span class="inline-block h-2.5 w-2.5 rounded-full bg-white/10" />
          {{ $t('salesSplit.unallocatedLabel') }} — {{ 100 - totalPercent }}%
        </div>
      </div>
    </UCard>
  </div>
</template>
