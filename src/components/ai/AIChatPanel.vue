<template>
  <q-card class="ai-chat-panel q-mt-md" flat bordered>
    <q-card-section class="row items-center justify-between q-gutter-sm">
      <div>
        <div class="text-subtitle1">AI Chat</div>
        <div class="text-caption text-grey-6">
          Chat with AI and attach files (PDF, HTML, etc.) to enrich the context.
        </div>
      </div>
      <div class="column items-end q-gutter-xs">
        <q-badge :color="aiReady ? 'positive' : 'negative'" align="middle">
          {{ aiReady ? 'AI ready' : 'Needs validated API key' }}
        </q-badge>
        <div class="text-caption text-grey-6">{{ statusText }}</div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section class="q-gutter-md">
      <div>
        <div class="text-caption text-grey-6 q-mb-xs">Attachments</div>
        <q-file
          v-model="attachments"
          multiple
          use-chips
          dense
          outlined
          :disable="!aiReady"
          :accept="acceptedTypes"
          @rejected="onRejected"
        />
      </div>

      <div class="chat-window">
        <div v-for="(message, idx) in messages" :key="idx" class="q-mb-sm">
          <q-chip
            :color="message.role === 'user' ? 'primary' : 'grey-8'"
            text-color="white"
            dense
          >
            {{ message.role === 'user' ? 'You' : 'AI' }}
          </q-chip>
          <div class="text-body2 q-ml-sm">{{ message.content }}</div>
        </div>
        <div v-if="messages.length === 0" class="text-caption text-grey-6">
          No messages yet. Type below to start a conversation.
        </div>
      </div>

      <q-input
        v-model="input"
        type="textarea"
        autogrow
        outlined
        :disable="!aiReady"
        label="Message"
        @keydown.enter.exact.prevent="send"
      />

      <div class="row justify-end q-gutter-sm">
        <q-btn
          color="primary"
          icon="send"
          label="Send"
          :disable="!aiReady || input.trim().length === 0"
          @click="send"
        />
      </div>

      <q-banner v-if="!aiReady" class="bg-grey-10 text-white" rounded dense>
        <template #avatar>
          <q-icon name="lock" color="white" />
        </template>
        Provide and validate an AI API key in the settings above to enable chat
        and file attachments.
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject } from 'vue';
import { aiConfigStorage } from 'src/services/ai/AIConfigStorage';
import { enrichFromPayload } from 'src/services/ai/AiEnrichmentService';
import { useQuasar } from 'quasar'; // Check if I can verify this import exists or add it

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const input = ref('');
const attachments = ref<File[]>([]);
const messages = ref<ChatMessage[]>([]);
const aiReady = ref(false);
const lastValidated = ref<string | undefined>();
const lastError = ref<string | undefined>();

const acceptedTypes =
  '.pdf,.html,.htm,.txt,.md,.csv,.json,.doc,.docx,.ppt,.pptx';

// Inject capability to update Pokedex from parent editor
const { updateInstance } = inject('pokedexActions', {
  updateInstance: (val: any) => {
    void val;
  },
});

const statusText = computed(() => {
  if (!aiReady.value) {
    return lastError.value
      ? `Validation failed: ${lastError.value}`
      : 'Not validated';
  }
  if (lastValidated.value) {
    return `Validated on ${new Date(lastValidated.value).toLocaleString()}`;
  }
  return 'Validated';
});

function refreshStatus() {
  const config = aiConfigStorage.getConfig();
  aiReady.value = !!(
    config &&
    config.enabled &&
    config.apiKey &&
    config.validated &&
    !config.lastError
  );
  lastValidated.value = config?.lastValidated;
  lastError.value = config?.lastError;
}

async function buildPayload(message: string, files: File[]) {
  const attachmentsPayload = await Promise.all(
    files.map(async (file) => ({ name: file.name, content: await file.text() }))
  );

  return {
    text: message,
    attachments: attachmentsPayload.length ? attachmentsPayload : undefined,
  };
}

async function send() {
  if (!aiReady.value || input.value.trim().length === 0) return;

  const userMessage = input.value.trim();
  const files = attachments.value;
  const placeholder = 'Message received. (AI response placeholder)';

  messages.value.push({ role: 'user', content: userMessage });

  try {
    const payload = await buildPayload(userMessage, files);
    console.log('[AIChatPanel] Payload sent to enrichment:', payload);
    const enrichment = await enrichFromPayload(payload);
    console.log('[AIChatPanel] Enrichment result:', enrichment);

    if (enrichment?.populated) {
      console.log(
        '[AIChatPanel] Calling updateInstance with:',
        enrichment.populated
      );
      updateInstance(enrichment.populated);
      console.log('[AIChatPanel] updateInstance called');
      messages.value.push({
        role: 'assistant',
        content: `Updated editor with extracted data.\n\nSummary: ${enrichment.summary}`,
      });
    } else {
      console.warn(
        '[AIChatPanel] No populated instance in enrichment result:',
        enrichment
      );
      const assistantContent = enrichment?.summary || placeholder;
      messages.value.push({ role: 'assistant', content: assistantContent });
    }
  } catch (error) {
    console.error('Failed to enrich message', error);
    messages.value.push({ role: 'assistant', content: placeholder });
  }

  input.value = '';
  attachments.value = [];
}

function onRejected(rejected: any) {
  console.warn('File rejected', rejected);
}

onMounted(() => {
  window.addEventListener('ai-config-updated', refreshStatus);
  refreshStatus();
});

onUnmounted(() => {
  window.removeEventListener('ai-config-updated', refreshStatus);
});
</script>

<style scoped>
.ai-chat-panel {
  max-width: 900px;
}

.chat-window {
  min-height: 140px;
  max-height: 260px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}
</style>
