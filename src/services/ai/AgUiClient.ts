import { aiConfigStorage } from './AIConfigStorage';
import { selectModelForTask } from 'src/config/aiConfig';
import type { TaskType } from 'src/config/aiConfig';

const DEFAULT_STREAM_URL = 'https://add.trace.market/ag-ui/stream';
const DEFAULT_CHAT_URL = 'https://add.trace.market/chat';

const STREAM_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any)?.env?.VITE_AG_UI_STREAM_URL) ||
  DEFAULT_STREAM_URL;
const CHAT_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any)?.env?.VITE_AG_UI_CHAT_URL) ||
  DEFAULT_CHAT_URL;

interface ChatPayload {
  text: string;
  attachments?: { name: string; content: string }[];
  requestId?: string;
  context?: {
    source?: string;
    schema?: string;
  };
}

let subscribers = 0;
let reconnectTimer: number | null = null;
const RECONNECT_DELAY = 5000;

let activeController: AbortController | null = null;
let isConnecting = false;
let lastEventId: string | null = null;

function dispatchAgUiEvent(detail: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent('ag-ui', {
      detail,
    })
  );
}

function buildHeaders(
  taskType: TaskType,
  overrides?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = aiConfigStorage.getActiveApiKey();
  const provider = aiConfigStorage.getActiveProvider();

  if (apiKey && provider) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['x-ai-provider'] = provider;
    headers['x-ai-model'] = selectModelForTask(provider, taskType);
  }

  return overrides ? { ...headers, ...overrides } : headers;
}

function scheduleReconnect() {
  if (typeof window === 'undefined') {
    return;
  }
  if (subscribers === 0 || reconnectTimer) {
    return;
  }
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectStream();
  }, RECONNECT_DELAY);
}

function cleanupStream() {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
  if (typeof window !== 'undefined' && reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  isConnecting = false;
}

function connectStream() {
  if (typeof window === 'undefined') {
    return;
  }
  if (subscribers === 0 || isConnecting || activeController) {
    return;
  }

  isConnecting = true;
  const controller = new AbortController();
  activeController = controller;

  const streamHeaders: Record<string, string> = {
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  };
  if (lastEventId) {
    streamHeaders['Last-Event-ID'] = lastEventId;
  }

  const headers = buildHeaders('chat', streamHeaders);

  fetch(STREAM_URL, {
    method: 'GET',
    headers,
    mode: 'cors',
    cache: 'no-store',
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`AG-UI stream failed with ${response.status}`);
      }
      if (!response.body) {
        throw new Error('AG-UI stream missing body');
      }
      return pumpStream(response.body, controller);
    })
    .catch((error) => {
      if (controller.signal.aborted) {
        return;
      }
      console.warn('[AgUiClient] Stream error', error);
    })
    .finally(() => {
      if (activeController === controller) {
        activeController = null;
      }
      isConnecting = false;
      if (subscribers > 0) {
        scheduleReconnect();
      }
    });
}

async function pumpStream(
  body: ReadableStream<Uint8Array>,
  controller: AbortController
) {
  const reader = body.getReader();
  let buffer = '';
  const textDecoder = new TextDecoder();

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += textDecoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r/g, '');

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        processRawEvent(rawEvent);
        boundary = buffer.indexOf('\n\n');
      }
    }
    buffer += textDecoder.decode();
    if (buffer.trim()) {
      processRawEvent(buffer);
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      throw error;
    }
  } finally {
    reader.releaseLock();
  }

  if (!controller.signal.aborted) {
    throw new Error('AG-UI stream closed unexpectedly');
  }
}

function processRawEvent(rawEvent: string) {
  if (!rawEvent?.trim()) return;

  const lines = rawEvent.split('\n');
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(':')) continue; // comment
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim() || 'message';
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5));
      continue;
    }
    if (line.startsWith('id:')) {
      lastEventId = line.slice(3).trim() || null;
    }
  }

  const payload = dataLines.join('\n').trim();
  if (!payload) return;

  if (eventName === 'ag-ui' || eventName === 'message') {
    dispatchAgUiEvent(payload);
  }
}

export function subscribeToAgUiStream(): () => void {
  subscribers += 1;
  if (subscribers === 1) {
    connectStream();
  }

  return () => {
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0) {
      cleanupStream();
    }
  };
}

export async function sendAgUiChatRequest(
  payload: ChatPayload
): Promise<boolean> {
  if (!aiConfigStorage.isConfigured()) {
    console.warn('[AgUiClient] AI is not configured; cannot start chat request');
    return false;
  }

  const text = payload.text?.trim();
  if (!text) {
    return false;
  }

  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: buildHeaders('chat'),
      body: JSON.stringify({
        ...payload,
        text,
      }),
    });

    if (!response.ok) {
      console.warn('[AgUiClient] Chat request failed', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[AgUiClient] Chat request error', error);
    return false;
  }
}
