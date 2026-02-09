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
      description="Import your latest transactions in minutes."
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle">Import</UBadge>
      </template>
    </UPageHeader>

    <div class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <ImportForm @submit="handleImport" />
      <UCard class="surface-panel">
        <h3 class="text-lg font-semibold text-white">How it works</h3>
        <ol class="mt-4 space-y-3 text-sm text-slate-300">
          <li>1. Export a CSV from your bank or card provider.</li>
          <li>2. Upload it here and set default category/type if needed.</li>
          <li>3. Review and edit any entries on the Transactions page.</li>
        </ol>
        <UAlert
          class="mt-4"
          color="neutral"
          variant="subtle"
          title="Tip"
          description="If your CSV uses a different date format, edit a single row after import."
        />
      </UCard>
    </div>

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
