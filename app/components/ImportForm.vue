<script setup lang="ts">
import { computed, ref } from "vue";

const emit = defineEmits<{
  (event: "submit", payload: { file: File }): void;
}>();

const csvFile = ref<File | null>(null);
const isReady = computed(() => Boolean(csvFile.value));

const submitImport = () => {
  if (!csvFile.value) return;
  emit("submit", {
    file: csvFile.value,
  });
  csvFile.value = null;
};
</script>

<template>
  <UCard class="glass-card">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-white">Import bank CSV</h2>
        <p class="mt-1 text-sm text-slate-300">
          Upload a CSV export and set defaults for rows missing metadata.
        </p>
      </div>
      <UBadge color="primary" variant="subtle">CSV upload</UBadge>
    </div>
    <div class="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div class="space-y-4">
        <UFormField label="CSV file" help="Export from your bank, then drag and drop the file here.">
          <UFileUpload v-model="csvFile" accept=".csv" :multiple="false" />
        </UFormField>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            color="primary"
            variant="solid"
            :disabled="!isReady"
            @click="submitImport"
          >
            Import transactions
          </UButton>
          <p class="text-xs text-slate-400">
            We auto-assign missing type or category as “other”.
          </p>
        </div>
      </div>
      <div class="space-y-3">
        <UAlert
          color="neutral"
          variant="subtle"
          title="Expected columns"
          description="date, description, amount, debit/credit, type, category."
        />
        <UAlert
          color="neutral"
          variant="subtle"
          title="Privacy"
          description="Your data stays private and is saved only for signed-in users."
        />
      </div>
    </div>
  </UCard>
</template>
