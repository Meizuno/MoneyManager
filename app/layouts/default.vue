<script setup lang="ts">
const { t } = useI18n();

const navLinks = computed(() => [
  { label: t("nav.overview"), to: "/" },
  { label: t("nav.transactions"), to: "/transactions" },
  { label: t("nav.salesSplit"), to: "/sales-split" },
  { label: t("nav.incomeCategories"), to: "/income-categories" },
]);

const { user, logout } = useAuth();
const { isGuest, exitGuest } = useGuest();

async function leaveGuest() {
  exitGuest();
  await navigateTo("/login");
}

</script>

<template>
  <div class="min-h-screen bg-surface text-ink">
    <header class="sticky top-0 z-40 border-b border-white/5 bg-black/40 backdrop-blur">
      <UContainer class="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-3">
          <div class="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15">
            <UIcon name="i-heroicons-banknotes" class="text-cyan-300" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Money Manager
            </p>
            <h1 class="text-2xl font-semibold tracking-tight text-white">
              {{ $t('header.tagline') }}
            </h1>
          </div>
        </div>
        <nav class="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-200">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-white"
            active-class="border-cyan-400/60 text-white"
          >
            {{ link.label }}
          </NuxtLink>
          <div class="h-6 w-px bg-white/10"></div>
          <ClientOnly>
            <div v-if="isGuest" class="flex items-center gap-2">
              <span class="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                {{ $t('auth.guest') }}
              </span>
              <UButton color="neutral" variant="outline" size="sm" @click="leaveGuest">
                {{ $t('auth.signIn') }}
              </UButton>
            </div>
            <div v-else class="flex items-center gap-2">
              <span class="text-xs text-slate-300">{{ user?.name ?? $t('auth.signedIn') }}</span>
              <UButton color="neutral" variant="outline" size="sm" @click="logout">
                {{ $t('auth.logOut') }}
              </UButton>
            </div>
          </ClientOnly>
        </nav>
      </UContainer>
    </header>
    <main class="py-10">
      <UContainer>
        <NuxtPage />
      </UContainer>
    </main>
  </div>
</template>
