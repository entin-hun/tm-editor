<template>
  <div class="schema-panel">
    <!-- Validation status bar -->
    <div class="row items-center q-mb-sm q-gutter-sm">
      <q-chip
        :icon="isValid ? 'check_circle' : 'error'"
        :color="isValid ? 'positive' : 'negative'"
        text-color="white"
        dense
      >
        {{ isValid ? 'Valid' : errorCount + ' error(s)' }}
      </q-chip>
      <q-chip icon="schema" color="dark" text-color="grey-4" dense outline>
        JSON Schema Draft-07
      </q-chip>
      <q-space />
      <q-btn-toggle
        v-model="panel"
        toggle-color="primary"
        dense
        :options="[
          { label: 'Errors', value: 'errors' },
          { label: 'Schema', value: 'schema' },
          { label: 'Instance', value: 'instance' },
        ]"
      />
    </div>

    <!-- Error list -->
    <template v-if="panel === 'errors'">
      <div v-if="isValid" class="text-positive text-body2">
        Document matches schema. All required fields are present and well-typed.
      </div>
      <q-list v-else dark dense>
        <q-item v-for="(err, i) in errors" :key="i" class="q-pa-none q-mb-xs">
          <q-item-section avatar>
            <q-icon name="warning" color="negative" size="18px" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-caption text-negative">{{ err.instancePath || '/' }}</q-item-label>
            <q-item-label caption class="text-white">{{ err.message }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <!-- Generated schema -->
    <template v-else-if="panel === 'schema'">
      <pre class="code-block">{{ schemaJson }}</pre>
    </template>

    <!-- Current instance value -->
    <template v-else>
      <pre class="code-block">{{ instanceJson }}</pre>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Ajv = require('ajv');
import { KnowHow } from '@trace.market/types';

type ValidateFunction = (data: unknown) => boolean;
type ErrorObject = { instancePath: string; message?: string; keyword: string; params: unknown; schemaPath: string };

const props = defineProps<{ knowHow: KnowHow | undefined }>();

const panel = ref<'errors' | 'schema' | 'instance'>('errors');

// ── JSON Schema for the KnowHow interface ────────────────────────
const knowHowSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'KnowHow',
  description:
    'A reusable know-how record that describes process inputs, outputs, and a licence fee.',
  type: 'object',
  required: ['owner', 'hash', 'inputs', 'outputs', 'licenseFee'],
  additionalProperties: true,
  properties: {
    owner: {
      type: 'string',
      minLength: 1,
      description: 'Wallet address (checksummed hex) of the know-how owner.',
    },
    hash: {
      type: 'string',
      minLength: 1,
      description: 'Content-address / IPFS CID of the know-how document.',
    },
    inputs: {
      type: 'string',
      description:
        'JSONata expression that selects and transforms supply-chain inputs.',
    },
    outputs: {
      type: 'string',
      description:
        'Serialised JSON (string) or JSON object describing the expected output ProductInstance.',
    },
    licenseFee: {
      type: 'object',
      required: ['amount', 'currency', 'type'],
      properties: {
        amount: { type: 'number', minimum: 0 },
        currency: { type: 'string', minLength: 1 },
        type: { type: 'string', enum: ['is', 'per_unit', 'per_kg', 'per_km'] },
      },
      additionalProperties: false,
    },
    note: { type: 'string' },
    logoURL: { type: 'string', format: 'uri' },
  },
};

const ajv = new Ajv({ allErrors: true, strict: false });
let validate: ValidateFunction;
try {
  validate = ajv.compile(knowHowSchema);
} catch (e) {
  console.error('AJV compile error', e);
  validate = (() => true) as unknown as ValidateFunction;
}

// ── Reactive validation ──────────────────────────────────────────
const errors = ref<ErrorObject[]>([]);
const isValid = computed(() => errors.value.length === 0);
const errorCount = computed(() => errors.value.length);

function runValidation(value: KnowHow | undefined) {
  if (!value) {
    errors.value = [
      { instancePath: '/', message: 'No document provided', keyword: 'required', params: {}, schemaPath: '' } as ErrorObject,
    ];
    return;
  }
  const ok = validate(value);
  errors.value = ok ? [] : ((validate.errors ?? []) as ErrorObject[]);
}

watch(() => props.knowHow, (v) => runValidation(v), { deep: true, immediate: true });

// ── Pretty JSON views ────────────────────────────────────────────
const schemaJson = computed(() => JSON.stringify(knowHowSchema, null, 2));
const instanceJson = computed(() => JSON.stringify(props.knowHow ?? null, null, 2));
</script>

<style scoped>
.schema-panel {
  font-size: 13px;
}
.code-block {
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 12px;
  font-size: 11.5px;
  overflow: auto;
  max-height: 320px;
  color: #d0d7de;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
