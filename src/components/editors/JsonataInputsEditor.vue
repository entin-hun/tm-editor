<template>
  <div>
    <div v-if="!ready" class="text-caption text-grey-6 q-mb-sm">
      Loading visual editor…
    </div>
    <div ref="container" class="jsonata-container" />
    <div v-if="fallback" class="q-mt-md">
      <div v-if="editorError" class="text-negative text-caption q-mb-sm">
        JSONata editor error: {{ editorError }}
      </div>
      <div class="row items-center q-gutter-sm q-mb-sm">
        <q-btn
          label="Retry visual editor"
          color="primary"
          dense
          no-caps
          @click="retryVisualEditor"
        />
      </div>
      <q-input
        v-model="localValue"
        type="textarea"
        label="inputs"
        filled
        @update:model-value="emitValue"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSchemaStore } from 'src/stores/schemaStore';

const props = defineProps<{ modelValue: string | undefined }>();
const emit = defineEmits(['update:modelValue']);

const container = ref<HTMLElement | null>(null);
const ready = ref(false);
const fallback = ref(false);
const localValue = ref(props.modelValue ?? '');
const schemaStore = useSchemaStore();
let reactRoot: any = null;
let ReactLib: any = null;
let ReactDOM: any = null;
let EditorComponent: any = null;
let DefaultTheme: any = null;
let ErrorBoundaryComponent: any = null;
const editorError = ref<string | null>(null);

const jsonataSchema = schemaStore.buildJsonSchema('Pokedex', 5);

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

function getErrorBoundary() {
  if (ErrorBoundaryComponent || !ReactLib?.Component) return ErrorBoundaryComponent;
  class ErrorBoundary extends ReactLib.Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    componentDidCatch(error: unknown) {
      if (this.props?.onError) {
        this.props.onError(error);
      }
    }

    componentDidUpdate(prevProps: any) {
      if (prevProps?.resetKey !== this.props?.resetKey && this.state.hasError) {
        this.setState({ hasError: false });
      }
    }

    render() {
      if (this.state.hasError) {
        return this.props?.fallback ?? null;
      }
      return this.props?.children ?? null;
    }
  }
  ErrorBoundaryComponent = ErrorBoundary;
  return ErrorBoundaryComponent;
}

function handleEditorError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  editorError.value = message;
  fallback.value = true;
}

function renderEditor() {
  if (!container.value || !reactRoot || !EditorComponent || !ReactLib) return;
  if (!localValue.value || !localValue.value.trim()) {
    localValue.value = '$';
    emit('update:modelValue', localValue.value);
  }
  const ErrorBoundary = getErrorBoundary();
  const element = ReactLib.createElement(EditorComponent, {
    text: localValue.value || '',
    onChange: (next: string) => {
      if (typeof next !== 'string') {
        return;
      }
      localValue.value = next;
      emit('update:modelValue', localValue.value);
      editorError.value = null;
    },
    theme: DefaultTheme,
    schema: jsonataSchema,
  });
  if (ErrorBoundary) {
    const wrapped = ReactLib.createElement(
      ErrorBoundary,
      {
        onError: handleEditorError,
        resetKey: localValue.value,
        fallback: ReactLib.createElement(
          'div',
          { style: { padding: '8px', color: '#f44336', fontSize: '12px' } },
          'JSONata editor error. Showing fallback input.'
        ),
      },
      element
    );
    reactRoot.render(wrapped);
  } else {
    reactRoot.render(element);
  }
  ready.value = true;
}

onMounted(async () => {
  try {
    const [reactModule, reactDomModule, editorModule, themeModule] =
      await Promise.all([
        import('react'),
        import('react-dom/client'),
        import('jsonata-visual-editor'),
        import('./jsonataTheme'),
      ]);

    ReactLib = reactModule;
    ReactDOM = reactDomModule;
    EditorComponent = editorModule.Editor ?? editorModule.default ?? editorModule;
    DefaultTheme = themeModule.createJsonataTheme
      ? themeModule.createJsonataTheme(ReactLib)
      : themeModule.default;

    if (!container.value || !ReactDOM?.createRoot || !EditorComponent || !DefaultTheme) {
      throw new Error('Jsonata visual editor not available');
    }

    reactRoot = ReactDOM.createRoot(container.value);
    renderEditor();
  } catch (error) {
    console.warn('[JsonataInputsEditor] Falling back to textarea', error);
    fallback.value = true;
    ready.value = true;
  }
});

onBeforeUnmount(() => {
  if (reactRoot?.unmount) {
    reactRoot.unmount();
  }
});

watch(localValue, () => {
  if (!fallback.value) {
    renderEditor();
  }
});

function retryVisualEditor() {
  if (!container.value || !ReactDOM?.createRoot) return;
  editorError.value = null;
  fallback.value = false;
  if (!reactRoot) {
    reactRoot = ReactDOM.createRoot(container.value);
  }
  renderEditor();
}
</script>

<style scoped>
.jsonata-container {
  min-height: 240px;
}
</style>
