<script setup lang="ts">
const { t } = useI18n();
useHead({ title: t("incomeCategories.pageTitle") });

const { formatAmount, totals, loadTransactions, incomeCategories } = useTransactions();
const { loggedIn, apiFetch } = useAuth();
const { isGuest } = useGuest();
await loadTransactions();

interface Category {
  id: number;
  label: string;
  color: string;
}

// Reuse the same 20 colors as split rules
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

const GUEST_KEY = "mm_guest_income_categories";
const categories = ref<Category[]>([]);
const saving = ref(false);

function colorOf(cat: Category) {
  return COLOR_CLASSES[cat.color] ?? COLOR_CLASSES.cyan!;
}

// --- Sync to shared state ---
watch(categories, (newCats) => {
  incomeCategories.value = newCats.map(c => ({ id: c.id, label: c.label, color: c.color }));
}, { deep: true });

// --- Load ---
async function loadFromApi(): Promise<Category[]> {
  try {
    const data = await apiFetch<{ categories: Category[] }>("/api/income-categories");
    return data.categories ?? [];
  } catch { return []; }
}

function loadFromStorage(): Category[] {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) ?? "[]"); } catch { return []; }
}

const GUEST_COLORS = Object.keys(COLOR_CLASSES);
let guestNextId = computed(() => categories.value.reduce((m, c) => Math.max(m, c.id), 0) + 1);
function guestNextColor() { return GUEST_COLORS[categories.value.length % GUEST_COLORS.length] as string; }
function saveGuest() { localStorage.setItem(GUEST_KEY, JSON.stringify(categories.value)); }

onMounted(async () => {
  if (isGuest.value) {
    categories.value = loadFromStorage();
  } else if (loggedIn.value) {
    categories.value = await loadFromApi();
  }
});

// --- Add ---
async function addCategory() {
  if (isGuest.value) {
    categories.value.push({ id: guestNextId.value, label: t("incomeCategories.newCategory"), color: guestNextColor() });
    saveGuest();
    return;
  }
  saving.value = true;
  try {
    const cat = await apiFetch<Category>("/api/income-categories", {
      method: "POST",
      body: { label: t("incomeCategories.newCategory") },
    });
    categories.value.push(cat);
  } finally { saving.value = false; }
}

// --- Update (debounced) ---
const timers: Record<number, ReturnType<typeof setTimeout>> = {};

function onInput(cat: Category) {
  if (isGuest.value) { saveGuest(); return; }
  clearTimeout(timers[cat.id]);
  timers[cat.id] = setTimeout(async () => {
    await apiFetch(`/api/income-categories/${cat.id}`, {
      method: "PUT",
      body: { label: cat.label },
    });
  }, 600);
}

// --- Delete ---
async function removeCategory(id: number) {
  if (isGuest.value) {
    categories.value = categories.value.filter((c) => c.id !== id);
    saveGuest();
    return;
  }
  await apiFetch(`/api/income-categories/${id}`, { method: "DELETE" });
  categories.value = categories.value.filter((c) => c.id !== id);
}

const income = computed(() => totals.value.income);
</script>

<template>
  <div class="flex flex-col gap-10">
    <UPageHeader
      :title="$t('incomeCategories.title')"
      :description="$t('incomeCategories.description')"
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">{{ $t('incomeCategories.badge') }}</UBadge>
      </template>
    </UPageHeader>

    <!-- Categories -->
    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-white">{{ $t('incomeCategories.title') }}</h2>
        <UButton icon="i-heroicons-plus" color="primary" variant="subtle" size="sm" :loading="saving" @click="addCategory">
          {{ $t('incomeCategories.addCategory') }}
        </UButton>
      </div>

      <div v-if="categories.length === 0" class="glass-card rounded-2xl p-6 text-center text-slate-400">
        {{ $t('incomeCategories.noCategories') }}
      </div>

      <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div v-for="cat in categories" :key="cat.id"
          class="glass-card flex items-center gap-2 rounded-xl px-3 py-2.5">
          <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :class="colorOf(cat).bar" />
          <input
            v-model="cat.label"
            type="text"
            class="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            :placeholder="$t('incomeCategories.labelPlaceholder')"
            @input="onInput(cat)"
          />
          <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs"
            :aria-label="$t('common.delete')" @click="removeCategory(cat.id)" />
        </div>
      </div>
    </section>
  </div>
</template>
