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
      <UContainer class="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:py-6">
        <div class="flex items-center gap-2 md:gap-3">
          <div class="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 md:h-12 md:w-12 md:rounded-2xl">
            <UIcon name="i-heroicons-banknotes" class="text-cyan-600 dark:text-cyan-300" />
          </div>
          <div>
            <p class="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-cyan-600 md:text-xs md:tracking-[0.3em] dark:text-cyan-300">
              Money Manager
            </p>
            <h1 class="text-lg font-semibold tracking-tight text-highlighted md:text-2xl">
              {{ $t('header.tagline') }}
            </h1>
          </div>
        </div>
        <nav class="-mx-1 flex items-center gap-1 overflow-x-auto px-1 text-sm font-semibold text-muted md:flex-wrap md:gap-2">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="shrink-0 whitespace-nowrap rounded-full border border-transparent px-3 py-1.5 font-semibold text-muted transition hover:border-cyan-400/40 hover:text-highlighted md:px-4 md:py-2"
            active-class="border-cyan-400/60 text-highlighted"
          >
            {{ link.label }}
          </NuxtLink>
          <div class="mx-1 h-5 w-px shrink-0 bg-accented md:h-6"/>
          <!-- Signed-in user is populated during SSR, so it renders on the
               first server paint. -->
          <div v-if="user" class="flex shrink-0 items-center gap-2">
            <span class="hidden text-xs text-muted sm:inline">{{ user.name ?? $t('auth.signedIn') }}</span>
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
