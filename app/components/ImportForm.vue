<script setup lang="ts">

const emit = defineEmits<{
  (event: "submit", payload: { file: File; format: "csv" | "json" }): void;
}>();

const csvFile = ref<File | null>(null);
const format = ref<"csv" | "json">("csv");
const isReady = computed(() => Boolean(csvFile.value));
const acceptType = computed(() => (format.value === "json" ? ".json" : ".csv"));

const submitImport = () => {
  if (!csvFile.value) return;
  emit("submit", {
    file: csvFile.value,
    format: format.value,
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
        <UFormField label="File format" help="Choose CSV or JSON with strict columns.">
          <USelect
            v-model="format"
            :items="[
              { label: 'CSV (normalized)', value: 'csv' },
              { label: 'JSON (array)', value: 'json' },
            ]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="File" help="Upload a normalized file for import.">
          <UFileUpload v-model="csvFile" :accept="acceptType" :multiple="false" />
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
            Missing type or category becomes “other”.
          </p>
        </div>
      </div>
      <div class="space-y-3">
        <UAlert
          color="neutral"
          variant="subtle"
          title="Expected columns"
          description="date, name, amount, currency, type, category."
        />
        <UAlert
          color="neutral"
          variant="subtle"
          title="JSON shape"
          description="Array of objects with date, name, amount, currency, type, category."
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
