<template>
  <div class="tree-node" :style="{ marginLeft: level * 20 + 'px' }">
    <!-- Node Header -->
    <div
      class="node-header q-pa-sm"
      :class="{ 'bg-grey-2': level % 2 === 0 }"
      @click.stop="$emit('toggle-expansion', node.id)"
      style="cursor: pointer"
    >
      <div class="row items-center">
        <!-- Expand/Collapse Icon -->
        <q-btn
          v-if="node.children.length > 0"
          flat
          dense
          size="sm"
          :icon="node.expanded ? 'expand_more' : 'chevron_right'"
          @click.stop="$emit('toggle-expansion', node.id)"
        />
        <div v-else style="width: 36px"></div>

        <!-- Node Icon -->
        <q-icon
          :name="getNodeIcon(node)"
          size="sm"
          class="q-mr-sm"
          :color="getNodeColor(node)"
        />

        <!-- Node Name -->
        <div class="col">
          <div class="text-weight-medium">{{ node.data.type }}</div>
          <div v-if="node.data.category" class="text-caption text-grey-7">
            {{ node.data.category }}
          </div>
        </div>

        <!-- External Sources -->
        <div
          v-if="
            node.data.externalSources && node.data.externalSources.length > 0
          "
          class="q-mr-sm"
        >
          <data-source-badge
            v-for="source in node.data.externalSources"
            :key="source.source"
            :source="source.source"
            :confidence="source.confidence"
            class="q-ml-xs"
          />
        </div>

        <!-- Metadata Badges -->
        <q-badge
          v-if="node.metadata.truncated"
          color="warning"
          :label="getTruncationLabel(node)"
          class="q-ml-xs"
        />
        <q-badge
          v-if="node.metadata.manuallyEdited"
          color="info"
          label="Edited"
          class="q-ml-xs"
        />
        <q-badge
          v-if="node.error"
          color="negative"
          label="Error"
          class="q-ml-xs"
        />

        <!-- Edit Button -->
        <q-btn
          flat
          dense
          size="sm"
          icon="edit"
          @click.stop="handleEdit(node)"
          class="q-ml-sm"
        />
      </div>

      <!-- Error Message -->
      <div v-if="node.error" class="text-negative text-caption q-mt-xs">
        {{ node.error }}
      </div>

      <!-- Process Info -->
      <div v-if="node.process" class="q-mt-sm q-pl-lg">
        <div class="text-caption text-primary">
          <q-icon name="settings" size="xs" />
          Process: {{ node.process.type }}
        </div>
        <div v-if="node.process.description" class="text-caption text-grey-7">
          {{ truncateText(node.process.description, 100) }}
        </div>
      </div>
    </div>

    <!-- Children (recursive) -->
    <div v-if="node.expanded && node.children.length > 0">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :level="level + 1"
        @toggle-expansion="$emit('toggle-expansion', $event)"
        @edit-node="$emit('edit-node', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import type { DecompositionNode } from '../../types/decomposition';
import DataSourceBadge from './DataSourceBadge.vue'; // Functionality assumed available or needs creation.
import TreeNode from './TreeNode.vue'; // Recursive import

const props = defineProps<{
  node: DecompositionNode;
  level: number;
}>();

const emit = defineEmits<{
  (e: 'toggle-expansion', nodeId: string): void;
  (e: 'edit-node', payload: { nodeId: string; updates: unknown }): void;
}>();

function getNodeIcon(node: DecompositionNode): string {
  const category = node.data.category?.toLowerCase();

  if (category?.includes('food')) return 'restaurant';
  if (category?.includes('hardware')) return 'memory';
  if (category?.includes('assembly')) return 'construction';
  if (category?.includes('manufacturing')) return 'precision_manufacturing';

  return 'inventory_2';
}

function getNodeColor(node: DecompositionNode): string {
  if (node.error) return 'negative';
  if (node.metadata.manuallyEdited) return 'info';
  if (node.metadata.truncated) return 'warning';
  return 'primary';
}

function getTruncationLabel(node: DecompositionNode): string {
  switch (node.metadata.truncationReason) {
    case 'depth_limit':
      return 'Max depth';
    case 'circular_dependency':
      return 'Circular';
    case 'api_error':
      return 'API error';
    default:
      return 'Truncated';
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function handleEdit(node: DecompositionNode) {
  emit('edit-node', { nodeId: node.id, updates: {} });
}
</script>

<style scoped>
.tree-node {
  /* No margin for root, children get margin via style binding */
}

.node-header {
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.node-header:hover {
  background-color: rgba(0, 0, 0, 0.02);
}
</style>
