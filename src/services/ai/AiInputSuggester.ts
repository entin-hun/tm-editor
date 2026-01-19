import { LocalInputInstance } from '@trace.market/types';
import { aiConfigStorage } from './AIConfigStorage';
import { selectModelForTask } from 'src/config/aiConfig';
import type { TaskType } from 'src/config/aiConfig';

export interface SuggestionParams {
  title?: string;
  brand?: string;
  category?: string;
  type?: string;
  quantity?: number;
  size?: string;
  format?: string;
  ownerId?: string;
  ids?: { id: string; registry: string }[];
  query?: string;
}

function aiReady(): boolean {
  return aiConfigStorage.isConfigured();
}

const SUGGEST_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any)?.env?.VITE_MCP_FOOD_SUGGEST_URL) ||
  'https://mcp.trace.market/suggest/food';

export async function suggestInputsFromQuery(
  params: SuggestionParams | string
): Promise<LocalInputInstance[]> {
  if (!aiReady()) return [];

  const payload = typeof params === 'string' ? { query: params } : params;
  const apiKey = aiConfigStorage.getActiveApiKey();
  const provider = aiConfigStorage.getActiveProvider();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey && provider) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['x-ai-provider'] = provider;
    // Automatically select best model for suggestion task
    const bestModel = selectModelForTask(provider, 'suggestion' as TaskType);
    headers['x-ai-model'] = bestModel;
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(SUGGEST_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(
        '[AiInputSuggester] MCP request failed:',
        res.status,
        res.statusText
      );
      return [];
    }

    const data = await res.json();
    console.log('[AiInputSuggester] MCP response data:', data);

    if (Array.isArray(data)) return data as LocalInputInstance[];
    if (Array.isArray((data as any)?.suggestions))
      return (data as any).suggestions as LocalInputInstance[];
    if (Array.isArray((data as any)?.inputs))
      return (data as any).inputs as LocalInputInstance[];
    if (Array.isArray((data as any)?.inputInstances))
      return (data as any).inputInstances as LocalInputInstance[];
    if (Array.isArray((data as any)?.process?.inputInstances)) {
      return (data as any).process.inputInstances as LocalInputInstance[];
    }

    console.warn('[AiInputSuggester] MCP response missing suggestions array');
    return [];
  } catch (error) {
    const err = error as any;
    if (err?.name === 'AbortError') {
      console.warn('[AiInputSuggester] Suggestion timeout after 20s');
    } else {
      console.warn('[AiInputSuggester] Suggestion error:', err?.message || err);
    }
    return [];
  }
}

export function isAiReadyForSuggestions(): boolean {
  return aiReady();
}
