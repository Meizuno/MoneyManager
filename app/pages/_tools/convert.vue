<script setup lang="ts">
type ConvertResult = {
  converted: number;
  skipped: number;
  items: Array<{
    date: string;
    name: string;
    amount: number;
    currency: string | null;
    type: string;
    category: string;
  }>;
  csv: string;
};

const { apiFetch } = useAuth();
const file = ref<File | null>(null);
const result = ref<ConvertResult | null>(null);
const errorMessage = ref("");
const isReady = computed(() => Boolean(file.value));

const downloadCsv = () => {
  if (!result.value?.csv) return;
  const blob = new Blob([result.value.csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "transactions.normalized.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const downloadJson = () => {
  if (!result.value?.items?.length) return;
  const blob = new Blob([JSON.stringify(result.value.items, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "transactions.normalized.json";
  link.click();
  URL.revokeObjectURL(url);
};

const convertCsv = async () => {
  errorMessage.value = "";
  result.value = null;
  if (!file.value) return;

  const formData = new FormData();
  formData.append("file", file.value);

  try {
    result.value = await apiFetch<ConvertResult>("/api/transactions/convert", {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    errorMessage.value = "Conversion failed.";
  }
};

useHead({
  title: "CSV Converter",
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <UPageHeader
      title="Hidden CSV converter"
      description="Normalize a bank CSV into the transaction table structure."
      class="surface-panel rounded-3xl px-6 py-6"
    >
      <template #headline>
        <UBadge color="neutral" variant="subtle">Internal</UBadge>
      </template>
    </UPageHeader>

    <div class="grid gap-6 lg:grid-cols-[0.7fr_1fr_1fr]">
      <UCard class="glass-card lg:max-w-sm">
        <div class="space-y-4">
          <UFormField label="CSV file" help="Upload the raw bank export.">
            <UFileUpload v-model="file" accept=".csv" :multiple="false" />
          </UFormField>
          <div class="flex flex-wrap items-center gap-3">
            <UButton color="primary" variant="solid" :disabled="!isReady" @click="convertCsv">
              Convert
            </UButton>
            <p class="text-xs text-slate-400">
              Output columns: date, name, amount, currency, type, category.
            </p>
          </div>
        </div>
      </UCard>

      <UCard class="surface-panel">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-lg font-semibold text-white">JSON output</h3>
          <UBadge v-if="result" color="neutral" variant="subtle">
            {{ result.converted }} converted / {{ result.skipped }} skipped
          </UBadge>
        </div>
        <div v-if="result" class="mt-4 space-y-3 text-sm text-slate-300">
          <UButton color="neutral" variant="outline" @click="downloadJson">
            Download JSON
          </UButton>
          <UAlert
            v-if="result.items.length"
            color="neutral"
            variant="subtle"
            title="Preview (first row)"
          >
            <template #description>
              <pre class="whitespace-pre-wrap text-xs text-slate-200"><code class="language-json">{{
                JSON.stringify(result.items[0], null, 2)
              }}</code></pre>
            </template>
          </UAlert>
        </div>
        <p v-else class="mt-4 text-sm text-slate-400">
          Convert a file to generate JSON output.
        </p>
      </UCard>

      <UCard class="surface-panel">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-lg font-semibold text-white">CSV output</h3>
          <UBadge v-if="result" color="neutral" variant="subtle">
            {{ result.converted }} converted / {{ result.skipped }} skipped
          </UBadge>
        </div>
        <div v-if="result" class="mt-4 space-y-3 text-sm text-slate-300">
          <UButton color="primary" variant="solid" @click="downloadCsv">
            Download CSV
          </UButton>
          <UAlert
            v-if="result.items.length"
            color="neutral"
            variant="subtle"
            title="Preview (first row)"
          >
            <template #description>
              <pre class="whitespace-pre-wrap text-xs text-slate-200"><code class="language-csv">{{
                `date,name,amount,currency,type,category\n${result.items[0].date},${result.items[0].name},${result.items[0].amount},${result.items[0].currency ?? ""},${result.items[0].type},${result.items[0].category}`
              }}</code></pre>
            </template>
          </UAlert>
        </div>
        <p v-else class="mt-4 text-sm text-slate-400">
          Convert a file to generate CSV output.
        </p>
      </UCard>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      class="glass-card"
      title="Conversion failed"
      :description="errorMessage"
    />
  </div>
</template>
