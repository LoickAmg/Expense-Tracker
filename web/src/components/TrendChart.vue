<script setup>
import { computed } from "vue";

const props = defineProps({
  points: { type: Array, required: true }, // [{ month: "2026-01", income, expense }]
  height: { type: Number, default: 160 },
});

const maxValue = computed(() => Math.max(1, ...props.points.flatMap((p) => [p.income, p.expense])));

const barWidth = 18;
const gap = 10;
const groupWidth = barWidth * 2 + gap;
const groupGap = 24;
const width = computed(() => props.points.length * (groupWidth + groupGap));

function barHeight(value) {
  return (value / maxValue.value) * (props.height - 24);
}

function monthLabel(month) {
  const [year, mm] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mm - 1, 1)).toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" });
}
</script>

<template>
  <div class="trend-chart-wrap">
    <svg :width="width" :height="height + 24" :viewBox="`0 0 ${width} ${height + 24}`">
      <g v-for="(point, index) in points" :key="point.month" :transform="`translate(${index * (groupWidth + groupGap)}, 0)`">
        <rect
          :x="0"
          :y="height - barHeight(point.income)"
          :width="barWidth"
          :height="barHeight(point.income)"
          fill="var(--success)"
          rx="2"
        />
        <rect
          :x="barWidth + gap"
          :y="height - barHeight(point.expense)"
          :width="barWidth"
          :height="barHeight(point.expense)"
          fill="var(--danger)"
          rx="2"
        />
        <text :x="groupWidth / 2" :y="height + 16" text-anchor="middle" class="trend-axis-label">
          {{ monthLabel(point.month) }}
        </text>
      </g>
    </svg>
    <div class="trend-legend">
      <span><span class="legend-swatch income"></span> Revenus</span>
      <span><span class="legend-swatch expense"></span> Dépenses</span>
    </div>
  </div>
</template>

<style scoped>
.trend-chart-wrap {
  overflow-x: auto;
}

.trend-axis-label {
  fill: var(--text-dim);
  font-size: 0.7rem;
  text-transform: capitalize;
}

.trend-legend {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--text-dim);
  margin-top: 0.5rem;
}

.legend-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 0.3rem;
}

.legend-swatch.income {
  background: var(--success);
}

.legend-swatch.expense {
  background: var(--danger);
}
</style>
