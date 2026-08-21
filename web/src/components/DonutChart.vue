<script setup>
import { computed } from "vue";

const props = defineProps({
  segments: { type: Array, required: true }, // [{ label, value, color }]
  size: { type: Number, default: 160 },
});

const total = computed(() => props.segments.reduce((sum, s) => sum + s.value, 0));
const radius = computed(() => props.size / 2 - 12);
const circumference = computed(() => 2 * Math.PI * radius.value);

const arcs = computed(() => {
  if (total.value <= 0) return [];
  let cumulative = 0;
  return props.segments
    .filter((s) => s.value > 0)
    .map((segment) => {
      const fraction = segment.value / total.value;
      const dash = fraction * circumference.value;
      const offset = -cumulative * circumference.value;
      cumulative += fraction;
      return { ...segment, dash, offset };
    });
});
</script>

<template>
  <div class="donut-wrap">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <g :transform="`translate(${size / 2}, ${size / 2}) rotate(-90)`">
        <circle v-if="!arcs.length" :r="radius" fill="none" stroke="var(--border)" stroke-width="14" />
        <circle
          v-for="arc in arcs"
          :key="arc.label"
          :r="radius"
          fill="none"
          :stroke="arc.color"
          stroke-width="14"
          :stroke-dasharray="`${arc.dash} ${circumference}`"
          :stroke-dashoffset="arc.offset"
          stroke-linecap="butt"
        />
      </g>
      <text x="50%" y="48%" text-anchor="middle" class="donut-total-label" dy="0">Total</text>
      <text x="50%" y="58%" text-anchor="middle" class="donut-total-value" dy="0">
        {{ total.toFixed(0) }} €
      </text>
    </svg>
    <ul class="donut-legend">
      <li v-for="segment in segments" :key="segment.label">
        <span class="legend-swatch" :style="{ background: segment.color }"></span>
        {{ segment.label }} — {{ segment.value.toFixed(2) }} €
      </li>
      <li v-if="!segments.length" class="hint">Aucune donnée ce mois-ci.</li>
    </ul>
  </div>
</template>

<style scoped>
.donut-wrap {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.donut-total-label {
  fill: var(--text-dim);
  font-size: 0.65rem;
}

.donut-total-value {
  fill: var(--text);
  font-size: 0.9rem;
  font-weight: 700;
}

.donut-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--text-dim);
}

.legend-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 0.4rem;
}

.hint {
  color: var(--text-dim);
}
</style>
