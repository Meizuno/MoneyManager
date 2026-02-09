<script setup lang="ts">
const navLinks = [
  { label: "Overview", to: "/" },
  { label: "Import", to: "/import" },
  { label: "Transactions", to: "/transactions" },
];

const { loggedIn, user, logout } = useAuth();
const authReady = ref(false);

onMounted(() => {
  authReady.value = true;
});
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
              Cashflow control
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
          <div v-if="!authReady" class="h-8 w-28 rounded-full bg-white/5"></div>
          <UButton
            v-else-if="!loggedIn"
            href="/api/auth/google"
            external
            color="primary"
            variant="solid"
            size="sm"
          >
            Sign in with Google
          </UButton>
          <div v-else class="flex items-center gap-2">
            <span class="text-xs text-slate-300">{{ user?.name ?? "Signed in" }}</span>
            <UButton color="neutral" variant="outline" size="sm" @click="logout">
              Log out
            </UButton>
          </div>
        </nav>
      </UContainer>
    </header>
    <div
      v-if="authReady && !loggedIn"
      class="border-b border-amber-400/20 bg-amber-400/10"
    >
      <UContainer class="py-2">
        <div class="flex items-center gap-2 text-xs text-amber-200">
          <span class="h-1.5 w-1.5 rounded-full bg-amber-300"></span>
          <span class="font-semibold">Anonymous mode:</span>
          <span>Data imported while anonymous is not stored.</span>
        </div>
      </UContainer>
    </div>
    <main class="py-10">
      <UContainer>
        <NuxtPage />
      </UContainer>
    </main>
  </div>
</template>
