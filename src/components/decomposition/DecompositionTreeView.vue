<template>
  <div class="decomposition-tree">
    <TreeNode
      v-if="tree"
      :node="tree"
      :level="0"
      @toggle-expansion="$emit('toggle-expansion', $event)"
      @edit-node="
        $emit('edit-node', { nodeId: $event.nodeId, updates: $event.updates })
      "
    />
  </div>
</template>

<script setup lang="ts">
import TreeNode from './TreeNode.vue';
import type { DecompositionNode } from '../../types/decomposition';

interface Props {
  tree?: DecompositionNode;
}

defineProps<Props>();

defineEmits<{
  (e: 'toggle-expansion', nodeId: string): void;
  (e: 'edit-node', payload: { nodeId: string; updates: unknown }): void;
}>();
</script>

<style scoped>
.decomposition-tree {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: auto;
  max-height: 60vh;
}
</style>
