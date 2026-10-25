<script setup lang="ts">
import { isMonth, periodLabel } from "~/utils/period";

// ‹ October 2026 › — steps a month (or a year) at a time; the label opens
// a month grid with a year switcher, the whole year, and, where the page
// allows it, all time. Reads and writes the address via usePeriod, so two
// of them on one page (the phone's header, the page itself) agree.
// `compact` is the header's: smaller, and its grid opens towards the left.
const props = defineProps<{ allowAll?: boolean; compact?: boolean }>();

const { t } = useI18n();
const { period, thisMonth, canStepForward, step } = usePeriod({ allowAll: props.allowAll });

const label = computed(() => (period.value === "all" ? t("period.allTime") : periodLabel(period.value)));
const open = ref(false);

// The year the grid shows; follows the period, and the arrows in the
// popover browse it without changing the period yet.
const thisYear = Number(thisMonth.slice(0, 4));
const gridYear = ref(thisYear);
watch(period, (value) => {
  gridYear.value = value === "all" ? thisYear : Number(value.slice(0, 4));
}, { immediate: true });

const months = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const value = `${gridYear.value}-${String(i + 1).padStart(2, "0")}`;
    return { value, label: periodLabel(value).split(" ")[0]!.slice(0, 3), future: value > thisMonth };
  }),
);

function pick(value: string) {
  period.value = value;
  open.value = false;
}
</script>

<template>
  <div class="flex items-center gap-0.5">
    <UButton
      icon="i-heroicons-chevron-left"
      color="neutral"
      variant="ghost"
      :size="compact ? 'sm' : 'md'"
      :disabled="period === 'all'"
      :aria-label="$t('period.previous')"
      @click="step(-1)"
    />
    <UPopover v-model:open="open" :content="{ align: compact ? 'end' : 'start', sideOffset: 6 }">
      <UButton
        color="neutral"
        variant="ghost"
        :size="compact ? 'sm' : 'md'"
        :trailing-icon="compact ? undefined : 'i-heroicons-chevron-down'"
        class="font-display font-semibold whitespace-nowrap text-highlighted"
        :class="compact ? 'px-1.5 text-base' : 'text-lg sm:text-xl'"
      >
        {{ label }}
      </UButton>
      <template #content>
        <div class="w-72 p-3">
          <div class="mb-2 flex items-center justify-between">
            <UButton icon="i-heroicons-chevron-left" color="neutral" variant="ghost" size="sm" :aria-label="$t('period.previousYear')" @click="gridYear--" />
            <span class="font-display text-sm font-semibold text-highlighted">{{ gridYear }}</span>
            <UButton
              icon="i-heroicons-chevron-right"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="gridYear >= thisYear"
              :aria-label="$t('period.nextYear')"
              @click="gridYear++"
            />
          </div>
          <div class="grid grid-cols-4 gap-1">
            <UButton
              v-for="month in months"
              :key="month.value"
              :color="month.value === period ? 'primary' : 'neutral'"
              :variant="month.value === period ? 'solid' : 'ghost'"
              :disabled="month.future"
              size="sm"
              class="justify-center"
              @click="pick(month.value)"
            >
              {{ month.label }}
            </UButton>
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5 border-t border-default pt-3">
            <UButton
              size="xs"
              :color="period === String(gridYear) ? 'primary' : 'neutral'"
              :variant="period === String(gridYear) ? 'solid' : 'outline'"
              @click="pick(String(gridYear))"
            >
              {{ $t('period.wholeYear', { year: gridYear }) }}
            </UButton>
            <UButton
              v-if="allowAll"
              size="xs"
              :color="period === 'all' ? 'primary' : 'neutral'"
              :variant="period === 'all' ? 'solid' : 'outline'"
              @click="pick('all')"
            >
              {{ $t('period.allTime') }}
            </UButton>
            <UButton
              v-if="!isMonth(period) || period !== thisMonth"
              size="xs"
              color="neutral"
              variant="ghost"
              class="ml-auto"
              @click="pick(thisMonth)"
            >
              {{ $t('period.thisMonth') }}
            </UButton>
          </div>
        </div>
      </template>
    </UPopover>
    <UButton
      icon="i-heroicons-chevron-right"
      color="neutral"
      variant="ghost"
      :size="compact ? 'sm' : 'md'"
      :disabled="!canStepForward"
      :aria-label="$t('period.next')"
      @click="step(1)"
    />
  </div>
</template>
