<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

// The app's frame. Wider screens: one header with the pages, Add and the
// account. A phone: a slim header, and the pages as tabs along the bottom
// with + in the middle — within reach of the thumb, like a banking app.
const { t } = useI18n();
const { user, logout } = useAuth();
const { openNew } = useTransactionEditor();
const route = useRoute();

const links = computed(() => [
  { label: t("nav.overview"), to: "/", icon: "i-heroicons-squares-2x2" },
  { label: t("nav.transactions"), to: "/transactions", icon: "i-heroicons-queue-list" },
  { label: t("nav.categories"), to: "/categories", icon: "i-heroicons-chart-pie" },
]);
const active = (to: string) => (to === "/" ? route.path === "/" : route.path.startsWith(to));

const accountItems = computed<DropdownMenuItem[][]>(() => [
  [{ type: "label", label: user.value?.name ?? t("auth.signedIn"), description: user.value?.email ?? undefined, avatar: { src: user.value?.picture ?? undefined, alt: user.value?.name ?? undefined } }],
  [{ label: t("auth.logOut"), icon: "i-heroicons-arrow-right-on-rectangle", onSelect: () => void logout() }],
]);

// N opens a new transaction from anywhere (not while typing in a field).
defineShortcuts({ n: () => openNew() });
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur-md">
      <UContainer class="flex h-14 items-center gap-6 sm:h-16">
        <NuxtLink to="/" class="flex shrink-0 items-center gap-2.5">
          <span class="grid size-8 place-items-center rounded-lg bg-linear-to-br from-cyan-500 to-cyan-700 text-white shadow-sm">
            <UIcon name="i-heroicons-banknotes" class="size-5" />
          </span>
          <span class="font-display text-base font-semibold tracking-tight text-highlighted">Money Manager</span>
        </NuxtLink>

        <nav class="hidden items-center gap-1 sm:flex">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            :class="active(link.to) ? 'bg-elevated text-highlighted' : 'text-muted hover:text-highlighted'"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="ml-auto hidden items-center gap-3 sm:flex">
          <UButton icon="i-heroicons-plus" @click="openNew()">
            {{ $t('nav.add') }}
            <UKbd value="N" size="sm" class="ml-1 hidden bg-white/20 text-white ring-0 lg:inline-flex" />
          </UButton>
          <UDropdownMenu v-if="user" :items="accountItems" :content="{ align: 'end' }">
            <UButton color="neutral" variant="ghost" class="rounded-full p-0.5" :aria-label="$t('nav.account')">
              <UAvatar :src="user.picture ?? undefined" :alt="user.name ?? user.email ?? undefined" size="sm" />
            </UButton>
          </UDropdownMenu>
        </div>
      </UContainer>
    </header>

    <main class="pt-4 pb-28 sm:pt-8 sm:pb-16">
      <UContainer>
        <slot />
      </UContainer>
    </main>

    <!-- Phone: tabs along the bottom, + in the middle. -->
    <nav
      class="fixed inset-x-0 bottom-0 z-40 border-t border-default bg-default/90 backdrop-blur-md sm:hidden"
      :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
      :aria-label="$t('nav.label')"
    >
      <div class="grid h-16 grid-cols-5 items-center">
        <NuxtLink
          v-for="link in links.slice(0, 2)"
          :key="link.to"
          :to="link.to"
          class="flex flex-col items-center gap-0.5 text-[0.625rem] font-medium whitespace-nowrap"
          :class="active(link.to) ? 'text-primary' : 'text-muted'"
        >
          <UIcon :name="link.icon" class="size-6" />
          {{ link.label }}
        </NuxtLink>
        <div class="flex justify-center">
          <button
            type="button"
            class="grid size-13 -translate-y-3 cursor-pointer place-items-center rounded-full bg-linear-to-br from-cyan-500 to-cyan-700 text-white shadow-lg shadow-cyan-700/30 ring-4 ring-(--ui-bg) transition active:scale-95"
            :aria-label="$t('nav.add')"
            @click="openNew()"
          >
            <UIcon name="i-heroicons-plus" class="size-7" />
          </button>
        </div>
        <NuxtLink
          :to="links[2]!.to"
          class="flex flex-col items-center gap-0.5 text-[0.625rem] font-medium whitespace-nowrap"
          :class="active(links[2]!.to) ? 'text-primary' : 'text-muted'"
        >
          <UIcon :name="links[2]!.icon" class="size-6" />
          {{ links[2]!.label }}
        </NuxtLink>
        <UDropdownMenu v-if="user" :items="accountItems" :content="{ align: 'end', side: 'top' }">
          <button type="button" class="flex cursor-pointer flex-col items-center gap-0.5 text-[0.625rem] font-medium whitespace-nowrap text-muted">
            <UAvatar :src="user.picture ?? undefined" :alt="user.name ?? user.email ?? undefined" size="xs" class="size-6" />
            {{ $t('nav.account') }}
          </button>
        </UDropdownMenu>
      </div>
    </nav>

    <TransactionEditor />
  </div>
</template>
