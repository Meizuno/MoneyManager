<script setup lang="ts">
// The add/edit window, mounted once in the layout and driven by
// useTransactionEditor. A centred dialog on wider screens; on a phone a
// sheet from the bottom, where the thumb and the keyboard are.
const { t } = useI18n();
const { state, close } = useTransactionEditor();

const open = computed({
  get: () => state.value.open,
  set: (value: boolean) => {
    if (!value) close();
  },
});

// Read out by screen readers; the form explains itself on screen.
const description = computed(() => t(state.value.transaction ? "editor.editDescription" : "editor.newDescription"));

const title = computed(() => {
  if (state.value.transaction) return t("editor.editTitle");
  return t(state.value.type === "income" ? "editor.newIncome" : "editor.newExpense");
});

// A fresh form for every opening, so it starts from the transaction being
// edited (or empty) rather than from whatever was typed last time.
const opening = ref(0);
watch(() => state.value.open, (isOpen) => {
  if (isOpen) opening.value++;
});

const phone = ref(false);
onMounted(() => {
  const query = window.matchMedia("(max-width: 639px)");
  phone.value = query.matches;
  query.addEventListener("change", (event) => {
    phone.value = event.matches;
  });
});
</script>

<template>
  <UDrawer
    v-if="phone"
    v-model:open="open"
    :title="title"
    :description="description"
    :ui="{ body: 'pb-6', description: 'sr-only' }"
  >
    <template #body>
      <TransactionForm :key="opening" :transaction="state.transaction" :type="state.type" @done="close" />
    </template>
  </UDrawer>
  <UModal
    v-else
    v-model:open="open"
    :title="title"
    :description="description"
    :ui="{ content: 'sm:max-w-md', description: 'sr-only' }"
  >
    <template #body>
      <TransactionForm :key="opening" :transaction="state.transaction" :type="state.type" @done="close" />
    </template>
  </UModal>
</template>
