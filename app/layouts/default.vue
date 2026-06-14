<script setup lang="ts">
const { t } = useI18n();

const navLinks = computed(() => [
  { label: t("nav.overview"), to: "/" },
  { label: t("nav.transactions"), to: "/transactions" },
  { label: t("nav.categories"), to: "/categories" },
]);

const { user, logout } = useAuth();

</script>

<template>
  <div class="min-h-screen bg-surface text-ink">
    <header class="sticky top-0 z-40 border-b border-default bg-white/70 dark:bg-black/40 backdrop-blur">
      <UContainer class="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-3">
          <div class="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15">
            <UIcon name="i-heroicons-banknotes" class="text-cyan-600 dark:text-cyan-300" />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-300">
              Money Manager
            </p>
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
              {{ $t('header.tagline') }}
            </h1>
          </div>
        </div>
        <nav class="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-muted transition hover:border-cyan-400/40 hover:text-highlighted"
            active-class="border-cyan-400/60 text-highlighted"
          >
            {{ link.label }}
          </NuxtLink>
          <div class="h-6 w-px bg-accented"/>
          <!-- Signed-in user is populated during SSR, so it renders on the
               first server paint. -->
          <div v-if="user" class="flex items-center gap-2">
            <span class="text-xs text-muted">{{ user.name ?? $t('auth.signedIn') }}</span>
            <UButton color="neutral" variant="outline" size="sm" @click="logout">
              {{ $t('auth.logOut') }}
            </UButton>
          </div>
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
