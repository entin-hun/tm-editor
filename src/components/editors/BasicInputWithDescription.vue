<template>
  <q-input
    @update:model-value="update"
    :model-value="props.modelValue"
    :type="$props.type"
    :label="$props.label"
    :readonly="$props.readonly"
    stack-label
    :hint="fieldDescription?.description"
  >
    <template v-if="fieldDescription" v-slot:prepend>
      <q-icon name="info" size="xs">
        <q-tooltip class="bg-grey-9">
          <div class="text-body2">
            <strong>{{ fieldDescription.label }}</strong>
          </div>
          <div class="text-caption q-mt-sm">
            {{ fieldDescription.description }}
          </div>
          <div v-if="fieldDescription.examples" class="text-caption q-mt-sm">
            <div class="text-weight-medium">Examples:</div>
            <ul class="q-pl-md q-my-xs">
              <li v-for="example in fieldDescription.examples" :key="example">
                {{ example }}
              </li>
            </ul>
          </div>
        </q-tooltip>
      </q-icon>
    </template>
  </q-input>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getFieldDescription } from '@trace.market/types';

const emit = defineEmits(['update:modelValue']);

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelValue: any | undefined;
  type?:
    | 'number'
    | 'search'
    | 'text'
    | 'password'
    | 'textarea'
    | 'email'
    | 'tel'
    | 'file'
    | 'url'
    | 'time'
    | 'date'
    | undefined;
  label?: string | undefined;
  readonly?: boolean;
  typeName?: string;
  fieldName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any | undefined;
}>();

const fieldDescription = computed(() => {
  if (props.typeName && props.fieldName) {
    return getFieldDescription(props.typeName, props.fieldName);
  }
  return undefined;
});

function update(value: number | string | null | undefined) {
  emit(
    'update:modelValue',
    value === '' || value === null || value === undefined
      ? props.defaultValue
      : value
  );
}
</script>
