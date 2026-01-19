<template>
  <q-expansion-item
    v-model="expanded"
    label="AI Configuration"
    icon="settings"
    caption="Configure AI provider API keys"
    dense
    class="ai-settings-expansion"
  >
    <q-card flat>
      <q-card-section class="q-pa-sm">
        <div class="q-gutter-sm">
          <!-- Provider API Key Inputs -->
          <q-input
            v-for="providerOption in providerOptions"
            :key="providerOption.value"
            :model-value="apiKeys[providerOption.value]"
            :label="`${providerOption.label} API Key`"
            dense
            outlined
            :type="showApiKeys[providerOption.value] ? 'text' : 'password'"
            :loading="validating[providerOption.value]"
            :hint="getProviderHint(providerOption.value)"
            @update:model-value="
              (val) => updateApiKey(providerOption.value, val)
            "
            @blur="() => handleApiKeyBlur(providerOption.value)"
          >
            <template v-slot:prepend>
              <q-icon :name="providerOption.icon" size="xs" />
            </template>
            <template v-slot:append>
              <q-badge
                v-if="getProviderStatus(providerOption.value)"
                :color="getProviderStatus(providerOption.value)!.color"
                :label="getProviderStatus(providerOption.value)!.label"
                class="q-mr-xs"
              />
              <q-icon
                v-if="apiKeys[providerOption.value]"
                :name="
                  showApiKeys[providerOption.value]
                    ? 'visibility_off'
                    : 'visibility'
                "
                class="cursor-pointer"
                size="xs"
                @click="
                  showApiKeys[providerOption.value] =
                    !showApiKeys[providerOption.value]
                "
              />
              <q-icon
                v-if="apiKeys[providerOption.value]"
                name="close"
                class="cursor-pointer q-ml-xs"
                size="xs"
                @click="clearApiKey(providerOption.value)"
              >
                <q-tooltip>Clear this API key</q-tooltip>
              </q-icon>
            </template>
          </q-input>
        </div>
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import type { AIProvider } from '../../types/ai';
import { selectModelForTask, AI_MODELS } from '../../config/aiConfig';
import type { TaskType } from '../../config/aiConfig';
import { aiConfigStorage } from '../../services/ai/AIConfigStorage';
import { semanticSearchEngine } from '../../services/SemanticSearchEngine';
import { useQuasar } from 'quasar';

const $q = useQuasar();

// Props
const props = defineProps<{
  hasMessages?: boolean;
}>();

// State
const apiKeys = reactive<Partial<Record<AIProvider, string>>>({});
const showApiKeys = reactive<Partial<Record<AIProvider, boolean>>>({});
const validating = reactive<Partial<Record<AIProvider, boolean>>>({});
const expanded = ref(true);

// Provider options
const providerOptions = [
  { label: 'Gemini', value: 'gemini' as AIProvider, icon: 'auto_awesome' },
  { label: 'Groq', value: 'groq' as AIProvider, icon: 'speed' },
  { label: 'OpenRouter', value: 'openrouter' as AIProvider, icon: 'hub' },
];

// Load config on mount
function hasValidatedKey(): boolean {
  const config = aiConfigStorage.getConfig();
  if (!config || !config.providers) return false;
  return providerOptions.some(
    (p) => config.providers[p.value]?.validated === true
  );
}

function refreshFromStorage() {
  const config = aiConfigStorage.getConfig();
  if (config && config.providers) {
    providerOptions.forEach((p) => {
      const providerConfig = config.providers[p.value];
      if (providerConfig) {
        apiKeys[p.value] = providerConfig.apiKey || '';
      }
    });
  }
  if (hasValidatedKey()) {
    expanded.value = false;
  }
}

onMounted(() => {
  refreshFromStorage();
});

// Update API key in state (doesn't save yet)
function updateApiKey(provider: AIProvider, value: string | number | null) {
  apiKeys[provider] = String(value || '');
}

// Auto-validate on blur
async function handleApiKeyBlur(provider: AIProvider) {
  const key = apiKeys[provider]?.trim();

  // If empty, clear the provider
  if (!key) {
    if (aiConfigStorage.getProviderConfig(provider)) {
      clearApiKey(provider);
    }
    return;
  }

  // Don't re-validate if already validated with same key
  const existingConfig = aiConfigStorage.getProviderConfig(provider);
  if (
    existingConfig &&
    existingConfig.apiKey === key &&
    existingConfig.validated
  ) {
    return;
  }

  // Auto-validate
  validating[provider] = true;

  try {
    console.log(
      `[AISettings] Starting validation for ${provider} with key: ${key.substring(
        0,
        10
      )}...`
    );

    // Temporarily save the key for validation
    aiConfigStorage.updateProvider(provider, key);
    console.log(`[AISettings] Key saved to storage`);

    // Set as active provider for validation
    let config = aiConfigStorage.getConfig();
    if (config) {
      config.activeProvider = provider;
      aiConfigStorage.saveConfig(config);
      console.log(`[AISettings] Active provider set to ${provider}`);
    }

    // Validate using semantic search engine
    console.log(`[AISettings] Calling semanticSearchEngine.validateConfig()`);
    const isValid = await semanticSearchEngine.validateConfig();
    console.log(`[AISettings] Validation result: ${isValid}`);

    if (isValid) {
      // Mark as validated
      aiConfigStorage.updateProvider(provider, key, true);
      console.log(`[AISettings] Marked as validated`);

      expanded.value = false;

      $q.notify({
        type: 'positive',
        message: `${
          providerOptions.find((p) => p.value === provider)?.label
        } API key validated successfully`,
        position: 'top',
        timeout: 2000,
      });
    } else {
      // Mark as invalid but keep the key for user to fix
      const providerConfig = aiConfigStorage.getProviderConfig(provider);
      const errorMsg = providerConfig?.lastError || 'Invalid API key';
      aiConfigStorage.updateProvider(provider, key, false, errorMsg);
      console.log(`[AISettings] Marked as invalid: ${errorMsg}`);

      $q.notify({
        type: 'negative',
        message: `Invalid API key for ${
          providerOptions.find((p) => p.value === provider)?.label
        }: ${errorMsg}`,
        position: 'top',
        timeout: 3000,
      });
    }
  } catch (error) {
    console.error('[AISettings] Validation failed:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    aiConfigStorage.updateProvider(provider, key, false, errorMsg);

    $q.notify({
      type: 'negative',
      message: `Validation failed: ${errorMsg}`,
      position: 'top',
      timeout: 3000,
    });
  } finally {
    validating[provider] = false;
  }
}

// Clear API key for a provider
function clearApiKey(provider: AIProvider) {
  apiKeys[provider] = '';
  aiConfigStorage.clearProvider(provider);

  if (!hasValidatedKey()) {
    expanded.value = true;
  }

  $q.notify({
    type: 'info',
    message: `${
      providerOptions.find((p) => p.value === provider)?.label
    } API key cleared`,
    position: 'top',
    timeout: 1500,
  });
}

// Get provider status badge
function getProviderStatus(provider: AIProvider) {
  const config = aiConfigStorage.getProviderConfig(provider);
  if (!config || !config.apiKey) return null;

  if (config.validated) {
    return { color: 'positive', label: 'Validated' };
  }

  if (config.lastError) {
    return { color: 'negative', label: 'Invalid' };
  }

  return { color: 'grey', label: 'Not Tested' };
}

// Get provider hint text
function getProviderHint(provider: AIProvider): string {
  const config = aiConfigStorage.getProviderConfig(provider);

  if (!config) return '';

  if (config.validated && config.lastValidated) {
    return `Validated on ${new Date(config.lastValidated).toLocaleString()}`;
  }

  if (config.lastError) {
    return `Error: ${config.lastError}`;
  }

  return 'Pending validation';
}
</script>

<style scoped>
.ai-settings-expansion {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
</style>
