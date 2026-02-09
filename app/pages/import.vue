<script setup lang="ts">
const { errorMessage, statusMessage, importCsv } = useTransactions();

const handleImport = async (payload: {
  file: File;
  defaultCategory: string;
  defaultType: string;
}) => {
  await importCsv(payload);
};

useHead({
  title: "Import CSV",
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <UPageHeader
      title="Bring in your bank CSV"
      description="Imports are stored only for authenticated users."
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">Import</UBadge>
      </template>
    </UPageHeader>

    <ImportForm @submit="handleImport" />

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      class="glass-card"
      title="Import failed"
      :description="errorMessage"
    />
    <UAlert
      v-if="statusMessage"
      color="success"
      variant="subtle"
      class="glass-card"
      title="Import result"
      :description="statusMessage"
    />
  </div>
</template>
