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

const props = defineProps<{ modelValue: number | undefined; label?: string }>();
const emit = defineEmits(['update:modelValue']);

const date = ref<string | undefined>();
const time = ref<string | undefined>();

const hr = computed(() =>
  date.value !== undefined && time.value !== undefined
    ? `${date.value} ${time.value}`
    : ''
);

watch(hr, () => {
  const ts = Date.parse(`${date.value}T${time.value}`) / 1000;
  emit('update:modelValue', Number.isNaN(ts) ? undefined : ts);
});

function clear() {
  date.value = undefined;
  time.value = undefined;
}
</script>
