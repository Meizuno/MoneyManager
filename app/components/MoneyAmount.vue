<script setup lang="ts">
// An amount with its currency: the code smaller, the cents a step quieter,
// so the figure that matters reads first. A negative amount gets a real
// minus sign; `signed` adds "+" to a positive one.
const props = withDefaults(defineProps<{
  amount: number;
  currency?: string | null;
  signed?: boolean;
  cents?: boolean;
}>(), { currency: null, signed: false, cents: true });

const parts = computed(() => moneyParts(Math.abs(props.amount), props.currency, props.cents));
const sign = computed(() => {
  if (props.amount < 0) return "−";
  return props.signed && props.amount > 0 ? "+" : "";
});
</script>

<template>
  <span class="whitespace-nowrap tabular-nums">{{ sign }}<template v-for="(part, i) in parts" :key="i"><span
    v-if="part.type === 'currency'"
    class="mr-[0.15em] text-[0.62em] font-medium tracking-wide opacity-60"
  >{{ part.value }}</span><span
    v-else-if="part.type === 'decimal' || part.type === 'fraction'"
    class="opacity-50"
  >{{ part.value }}</span><template v-else-if="part.type !== 'literal'">{{ part.value }}</template></template></span>
</template>
