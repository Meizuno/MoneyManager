<script setup lang="ts">
// Czech locale drives Nuxt UI's number/date formatting via Reka's
// ConfigProvider — notably the amount field's decimal separator, so
// values read as "12,50" (comma, 2 places). Matches the CZK default and
// the date picker that already renders in cs. UI copy stays English (i18n).
import { cs } from "@nuxt/ui/locale";
</script>

<template>
  <UApp :locale="cs">
    <div class="min-h-screen">
      <NuxtRouteAnnouncer />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </UApp>
</template>
