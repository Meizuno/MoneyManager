<template>
  <!-- No app-wide UI locale: the amount number field uses a dot decimal
       separator so cents can be typed as "12.50". Date components opt
       into Czech individually (locale="cs"). -->
  <UApp>
    <div class="min-h-screen">
      <NuxtRouteAnnouncer />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </UApp>
</template>
