<script setup lang="ts">
const { t } = useI18n();

const navLinks = computed(() => [
  { label: t("nav.overview"), to: "/" },
  { label: t("nav.transactions"), to: "/transactions" },
  { label: t("nav.categories"), to: "/categories" },
]);

const { user, logout } = useAuth();

// Mobile nav lives behind a hamburger on small screens; close it whenever
// the route changes so it doesn't linger after navigating.
const mobileOpen = ref(false);
const route = useRoute();
watch(() => route.fullPath, () => { mobileOpen.value = false; });
</script>

<template>
  <div class="min-h-screen bg-surface text-ink">
    <header class="sticky top-0 z-40 border-b border-default bg-white/70 backdrop-blur dark:bg-black/40">
      <UContainer class="py-3 md:py-5">
        <div class="flex items-center justify-between gap-3">
          <!-- Brand -->
          <NuxtLink to="/" class="flex items-center gap-2 md:gap-3">
            <div class="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 md:h-11 md:w-11">
              <UIcon name="i-heroicons-banknotes" class="text-cyan-600 dark:text-cyan-300" />
            </div>
            <div>
              <p class="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-cyan-600 md:text-xs md:tracking-[0.3em] dark:text-cyan-300">
                Money Manager
              </p>
              <h1 class="text-base font-semibold tracking-tight text-highlighted md:text-xl">
                {{ $t('header.tagline') }}
              </h1>
            </div>
          </NuxtLink>

          <!-- Desktop nav -->
          <nav class="hidden items-center gap-2 text-sm font-semibold md:flex">
            <NuxtLink
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              class="rounded-full border border-transparent px-4 py-2 text-muted transition hover:border-cyan-400/40 hover:text-highlighted"
              active-class="border-cyan-400/60 text-highlighted"
            >
              {{ link.label }}
            </NuxtLink>
            <div class="mx-1 h-6 w-px bg-accented" />
            <!-- Signed-in user is populated during SSR, so it renders on the
                 first server paint. -->
            <div v-if="user" class="flex items-center gap-2">
              <span class="text-xs text-muted">{{ user.name ?? $t('auth.signedIn') }}</span>
              <UButton color="neutral" variant="outline" size="sm" @click="logout">
                {{ $t('auth.logOut') }}
              </UButton>
            </div>
          </nav>

          <!-- Mobile hamburger -->
          <UButton
            class="md:hidden"
            :icon="mobileOpen ? 'i-heroicons-x-mark' : 'i-heroicons-bars-3'"
            color="neutral"
            variant="ghost"
            :aria-label="mobileOpen ? 'Close menu' : 'Open menu'"
            @click="mobileOpen = !mobileOpen"
          />
        </div>

        <!-- Mobile collapsible menu -->
        <nav
          v-if="mobileOpen"
          class="mt-3 flex flex-col gap-1 border-t border-default pt-3 text-sm font-semibold md:hidden"
        >
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="rounded-lg px-3 py-2 text-muted transition hover:bg-elevated hover:text-highlighted"
            active-class="bg-elevated text-highlighted"
          >
            {{ link.label }}
          </NuxtLink>
          <div v-if="user" class="mt-1 flex items-center justify-between gap-2 border-t border-default pt-3">
            <span class="text-xs text-muted">{{ user.name ?? $t('auth.signedIn') }}</span>
            <UButton color="neutral" variant="outline" size="sm" @click="logout">
              {{ $t('auth.logOut') }}
            </UButton>
          </div>
        </nav>
      </UContainer>
    </header>
    <main class="py-8 md:py-10">
      <UContainer>
        <NuxtPage />
      </UContainer>
    </main>
  </div>
</template>
