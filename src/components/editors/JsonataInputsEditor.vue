<template>
  <div>
    <div class="text-caption text-grey-6 q-mb-sm">
      JSONata expression. Tap a field to insert. Root ($) is added automatically.
    </div>
    <q-input
      ref="inputRef"
      v-model="localValue"
      type="textarea"
      label="inputs"
      filled
      autogrow
      @update:model-value="handleInput"
      @keyup="handleCursor"
      @click="handleCursor"
      @focus="handleFocus"
    />

    <div v-if="suggestions.length" class="q-mt-sm">
      <div class="text-caption text-grey-6 q-mb-xs">
        Fields for {{ currentTypeLabel }}
      </div>
      <q-list bordered dense class="jsonata-suggestions">
        <q-item
          v-for="option in suggestions"
          :key="option.name"
          clickable
          @click="insertSuggestion(option.name)"
        >
          <q-item-section>
            <q-item-label>
              {{ option.name }}
              <span v-if="option.dataType" class="text-grey-6">· {{ option.dataType }}</span>
            </q-item-label>
            <q-item-label caption v-if="option.description">
              {{ option.description }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <div v-if="operatorSuggestions.length" class="q-mt-sm">
      <div class="text-caption text-grey-6 q-mb-xs">
        Operators for {{ operatorTypeLabel }}
      </div>
      <div class="row items-center q-gutter-xs">
        <q-btn
          v-for="op in operatorSuggestions"
          :key="op"
          :label="op"
          dense
          no-caps
          outline
          color="primary"
          @click="insertOperator(op)"
        />
      </div>
    </div>

    <div class="q-mt-sm">
      <div class="text-caption text-grey-6 q-mb-xs">Rules</div>
      <div class="row items-center q-gutter-xs">
        <q-btn label="AND" dense no-caps outline color="primary" @click="insertLogic('and')" />
        <q-btn label="OR" dense no-caps outline color="primary" @click="insertLogic('or')" />
        <q-btn label="( )" dense no-caps outline color="primary" @click="insertParentheses" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useSchemaStore } from 'src/stores/schemaStore';

const props = defineProps<{ modelValue: string | undefined }>();
const emit = defineEmits(['update:modelValue']);

const inputRef = ref<any>(null);
const localValue = ref(props.modelValue ?? '');
const schemaStore = useSchemaStore();
const cursorPosition = ref(0);
const suggestions = ref<Array<{ name: string; dataType?: string; description?: string }>>([]);
const operatorSuggestions = ref<string[]>([]);
const currentTypeLabel = ref('Pokedex');
const operatorTypeLabel = ref('value');

const jsonataSchema = computed(() => schemaStore.buildJsonSchema('Pokedex', 5));

function emitValue() {
  emit('update:modelValue', localValue.value);
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (typeof newVal === 'string' && newVal !== localValue.value) {
      localValue.value = newVal;
    }
  }
);

function handleInput(value: string | number | null) {
  localValue.value = typeof value === 'string' ? value : '';
  emitValue();
  updateSuggestions();
}

function handleCursor(event?: Event) {
  const target = event?.target as HTMLTextAreaElement | undefined;
  cursorPosition.value = target?.selectionStart ?? localValue.value.length;
  updateSuggestions();
}

function handleFocus() {
  if (!localValue.value) {
    localValue.value = '';
    emitValue();
  }
  handleCursor();
}

function getCurrentPath() {
  const text = localValue.value ?? '';
  const cursor = cursorPosition.value ?? text.length;
  const before = text.slice(0, cursor);
  const match = before.match(/\$[A-Za-z_][\w.]*$/);
  const hasRoot = Boolean(match);
  const pathText = match ? match[0] : before.trim();
  const startIndex = match ? before.length - pathText.length : 0;
  if (hasRoot && !pathText.startsWith('$')) return null;
  const lastDot = pathText.lastIndexOf('.');
  const basePath = lastDot >= 0 ? pathText.slice(hasRoot ? 1 : 0, lastDot) : '';
  const segments = basePath.split('.').filter(Boolean);
  const segmentStart = startIndex + (lastDot >= 0 ? lastDot + 1 : hasRoot ? 1 : 0);
  const prefix = text.slice(segmentStart, cursor);
  return { segments, prefix, segmentStart, needsRoot: !hasRoot };
}

const fieldTypeOverrides: Record<string, Record<string, string>> = {
  Pokedex: {
    instance: 'ProductInstance',
  },
  ProductInstance: {
    price: 'Price',
    process: 'Process',
    packaging: 'PackagingInstance',
  },
  FoodInstance: {
    process: 'Process',
    packaging: 'PackagingInstance',
    iDs: 'ID',
    nutrients: 'FallbackFoodNutrient',
  },
  NonFoodInstance: {
    process: 'Process',
    packaging: 'PackagingInstance',
  },
  Process: {
    facility: 'Facility',
    site: 'Facility',
    temperatureRange: 'TemperatureRange',
    inputInstances: 'InputInstance',
    impacts: 'Impact',
    price: 'Price',
    machineInstance: 'MachineInstance',
    knowHow: 'KnowHow',
  },
  InputInstance: {
    instance: 'ProductInstance',
    transport: 'Transport',
  },
  Transport: {
    method: 'string',
    fuelType: 'string',
  },
  PackagingInstance: {
    recyclable: 'boolean',
  },
  TemperatureRange: {
    min: 'number',
    max: 'number',
  },
  Price: {
    amount: 'number',
  },
  MachineInstance: {
    quantity: 'number',
  },
};

function findFieldName(typeName: string, segment: string) {
  const typeDesc = schemaStore.getTypeDescription(typeName);
  if (fieldTypeOverrides[typeName]?.[segment]) return segment;
  if (!typeDesc?.fields) return undefined;
  if (typeDesc.fields[segment]) return segment;
  const lower = segment.toLowerCase();
  return Object.keys(typeDesc.fields).find((key) => key.toLowerCase() === lower);
}

function getFieldDataType(typeName: string, fieldName: string) {
  const override = fieldTypeOverrides[typeName]?.[fieldName];
  if (override) return override;
  const desc = schemaStore.getFieldDescription(typeName, fieldName) as any;
  return desc?.dataType as string | undefined;
}

function resolveTypePath(segments: string[]) {
  let currentType = 'Pokedex';
  for (const segment of segments) {
    const resolvedName = findFieldName(currentType, segment);
    if (!resolvedName) {
      return { typeName: currentType, field: undefined };
    }
    const dataType = getFieldDataType(currentType, resolvedName);
    if (!dataType) {
      return { typeName: currentType, field: undefined };
    }
    currentType = dataType;
  }
  return { typeName: currentType, field: undefined };
}

function inferPrimitive(fieldName: string, dataType?: string) {
  if (dataType === 'number' || dataType === 'boolean' || dataType === 'string') {
    return dataType;
  }
  if (schemaStore.getTypeDescription(dataType || '')) {
    return 'object';
  }
  const numericFields = new Set(['quantity', 'amount', 'timestamp', 'duration', 'min', 'max']);
  const booleanFields = new Set(['bio', 'recyclable']);
  if (numericFields.has(fieldName)) return 'number';
  if (booleanFields.has(fieldName)) return 'boolean';
  return 'string';
}

function getOperatorSuggestions(typeName: string) {
  switch (typeName) {
    case 'number':
      return ['=', '!=', '>', '<', '>=', '<='];
    case 'boolean':
      return ['=', '!='];
    case 'string':
      return ['=', '!=', 'in', 'contains', '~>'];
    default:
      return ['=', '!='];
  }
}

function getOperatorContext() {
  const text = localValue.value ?? '';
  const cursor = cursorPosition.value ?? text.length;
  const before = text.slice(0, cursor);
  if (!/\s+$/.test(before)) return null;
  const tokenMatch = before.trimEnd().match(/(\$?[A-Za-z_][\w.]*)(?=\s*$)/);
  if (!tokenMatch) return null;
  const rawPath = tokenMatch[1];
  const normalized = rawPath.startsWith('$') ? rawPath.slice(1) : rawPath;
  const segments = normalized.split('.').filter(Boolean);
  if (!segments.length) return null;
  const fieldName = segments[segments.length - 1];
  const parentSegments = segments.slice(0, -1);
  const { typeName: parentType } = resolveTypePath(parentSegments);
  const resolvedFieldName = findFieldName(parentType, fieldName) || fieldName;
  const fieldDesc = schemaStore.getFieldDescription(parentType, resolvedFieldName);
  const dataType = getFieldDataType(parentType, resolvedFieldName);
  const primitive = inferPrimitive(fieldName, dataType ?? (fieldDesc as any)?.dataType);
  return { primitive };
}

function updateSuggestions() {
  const path = getCurrentPath();
  if (!path) {
    suggestions.value = [];
    currentTypeLabel.value = 'Pokedex';
  }

  const operatorContext = getOperatorContext();
  if (operatorContext) {
    operatorTypeLabel.value = operatorContext.primitive;
    operatorSuggestions.value = getOperatorSuggestions(operatorContext.primitive);
  } else {
    operatorSuggestions.value = [];
  }
  if (!path) {
    return;
  }

  const { segments, prefix } = path;
  const { typeName } = resolveTypePath(segments);
  currentTypeLabel.value = typeName;

  const typeDesc = schemaStore.getTypeDescription(typeName);
  const fieldKeys = new Set<string>([
    ...Object.keys(typeDesc?.fields || {}),
    ...Object.keys(fieldTypeOverrides[typeName] || {}),
  ]);
  if (!fieldKeys.size) {
    suggestions.value = [];
    return;
  }

  const options = Array.from(fieldKeys)
    .filter((field) => field.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((field) => {
      const desc = schemaStore.getFieldDescription(typeName, field);
      const dataType = getFieldDataType(typeName, field);
      return {
        name: field,
        dataType: dataType ?? (desc as any)?.dataType,
        description: desc?.description,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  suggestions.value = options;
}

function insertSuggestion(fieldName: string) {
  const path = getCurrentPath();
  if (!path) return;
  const text = localValue.value ?? '';
  const cursor = cursorPosition.value ?? text.length;
  let { segmentStart, needsRoot } = path;
  let adjustedText = text;
  let adjustedCursor = cursor;
  if (needsRoot && !text.includes('$')) {
    const prefix = '$.';
    adjustedText = prefix + text;
    segmentStart += prefix.length;
    adjustedCursor += prefix.length;
  }
  const newValue =
    adjustedText.slice(0, segmentStart) +
    fieldName +
    adjustedText.slice(adjustedCursor);
  localValue.value = newValue;
  emitValue();
  const newCursor = segmentStart + fieldName.length;
  nextTick(() => {
    const native = (inputRef.value?.getNativeElement?.() ||
      inputRef.value?.$el?.querySelector?.('textarea')) as
      | HTMLTextAreaElement
      | undefined;
    if (native?.setSelectionRange) {
      native.setSelectionRange(newCursor, newCursor);
      native.focus();
    }
    cursorPosition.value = newCursor;
    updateSuggestions();
  });
}

function insertOperator(operator: string) {
  const text = localValue.value ?? '';
  const cursor = cursorPosition.value ?? text.length;
  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  const insertText = `${needsSpace ? ' ' : ''}${operator} `;
  const newValue = `${before}${insertText}${after}`;
  localValue.value = newValue;
  emitValue();
  const newCursor = before.length + insertText.length;
  nextTick(() => {
    const native = (inputRef.value?.getNativeElement?.() ||
      inputRef.value?.$el?.querySelector?.('textarea')) as
      | HTMLTextAreaElement
      | undefined;
    if (native?.setSelectionRange) {
      native.setSelectionRange(newCursor, newCursor);
      native.focus();
    }
    cursorPosition.value = newCursor;
    updateSuggestions();
  });
}

function insertLogic(operator: 'and' | 'or') {
  const text = localValue.value ?? '';
  const cursor = cursorPosition.value ?? text.length;
  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  const insertText = `${needsSpace ? ' ' : ''}${operator} `;
  const newValue = `${before}${insertText}${after}`;
  localValue.value = newValue;
  emitValue();
  const newCursor = before.length + insertText.length;
  nextTick(() => {
    const native = (inputRef.value?.getNativeElement?.() ||
      inputRef.value?.$el?.querySelector?.('textarea')) as
      | HTMLTextAreaElement
      | undefined;
    if (native?.setSelectionRange) {
      native.setSelectionRange(newCursor, newCursor);
      native.focus();
    }
    cursorPosition.value = newCursor;
    updateSuggestions();
  });
}

function insertParentheses() {
  const text = localValue.value ?? '';
  const cursor = cursorPosition.value ?? text.length;
  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  const insertText = '()';
  const newValue = `${before}${insertText}${after}`;
  localValue.value = newValue;
  emitValue();
  const newCursor = before.length + 1;
  nextTick(() => {
    const native = (inputRef.value?.getNativeElement?.() ||
      inputRef.value?.$el?.querySelector?.('textarea')) as
      | HTMLTextAreaElement
      | undefined;
    if (native?.setSelectionRange) {
      native.setSelectionRange(newCursor, newCursor);
      native.focus();
    }
    cursorPosition.value = newCursor;
    updateSuggestions();
  });
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (typeof newVal === 'string' && newVal !== localValue.value) {
      localValue.value = newVal;
      updateSuggestions();
    }
  }
);

watch(jsonataSchema, () => {
  updateSuggestions();
});
</script>

<style scoped>
.jsonata-suggestions {
  max-height: 240px;
  overflow: auto;
}
</style>
