<script setup lang="ts">
// Where a notice appears. On a phone, at the top: the bottom is the tab bar
// and the sheet a transaction is edited in, and a notice there sat on the
// form's last row. On a wider screen, out of the way in the corner. No
// progress bar: it timed nothing anybody was waiting for.
const phone = ref(false);
onMounted(() => {
  const query = window.matchMedia("(max-width: 639px)");
  phone.value = query.matches;
  query.addEventListener("change", (event) => (phone.value = event.matches));
});
const toaster = computed(() => phone.value
  // Clear of the notch and the status bar: the page runs under them
  // (viewport-fit=cover in nuxt.config).
  ? { position: "top-center" as const, progress: false, ui: { viewport: "top-[max(1rem,env(safe-area-inset-top))]" } }
  : { position: "bottom-right" as const, progress: false });
</script>

<template>
  <!-- No app-wide UI locale: the amount number field uses a dot decimal
       separator so cents can be typed as "12.50". Date components opt
       into Czech individually (locale="cs"). -->
  <UApp :toaster="toaster">
    <div class="min-h-screen">
      <NuxtRouteAnnouncer />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </UApp>
</template>
