<template>
  <q-input v-model="hr" readonly :label="props.label" stack-label>
    <template v-slot:append>
      <q-icon name="access_time" class="cursor-pointer">
        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
          <q-card dark>
            <div class="row">
              <q-date v-model="date" mask="YYYY-MM-DD" flat square />
              <q-time flat v-model="time" mask="HH:mm" format24h square />
            </div>
            <div class="row items-center justify-end">
              <q-btn
                v-close-popup
                label="Clear"
                flat
                class="q-ma-pd"
                @click="clear"
                color="primary"
              />
              <q-btn
                v-close-popup
                label="Close"
                flat
                class="q-ma-md"
                color="primary"
              />
            </div>
          </q-card>
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: number | string | null | undefined;
  label?: string;
}>();
const emit = defineEmits(['update:modelValue']);

const date = ref<string | undefined>();
const time = ref<string | undefined>();
const syncingFromModel = ref(false);

function toMillis(
  value: number | string | null | undefined
): number | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'number') {
    if (Number.isNaN(value)) return undefined;
    return value < 1e12 ? value * 1000 : value;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (Number.isNaN(numeric)) return undefined;
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const hr = computed(() =>
  date.value !== undefined && time.value !== undefined
    ? `${date.value} ${time.value}`
    : ''
);

watch(hr, () => {
  if (syncingFromModel.value) return;
  const ts = Date.parse(`${date.value}T${time.value}`) / 1000;
  emit('update:modelValue', Number.isNaN(ts) ? undefined : ts);
});

watch(
  () => props.modelValue,
  (next) => {
    syncingFromModel.value = true;
    try {
      const millis = toMillis(next);
      if (millis === undefined) {
        date.value = undefined;
        time.value = undefined;
        return;
      }

      const d = new Date(millis);
      if (Number.isNaN(d.getTime())) {
        date.value = undefined;
        time.value = undefined;
        return;
      }

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      date.value = `${y}-${m}-${day}`;
      time.value = `${hh}:${mm}`;
    } finally {
      syncingFromModel.value = false;
    }
  },
  { immediate: true }
);

function clear() {
  date.value = undefined;
  time.value = undefined;
}
</script>
