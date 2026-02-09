<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{
  (event: "submit", payload: { file: File; defaultCategory: string; defaultType: string }): void;
}>();

const csvFile = ref<File | null>(null);
const csvDefaultCategory = ref("other");
const csvDefaultType = ref("other");

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
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-xl font-semibold text-white">Import CSV</h2>
      <UBadge color="primary" variant="subtle">Bank export</UBadge>
    </div>
    <div class="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
      <UFormField label="CSV file">
        <UFileUpload v-model="csvFile" accept=".csv" :multiple="false" />
      </UFormField>
      <div class="flex flex-col gap-3">
        <UFormField label="Default category">
          <UInput v-model="csvDefaultCategory" placeholder="other" />
        </UFormField>
        <UFormField label="Default type">
          <UInput v-model="csvDefaultType" placeholder="other" />
        </UFormField>
        <UButton color="primary" variant="solid" @click="submitImport">
          Import transactions
        </UButton>
      </div>
    </div>
    <p class="mt-4 text-xs text-slate-400">
      CSV headers are auto-matched (date, description, amount, debit/credit, type,
      category).
    </p>
  </UCard>
</template>
