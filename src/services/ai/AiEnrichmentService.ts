import axios from 'axios';
import { aiConfigStorage } from './AIConfigStorage';
import { selectModelForTask } from 'src/config/aiConfig';
import type { TaskType } from 'src/config/aiConfig';
import { ProductInstance } from '@trace.market/types';

export interface EnrichmentPayload {
  text?: string;
  attachments?: { name: string; content: string }[];
  requestId?: string;
  context?: {
    source?: string;
    schema?: string;
  };
  externalSources?: {
    source?: string;
    registry?: string;
    id?: string;
    url?: string;
  }[];
}

export interface EnrichmentResult {
  summary: string;
  populated?: ProductInstance;
  rawText?: string;
}

function sanitizeHtmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchTextFromUrl(url: string): Promise<string> {
  try {
    const resp = await axios.get<string>(url, { responseType: 'text' });
    return sanitizeHtmlToText(resp.data ?? '');
  } catch (error) {
    console.error('[AiEnrichment] fetchTextFromUrl failed', { url, error });
    return '';
  }
}

/**
 * Call MCP server to map raw text into typed JSON.
 */
function tryParseJson(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON object from text (e.g. code fences or extra commentary)
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenced?.[1] ?? text;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const raw = candidate.slice(start, end + 1);
      try {
        return JSON.parse(raw);
      } catch {
        // Try a lenient cleanup (remove trailing commas)
        const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
        try {
          return JSON.parse(cleaned);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractProductInstance(data: unknown): ProductInstance | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const obj = data as any;

  if (obj.category) return obj as ProductInstance;

  if (
    obj.populated &&
    typeof obj.populated === 'object' &&
    obj.populated.category
  ) {
    return obj.populated as ProductInstance;
  }

  if (
    obj.instance &&
    typeof obj.instance === 'object' &&
    obj.instance.category
  ) {
    return obj.instance as ProductInstance;
  }

  if (obj.data && typeof obj.data === 'object') {
    const nested = extractProductInstance(obj.data);
    if (nested) return nested;
  }

  if (obj.result && typeof obj.result === 'object') {
    const nested = extractProductInstance(obj.result);
    if (nested) return nested;
  }

  return undefined;
}

const EXTRACT_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any)?.env?.VITE_MCP_EXTRACT_URL) ||
  'https://mcp.trace.market/extract';

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = aiConfigStorage.getActiveApiKey();
  const provider = aiConfigStorage.getActiveProvider();

  if (apiKey && provider) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['x-ai-provider'] = provider;
    // Automatically select best model for extraction task
    const bestModel = selectModelForTask(provider, 'extraction' as TaskType);
    headers['x-ai-model'] = bestModel;
  }

  return headers;
}

async function runStructuredExtraction(input: {
  text: string;
  attachments?: EnrichmentPayload['attachments'];
  requestId?: string;
  context?: EnrichmentPayload['context'];
}): Promise<EnrichmentResult> {
  try {
    const resp = await axios.post<ProductInstance | string>(
      EXTRACT_URL,
      {
        ...input,
        context: input.context || {
          source: 'tm-editor',
          schema: 'trace-market',
        },
      },
      { timeout: 30000, headers: buildHeaders() }
    );

    if (resp.data) {
      console.log('[AiEnrichment] Raw MCP response data:', resp.data);
      let data: unknown = resp.data;
      if (typeof data === 'string') {
        const parsed = tryParseJson(data);
        if (parsed) {
          data = parsed;
          console.log('[AiEnrichment] Parsed JSON from string response');
        } else {
          console.warn('[AiEnrichment] Response was string but not valid JSON');
        }
      }

      console.log('[AiEnrichment] Normalized data type:', typeof data);

      // Check if response already has summary/populated structure (new API format)
      const dataObj = data as any;
      if (dataObj && typeof dataObj === 'object') {
        // New format: {summary, populated: {instance, process}}
        if (dataObj.summary && dataObj.populated) {
          console.log(
            '[AiEnrichment] Response has summary/populated structure:',
            dataObj.summary
          );
          return {
            summary: dataObj.summary,
            populated: dataObj.populated,
            rawText: input.text,
          };
        }

        // Legacy format: try to extract ProductInstance directly
        const instance = extractProductInstance(data);
        if (instance) {
          console.log(
            '[AiEnrichment] Valid ProductInstance detected:',
            instance
          );
          const type = (instance as any).type || 'unknown-item';
          return {
            summary: `Extracted ${type} from provided text.`,
            populated: instance,
            rawText: input.text,
          };
        }
      }

      console.warn('[AiEnrichment] No valid data structure found in response');
    }
  } catch (error) {
    console.error('[AiEnrichment] MCP extraction failed', { error });
  }

  return {
    summary: 'AI extraction unavailable; MCP call failed.',
    rawText: input.text,
    populated: undefined,
  };
}

export async function enrichFromPayload(
  payload: EnrichmentPayload
): Promise<EnrichmentResult | null> {
  if (!aiConfigStorage.isConfigured()) {
    return null;
  }

  let aggregatedText = payload.text ? payload.text + '\n' : '';

  // Pull from attachments
  if (payload.attachments?.length) {
    aggregatedText += payload.attachments
      .map((a) => `\n[${a.name}]\n${a.content}`)
      .join('\n');
  }

  // Pull from externalSources with registry=url or https id
  if (payload.externalSources?.length) {
    for (const src of payload.externalSources) {
      const url = src.url || (src.registry === 'url' ? src.id : undefined);
      if (url && /^https?:\/\//i.test(url)) {
        const text = await fetchTextFromUrl(url);
        if (text) {
          aggregatedText += `\n[Source ${url}]\n${text}`;
        }
      }
    }
  }

  if (!aggregatedText.trim()) {
    return null;
  }

  return runStructuredExtraction({
    text: aggregatedText,
    attachments: payload.attachments,
    requestId: payload.requestId,
    context: payload.context,
  });
}
