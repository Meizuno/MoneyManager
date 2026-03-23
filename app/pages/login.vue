<script setup lang="ts">
definePageMeta({ layout: false });

const { user } = useAuth();
if (user.value) await navigateTo("/");

const { isGuest, enterGuest } = useGuest();
if (isGuest.value) await navigateTo("/");

function signIn() {
  window.location.href = "/api/auth/login";
}

function continueAsGuest() {
  enterGuest();
  navigateTo("/");
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-950">
    <div class="flex flex-col items-center gap-8 rounded-2xl border border-white/10 bg-white/5 p-10 shadow-2xl">
      <div class="flex items-center gap-3">
        <div class="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15">
          <UIcon name="i-heroicons-banknotes" class="h-6 w-6 text-cyan-300" />
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Money Manager</p>
          <h1 class="text-xl font-semibold text-white">{{ $t('header.tagline') }}</h1>
        </div>
      </div>
      <UButton size="lg" color="primary" variant="solid" @click="signIn">
        <UIcon name="i-heroicons-arrow-right-on-rectangle" class="mr-2 h-5 w-5" />
        {{ $t('auth.signIn') }}
      </UButton>
      <UButton size="md" color="neutral" variant="ghost" @click="continueAsGuest">
        {{ $t('auth.continueAsGuest') }}
      </UButton>
    </div>
  </div>
</template>
