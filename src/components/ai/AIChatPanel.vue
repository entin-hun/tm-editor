<template>
  <q-card class="ai-chat-panel q-mt-md" flat bordered>
    <q-card-section class="row items-center q-gutter-sm">
      <div class="col">
        <div class="text-subtitle1">AI Chat</div>
        <div class="text-caption text-grey-6">
          Chat with AI and attach files (PDF, HTML, etc.) to enrich the context.
        </div>
      </div>
      <div class="column items-end q-gutter-xs">
        <q-badge :color="aiReady ? 'positive' : 'negative'" align="middle">
          {{ aiReady ? 'AI ready' : 'Needs API key' }}
        </q-badge>
        <div v-if="currentModel" class="text-caption text-grey-6">
          Using: {{ currentModel }}
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section class="q-gutter-md">
      <!-- File Attachments -->
      <div v-if="attachments.length > 0">
        <div class="text-caption text-grey-6 q-mb-xs">Attachments</div>
        <q-list dense bordered class="rounded-borders">
          <q-item v-for="(file, i) in attachments" :key="i">
            <q-item-section avatar>
              <q-icon :name="getFileIcon(file)" color="primary" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ file.name }}</q-item-label>
              <q-item-label caption>{{
                formatFileSize(file.size)
              }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                round
                icon="close"
                size="sm"
                @click="removeFile(i)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Chat Window -->
      <div v-if="messages.length > 0" class="chat-window" ref="chatWindow">
        <q-chat-message
          v-for="(message, idx) in messages"
          :key="idx"
          :text="[message.content]"
          :sent="message.role === 'user'"
          :bg-color="message.role === 'user' ? 'primary' : 'grey-9'"
          text-color="white"
          :stamp="message.timestamp"
        />

        <q-chat-message v-if="isStreaming" :sent="false" bg-color="grey-9">
          <q-spinner-dots size="2em" />
        </q-chat-message>
      </div>

      <!-- Input Area -->
      <div class="row q-gutter-sm">
        <q-input
          v-model="input"
          type="textarea"
          autogrow
          outlined
          :disable="!aiReady || isStreaming"
          label="Message"
          class="col"
          :rows="2"
          @keydown.enter.exact.prevent="send"
        >
          <template v-slot:append>
            <q-btn
              round
              dense
              flat
              icon="attach_file"
              :disable="!aiReady || isStreaming"
              @click="$refs.fileInput.pickFiles()"
            >
              <q-tooltip>Attach files</q-tooltip>
            </q-btn>
            <q-btn
              round
              dense
              flat
              :icon="isStreaming ? 'hourglass_empty' : 'send'"
              color="primary"
              :disable="!aiReady || input.trim().length === 0 || isStreaming"
              :loading="isStreaming"
              @click="send"
            >
              <q-tooltip>{{
                isStreaming ? 'Processing...' : 'Send message'
              }}</q-tooltip>
            </q-btn>
          </template>
        </q-input>
        <q-file
          ref="fileInput"
          v-model="attachments"
          multiple
          :accept="acceptedTypes"
          @rejected="onRejected"
          style="display: none"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  inject,
  nextTick,
  watch,
} from 'vue';
import { aiConfigStorage } from 'src/services/ai/AIConfigStorage';
import { enrichFromPayload } from 'src/services/ai/AiEnrichmentService';
import {
  subscribeToAgUiStream,
  sendAgUiChatRequest,
} from 'src/services/ai/AgUiClient';
import { AI_MODELS, selectModelForTask } from 'src/config/aiConfig';
import type { AIProvider, AIModel } from 'src/types/ai';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

const emit = defineEmits<{
  (e: 'messagesChanged', count: number): void;
}>();

const input = ref('');
const attachments = ref<File[]>([]); // Session-only, not persisted
const messages = ref<ChatMessage[]>([]); // Session-only, cleared on mount
const aiReady = ref(false);
const isStreaming = ref(false);
const currentModel = ref<string>('');
const chatWindow = ref<HTMLElement | null>(null);
const fileInput = ref<any>(null);
const currentRunId = ref<string | null>(null);
const streamingMessageIndex = ref<number | null>(null);
const streamBuffer = ref('');
const handledByStream = ref(false);
const awaitingChatFallback = ref(false);
let releaseAgUiStream: (() => void) | null = null;

const acceptedTypes =
  '.pdf,.html,.htm,.txt,.md,.csv,.json,.doc,.docx,.ppt,.pptx';

// Inject capability to update Pokedex from parent editor
const { updateInstance } = inject('pokedexActions', {
  updateInstance: (val: any) => {
    void val;
  },
});

function refreshStatus() {
  const config = aiConfigStorage.getConfig();

  // Check if any provider is validated
  aiReady.value = false;
  if (config && config.enabled) {
    const validatedProvider = Object.keys(config.providers).find(
      (p) => config.providers[p as AIProvider]?.validated
    ) as AIProvider | undefined;

    if (validatedProvider) {
      aiReady.value = true;

      // Show the model being used for chat task
      const modelName = selectModelForTask(validatedProvider, 'chat');
      const model = AI_MODELS[validatedProvider].find(
        (m) => m.name === modelName
      );
      currentModel.value = model ? model.displayName : modelName;
    }
  }
}

function getFileIcon(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    pdf: 'picture_as_pdf',
    html: 'html',
    htm: 'html',
    txt: 'description',
    md: 'article',
    csv: 'table_chart',
    json: 'code',
    doc: 'description',
    docx: 'description',
    ppt: 'slideshow',
    pptx: 'slideshow',
  };
  return iconMap[ext || ''] || 'insert_drive_file';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function removeFile(index: number) {
  attachments.value.splice(index, 1);
}

async function scrollToBottom() {
  await nextTick();
  if (chatWindow.value) {
    chatWindow.value.scrollTop = chatWindow.value.scrollHeight;
  }
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

function needsJustChat(summary?: string | null): boolean {
  if (!summary) return false;
  const normalized = summary.toLowerCase();
  return normalized.includes('no product or process');
}

function normalizeEventDetail(detail: unknown): any | null {
  if (!detail) return null;
  if (typeof detail === 'string') {
    try {
      return JSON.parse(detail);
    } catch {
      return { text: detail };
    }
  }
  if (typeof detail === 'object') return detail as any;
  return null;
}

function extractInstanceFromPayload(data: unknown): any | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as any;

  // Direct instance with category and type
  if (obj.category && obj.type) return normalizeInstance(obj);

  // Nested instance with process
  if (obj.instance && obj.instance.category) {
    return normalizeInstance({
      ...obj.instance,
      process: obj.process,
      // Preserve all fields from instance
      ...(obj.instance.description && {
        description: obj.instance.description,
      }),
    });
  }

  // populated.instance structure (AG-UI format)
  if (
    obj.populated &&
    obj.populated.instance &&
    obj.populated.instance.category
  ) {
    return normalizeInstance({
      ...obj.populated.instance,
      process: obj.populated.process,
      // Preserve all fields from populated.instance
      ...(obj.populated.instance.description && {
        description: obj.populated.instance.description,
      }),
    });
  }

  // Legacy: populated with category directly
  if (obj.populated && obj.populated.category)
    return normalizeInstance(obj.populated);

  // Recursive checks for nested structures
  if (obj.result && typeof obj.result === 'object') {
    return extractInstanceFromPayload(obj.result);
  }
  if (obj.data && typeof obj.data === 'object') {
    return extractInstanceFromPayload(obj.data);
  }

  return null;
}

function normalizeInstance(instance: any): any {
  if (!instance) return instance;

  // Normalize inputInstances in process to ensure they have type field
  if (instance.process && Array.isArray(instance.process.inputInstances)) {
    instance.process.inputInstances = instance.process.inputInstances.map(
      (inp: any) => {
        // If inputInstance doesn't have a type field, default to 'local'
        if (!inp.type) {
          return {
            type: 'local',
            ...inp,
          };
        }
        return inp;
      }
    );
  }

  return instance;
}

function ensureStreamingMessage() {
  if (streamingMessageIndex.value === null) {
    messages.value.push({
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
    });
    streamingMessageIndex.value = messages.value.length - 1;
    emit('messagesChanged', messages.value.length);
  }
}

function updateStreamingContent(chunk: string) {
  ensureStreamingMessage();
  streamBuffer.value += chunk;
  const idx = streamingMessageIndex.value;
  if (idx !== null) {
    messages.value[idx].content = streamBuffer.value;
  }
}

function finishStreaming() {
  isStreaming.value = false;
  streamBuffer.value = '';
  streamingMessageIndex.value = null;
}

function replaceLastAssistantMessage(content: string) {
  for (let i = messages.value.length - 1; i >= 0; i -= 1) {
    if (messages.value[i].role === 'assistant') {
      messages.value[i].content = content;
      messages.value[i].timestamp = new Date().toLocaleTimeString();
      return true;
    }
  }
  return false;
}

function handleAgUiEvent(event: Event) {
  const customEvent = event as CustomEvent;
  const detail = normalizeEventDetail(customEvent.detail);
  console.log(
    '[AIChatPanel] AG-UI event received:',
    JSON.stringify(detail, null, 2)
  );
  if (!detail) {
    console.warn('[AIChatPanel] AG-UI event detail is null');
    return;
  }

  const requestId = detail.requestId || detail.runId;
  const eventType = String(
    detail.eventType ||
      detail.type ||
      detail.event ||
      detail.name ||
      detail.kind ||
      ''
  ).toLowerCase();
  const isChatEvent = eventType.startsWith('chat-');

  console.log('[AIChatPanel] Request correlation:', {
    received: requestId,
    expected: currentRunId.value,
    awaitingChatFallback: awaitingChatFallback.value,
  });

  if (awaitingChatFallback.value && isChatEvent) {
    currentRunId.value = requestId || currentRunId.value;
    awaitingChatFallback.value = false;
  } else if (
    requestId &&
    currentRunId.value &&
    requestId !== currentRunId.value
  ) {
    console.log('[AIChatPanel] Ignoring event - requestId mismatch');
    return;
  }

  if (eventType === 'connected' || eventType === 'heartbeat') {
    return;
  }

  const payload = detail.payload ?? detail.data ?? detail.result ?? detail;

  if (
    eventType.endsWith('-error') ||
    eventType.includes('error') ||
    detail.error
  ) {
    const message =
      payload?.error ||
      detail.error?.message ||
      detail.error ||
      detail.message ||
      'AG-UI request failed.';
    const replaced = replaceLastAssistantMessage(`❌ ${message}`);
    if (!replaced) {
      messages.value.push({
        role: 'assistant',
        content: `❌ ${message}`,
        timestamp: new Date().toLocaleTimeString(),
      });
      emit('messagesChanged', messages.value.length);
    }
    handledByStream.value = true;
    finishStreaming();
    return;
  }

  if (eventType.endsWith('-start')) {
    isStreaming.value = true;
    return;
  }

  const textChunk =
    detail.delta ||
    detail.text ||
    detail.content ||
    detail.message ||
    payload?.text ||
    '';
  if (typeof textChunk === 'string' && textChunk.trim().length > 0) {
    updateStreamingContent(textChunk);
  }

  // Extract summary from multiple possible locations
  const summary = payload?.summary || detail.summary || payload?.message;
  console.log('[AIChatPanel] Extracted summary:', summary);

  // Try extracting instance from payload, payload.populated, or detail directly
  const instanceData =
    extractInstanceFromPayload(payload) ||
    extractInstanceFromPayload(payload?.populated) ||
    extractInstanceFromPayload(detail.populated);
  console.log(
    '[AIChatPanel] Extracted instanceData:',
    instanceData ? 'YES' : 'NO',
    instanceData
  );

  // Process completion: update instance and show summary
  const shouldProcess =
    eventType.endsWith('-complete') || summary || instanceData;
  console.log('[AIChatPanel] Should process:', shouldProcess, {
    eventType,
    hasSummary: !!summary,
    hasInstance: !!instanceData,
  });

  if (shouldProcess) {
    if (instanceData) {
      console.log('[AIChatPanel] Updating instance from AG-UI:', instanceData);
      updateInstance(instanceData);
    }

    if (summary) {
      // Always try to replace last assistant message first (handles fallback errors)
      const replaced = replaceLastAssistantMessage(`✅ ${summary}`);
      if (!replaced) {
        messages.value.push({
          role: 'assistant',
          content: `✅ ${summary}`,
          timestamp: new Date().toLocaleTimeString(),
        });
        emit('messagesChanged', messages.value.length);
      }
      console.log(
        '[AIChatPanel] Summary handled:',
        summary,
        'Replaced:',
        replaced
      );
    } else if (instanceData && !summary) {
      // If we have instance data but no summary, create a generic success message
      const replaced = replaceLastAssistantMessage(
        `✅ Product data updated successfully`
      );
      if (!replaced) {
        messages.value.push({
          role: 'assistant',
          content: `✅ Product data updated successfully`,
          timestamp: new Date().toLocaleTimeString(),
        });
        emit('messagesChanged', messages.value.length);
      }
    }

    handledByStream.value = true;
    finishStreaming();
    void scrollToBottom();
  }
}

async function send() {
  if (!aiReady.value || input.value.trim().length === 0 || isStreaming.value)
    return;

  const userMessage = input.value.trim();
  const files = attachments.value;
  const timestamp = new Date().toLocaleTimeString();

  messages.value.push({
    role: 'user',
    content: userMessage,
    timestamp,
  });
  emit('messagesChanged', messages.value.length);

  input.value = '';
  attachments.value = [];
  isStreaming.value = true;
  handledByStream.value = false;
  currentRunId.value = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  await scrollToBottom();

  try {
    const payload = await buildPayload(userMessage, files);
    const requestPayload = {
      ...payload,
      requestId: currentRunId.value || undefined,
      context: { source: 'tm-editor', schema: 'trace-market' },
    };
    const enrichment = await enrichFromPayload(requestPayload);

    if (!handledByStream.value && enrichment) {
      if (needsJustChat(enrichment.summary)) {
        awaitingChatFallback.value = true;
        const chatStarted = await sendAgUiChatRequest(requestPayload);
        if (chatStarted) {
          currentRunId.value = null;
          console.log('[AIChatPanel] Switching to AG-UI just chat flow');
          return;
        }
        awaitingChatFallback.value = false;
      }

      const instanceData = extractInstanceFromPayload(
        enrichment.populated || enrichment
      );
      if (instanceData) {
        console.log(
          '[AIChatPanel] enrichFromPayload returned instance:',
          instanceData
        );
        updateInstance(instanceData);
      }
      if (enrichment.summary) {
        const isError =
          enrichment.summary.includes('unavailable') ||
          enrichment.summary.includes('failed');
        messages.value.push({
          role: 'assistant',
          content: `${isError ? '⏳' : '✅'} ${enrichment.summary}`,
          timestamp: new Date().toLocaleTimeString(),
        });
        console.log(
          '[AIChatPanel] enrichFromPayload summary:',
          enrichment.summary,
          'isError:',
          isError
        );
        // Only mark as handled if we got real data, not an error
        if (!isError) {
          handledByStream.value = true;
          finishStreaming();
        }
        // If error, leave streaming active so AG-UI can replace it
      } else {
        handledByStream.value = true;
        finishStreaming();
      }
    }
  } catch (error) {
    console.error('Failed to send AG-UI request', error);
    messages.value.push({
      role: 'assistant',
      content: '❌ Failed to start AG-UI request. Please try again.',
      timestamp: new Date().toLocaleTimeString(),
    });
  } finally {
    if (!isStreaming.value) {
      await scrollToBottom();
    }
  }
}

function onRejected(rejected: any) {
  console.warn('File rejected', rejected);
}

onMounted(() => {
  window.addEventListener('ai-config-updated', refreshStatus);
  window.addEventListener('ag-ui', handleAgUiEvent as EventListener);
  releaseAgUiStream = subscribeToAgUiStream();
  refreshStatus();
  // Clear session-only state on mount
  messages.value = [];
  attachments.value = [];
  input.value = '';
  emit('messagesChanged', 0);
});

onUnmounted(() => {
  window.removeEventListener('ai-config-updated', refreshStatus);
  window.removeEventListener('ag-ui', handleAgUiEvent as EventListener);
  if (releaseAgUiStream) {
    releaseAgUiStream();
    releaseAgUiStream = null;
  }
});
</script>

<style scoped>
.ai-chat-panel {
  max-width: 900px;
}

.chat-window {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  scroll-behavior: smooth;
}

.chat-window::-webkit-scrollbar {
  width: 8px;
}

.chat-window::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.chat-window::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.chat-window::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
</style>
