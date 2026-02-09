<script setup lang="ts">
import { computed, ref } from "vue";

const emit = defineEmits<{
  (event: "submit", payload: { file: File; defaultCategory: string; defaultType: string }): void;
}>();

const csvFile = ref<File | null>(null);
const csvDefaultCategory = ref("other");
const csvDefaultType = ref("other");
const isReady = computed(() => Boolean(csvFile.value));

const submitImport = () => {
  if (!csvFile.value) return;
  emit("submit", {
    file: csvFile.value,
    defaultCategory: csvDefaultCategory.value || "other",
    defaultType: csvDefaultType.value || "other",
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
    <div class="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
      <div class="space-y-3">
        <UFormField label="CSV file" help="Export from your bank, then drag and drop the file here.">
          <UFileUpload v-model="csvFile" accept=".csv" :multiple="false" />
        </UFormField>
        <UAlert
          color="neutral"
          variant="subtle"
          title="Expected columns"
          description="date, description, amount, debit/credit, type, category."
        />
      </div>
      <div class="flex flex-col gap-3">
        <UFormField
          label="Default category"
          help="Applied when a row has no category."
        >
          <UInput v-model="csvDefaultCategory" placeholder="other" />
        </UFormField>
        <UFormField label="Default type" help="Applied when a row has no type.">
          <UInput v-model="csvDefaultType" placeholder="other" />
        </UFormField>
        <UButton
          color="primary"
          variant="solid"
          :disabled="!isReady"
          @click="submitImport"
        >
          Import transactions
        </UButton>
        <p class="text-xs text-slate-400">
          Your data stays private and is saved only for signed-in users.
        </p>
      </div>
    </div>
  </UCard>
</template>
