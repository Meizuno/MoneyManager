<script setup lang="ts">
// Sign-in. The account is the shared Meizuno one (the central auth service
// runs the Google flow), so this page only explains the app and hands over.
// On a wide screen a brand panel shows what the overview looks like.
definePageMeta({ layout: false });

const { t } = useI18n();
const { user } = useAuth();
if (user.value) await navigateTo("/");

const route = useRoute();
const failed = computed(() => route.query.error === "auth_failed");
// Under the app's base path (a proxy in dev), not the domain root.
const loginUrl = `${useRuntimeConfig().app.baseURL}api/auth/login`;

// The brand panel's illustration: a budget the way the overview draws it.
const sample = [
  { label: "Rent", color: "#06b6d4", share: 0.85, note: "2,875 left" },
  { label: "Groceries", color: "#10b981", share: 1.02, note: "192 over" },
  { label: "Savings", color: "#8b5cf6", share: 0.82, note: "2,820 left" },
  { label: "Car", color: "#0ea5e9", share: 0.62, note: "2,404 left" },
];

const features = computed(() => [
  { icon: "i-heroicons-chart-pie", title: t("login.featureBudget"), text: t("login.featureBudgetText") },
  { icon: "i-heroicons-bolt", title: t("login.featureQuick"), text: t("login.featureQuickText") },
  { icon: "i-heroicons-arrow-trending-up", title: t("login.featureTrend"), text: t("login.featureTrendText") },
]);

useHead({ title: t("login.pageTitle") });
</script>

<template>
  <div class="grid min-h-screen bg-default lg:grid-cols-[1.1fr_1fr]">
    <!-- Brand panel -->
    <aside class="relative hidden overflow-hidden bg-linear-to-br from-cyan-600 via-cyan-800 to-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div class="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-cyan-300/20 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-violet-500/20 blur-3xl" />

      <div class="relative flex items-center gap-2.5">
        <span class="grid size-9 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25">
          <UIcon name="i-heroicons-banknotes" class="size-5" />
        </span>
        <span class="font-display text-lg font-semibold">Money Manager</span>
      </div>

      <div class="relative max-w-md">
        <h2 class="font-display text-4xl font-semibold leading-tight tracking-tight">{{ $t('login.headline') }}</h2>
        <p class="mt-4 text-base text-cyan-50/80">{{ $t('login.pitch') }}</p>

        <div class="mt-10 rounded-2xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur" aria-hidden="true">
          <div class="flex items-baseline justify-between">
            <span class="text-sm text-cyan-50/70">{{ $t('overview.leftOver') }}</span>
            <span class="font-display text-2xl font-semibold">CZK 12,620</span>
          </div>
          <ul class="mt-4 flex flex-col gap-3">
            <li v-for="row in sample" :key="row.label">
              <div class="flex justify-between text-sm">
                <span class="flex items-center gap-2"><span class="size-2 rounded-full" :style="{ backgroundColor: row.color }" />{{ row.label }}</span>
                <span :class="row.share > 1 ? 'text-rose-200' : 'text-cyan-50/80'">{{ row.note }}</span>
              </div>
              <div class="mt-1.5 h-1.5 rounded-full bg-white/15">
                <div class="h-full rounded-full" :style="{ width: `${Math.min(row.share, 1) * 100}%`, backgroundColor: row.share > 1 ? '#fb7185' : row.color }" />
              </div>
            </li>
          </ul>
        </div>
      </div>

      <p class="relative text-xs text-cyan-50/60">{{ $t('login.footer') }}</p>
    </aside>

    <!-- Sign-in -->
    <main class="flex items-center justify-center px-6 py-12">
      <div class="w-full max-w-sm">
        <div class="mb-10 flex items-center gap-2.5 lg:hidden">
          <span class="grid size-9 place-items-center rounded-lg bg-linear-to-br from-cyan-500 to-cyan-700 text-white">
            <UIcon name="i-heroicons-banknotes" class="size-5" />
          </span>
          <span class="font-display text-lg font-semibold text-highlighted">Money Manager</span>
        </div>

        <h1 class="font-display text-3xl font-semibold tracking-tight text-highlighted">{{ $t('login.title') }}</h1>
        <p class="mt-2 text-sm text-muted">{{ $t('login.subtitle') }}</p>

        <UAlert
          v-if="failed"
          class="mt-6"
          color="error"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :title="$t('login.failedTitle')"
          :description="$t('login.failedDesc')"
        />

        <UButton
          :href="loginUrl"
          external
          block
          size="xl"
          color="neutral"
          variant="outline"
          class="mt-8 gap-3"
        >
          <svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
            <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4.01-3.1Z" />
            <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
          </svg>
          {{ $t('login.google') }}
        </UButton>

        <ul class="mt-10 flex flex-col gap-4">
          <li v-for="feature in features" :key="feature.title" class="flex gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <UIcon :name="feature.icon" class="size-5" />
            </span>
            <span>
              <span class="block text-sm font-medium text-highlighted">{{ feature.title }}</span>
              <span class="block text-sm text-muted">{{ feature.text }}</span>
            </span>
          </li>
        </ul>
      </div>
    </main>
  </div>
</template>
