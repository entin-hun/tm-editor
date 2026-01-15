<template>
  <q-badge :color="badgeColor" :label="badgeLabel" class="data-source-badge">
    <q-tooltip v-if="confidence !== undefined">
      Confidence: {{ Math.round(confidence * 100) }}%
    </q-tooltip>
  </q-badge>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Props
interface Props {
  source: string;
  confidence?: number;
}

const props = defineProps<Props>();

// Computed
const badgeColor = computed(() => {
  switch (props.source.toLowerCase()) {
    case 'openfoodfacts':
      return 'orange';
    case 'openlca':
      return 'green';
    case 'oshwa':
      return 'blue';
    case 'wikifab':
      return 'purple';
    case 'manual':
      return 'grey';
    default:
      return 'grey';
  }
});

const badgeLabel = computed(() => {
  // Format source name nicely
  switch (props.source.toLowerCase()) {
    case 'openfoodfacts':
      return 'OpenFoodFacts';
    case 'openlca':
      return 'OpenLCA';
    case 'oshwa':
      return 'OSHWA';
    case 'wikifab':
      return 'WikiFab';
    case 'manual':
      return 'Manual';
    default:
      return props.source;
  }
});
</script>

<style scoped>
.data-source-badge {
  font-size: 0.7rem;
}
</style>
