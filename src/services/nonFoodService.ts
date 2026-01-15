import { aiConfigStorage } from './ai/AIConfigStorage';

const NON_FOOD_DECOMPOSE_URL = 'https://add.trace.market/decompose/non-food';
const NON_FOOD_CARBON_URL = 'https://add.trace.market/suggest/non-food';

export interface NonFoodDecompositionResponse {
  name?: string;
  category?: string;
  process?: {
    type?: string;
    name?: string;
    inputInstances?: Array<{
      quantity?: number;
      priceShare?: number;
      type?: string;
      instance?: Record<string, unknown>;
    }>;
  };
  comparison?: Record<string, unknown>;
  source?: string;
}

export interface NonFoodCarbonResponse {
  category?: string;
  name?: string;
  carbon_footprint?: number;
  unit?: string;
  source?: string;
  details?: Record<string, unknown>;
}

export type NonFoodDecompositionPayload = {
  query: string;
  [key: string]: unknown;
};

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const config = aiConfigStorage.getConfig();
  if (config?.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
    if ((config as any)?.provider) {
      headers['x-ai-provider'] = String((config as any).provider);
    }
  }

  return headers;
}

async function postJson<T>(
  url: string,
  payload: Record<string, unknown>
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn('[NonFoodService] Request failed', url, res.status);
      return null;
    }

    return (await res.json()) as T;
  } catch (error) {
    console.warn('[NonFoodService] Request error', url, error);
    return null;
  }
}

export async function fetchNonFoodDecomposition(
  payload: NonFoodDecompositionPayload
): Promise<NonFoodDecompositionResponse | null> {
  const query = typeof payload?.query === 'string' ? payload.query.trim() : '';
  if (!query) return null;
  return postJson<NonFoodDecompositionResponse>(NON_FOOD_DECOMPOSE_URL, {
    ...payload,
    query,
  });
}

export async function fetchNonFoodCarbon(
  query: string
): Promise<NonFoodCarbonResponse | null> {
  const trimmed = query?.trim();
  if (!trimmed) return null;
  return postJson<NonFoodCarbonResponse>(NON_FOOD_CARBON_URL, {
    query: trimmed,
  });
}
