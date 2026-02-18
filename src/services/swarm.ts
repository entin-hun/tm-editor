import axios from 'axios';

const DEFAULT_BASE_URL = 'https://swarm.trace.market';

function getBaseUrl() {
  return import.meta.env.VITE_SWARM_BASE_URL || DEFAULT_BASE_URL;
}

function getBatchId() {
  const batchId = import.meta.env.VITE_SWARM_BATCH_ID;
  if (!batchId) {
    throw new Error('Missing VITE_SWARM_BATCH_ID');
  }
  return batchId;
}

export async function uploadSwarmJson(payload: unknown) {
  const baseUrl = getBaseUrl();
  const batchId = getBatchId();
  const response = await axios.post(`${baseUrl}/bzz`, payload, {
    headers: {
      'swarm-postage-batch-id': batchId,
      'swarm-pin': 'true',
      'Content-Type': 'application/json',
    },
  });

  const reference =
    typeof response.data === 'string'
      ? response.data.trim()
      : response.data?.reference || response.data?.hash || '';

  if (!reference) {
    throw new Error('Swarm upload failed: missing reference');
  }

  return {
    reference,
    url: `bzz://${reference}`,
    gatewayUrl: `${baseUrl}/bzz/${reference}`,
  };
}

export async function fetchSwarmJson(referenceOrUrl: string) {
  const baseUrl = getBaseUrl();
  const trimmed = referenceOrUrl.trim();
  if (!trimmed) {
    throw new Error('Swarm reference is required');
  }

  const reference = trimmed.startsWith('bzz://')
    ? trimmed.replace('bzz://', '')
    : trimmed.split('/').pop() || '';

  if (!reference) {
    throw new Error('Invalid Swarm reference');
  }

  const response = await axios.get(`${baseUrl}/bzz/${reference}`);
  return response.data;
}
