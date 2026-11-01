<script setup lang="ts">
import type { RecurringTransaction } from "#shared/schemas/recurring";

// The recurring transactions, on the transactions page: folded to a line
// that says how many there are and which comes next, open to a row each.
// A row opens it in the editor — to change what it writes, pause it or
// delete it. Nothing at all when there are none: a repeat is made from the
// form ("Repeat"), and an empty box here would only be in the way.
const { listRecurring, scheduleLabel } = useRecurring();
const { openRecurring } = useTransactionEditor();
const { colorOf } = useCategories();

const { data: rules } = await useAsyncData("recurring", () => listRecurring(), { default: () => [] as RecurringTransaction[] });

const open = ref(false);
const upcoming = computed(() => rules.value.find(r => !r.paused && r.next_date));

function status(rule: RecurringTransaction) {
  if (rule.paused) return "paused";
  return rule.next_date ? "next" : "finished";
}
</script>

<template>
  <UCollapsible v-if="rules.length" v-model:open="open" class="panel" :ui="{ content: 'motion-reduce:animate-none' }">
    <button type="button" class="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left">
      <span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <UIcon name="i-heroicons-arrow-path" class="size-4" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-semibold text-highlighted">
          {{ $t('recurring.title') }} <span class="font-normal text-muted">· {{ rules.length }}</span>
        </span>
        <span v-if="upcoming" class="block truncate text-xs text-muted">
          {{ $t('recurring.upcoming', { name: upcoming.name, date: shortDay(upcoming.next_date!) }) }}
        </span>
      </span>
      <UIcon name="i-heroicons-chevron-down" class="size-4 shrink-0 text-muted transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <template #content>
      <ul class="divide-y divide-default border-t border-default">
        <li v-for="rule in rules" :key="rule.id">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated/60"
            :class="{ 'opacity-60': rule.paused || !rule.next_date }"
            @click="openRecurring(rule)"
          >
            <span
              class="grid size-8 shrink-0 place-items-center rounded-full"
              :style="{ backgroundColor: `${colorOf(rule.type, rule.category.id)}22`, color: colorOf(rule.type, rule.category.id) }"
            >
              <UIcon :name="rule.paused ? 'i-heroicons-pause' : 'i-heroicons-arrow-path'" class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-highlighted">{{ rule.name }}</span>
              <span class="block truncate text-xs text-muted">
                {{ scheduleLabel(rule.unit, rule.every) }} ·
                {{ status(rule) === 'next'
                  ? $t('recurring.next', { date: shortDay(rule.next_date!) })
                  : $t(`recurring.${status(rule)}`) }}
              </span>
            </span>
            <span
              class="shrink-0 text-sm font-semibold tabular-nums"
              :class="rule.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-highlighted'"
            >
              {{ rule.type === 'income' ? '+' : '−' }}{{ formatNumber(rule.amount) }}
            </span>
          </button>
        </li>
      </ul>
    </template>
  </UCollapsible>
</template>
