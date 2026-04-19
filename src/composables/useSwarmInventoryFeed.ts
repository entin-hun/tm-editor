/**
 * Composable for saving/loading items to the user's Swarm inventory feeds.
 * The feed topics mirror those used by TmListPanel (tm-editor-*).
 */
import { Bee } from '@ethersphere/bee-js';
import { sha256 } from 'thirdweb/utils';
import { useAccountStore } from 'src/stores/account';

const swarmApiUrl = process.env.SWARM_API_URL;
const swarmBatchId = process.env.SWARM_BATCH;

export interface FeedEntry {
  key: string;
  target: string;
  updatedAt: string;
  value: any;
  id: string;
  name: string;
  createdAtMs: number;
  updatedAtMs: number;
  socIndex?: string;
  [key: string]: unknown;
}

export function useSwarmInventoryFeed() {
  const accountStore = useAccountStore();

  function hexToBytes(hex: string): Uint8Array {
    const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(normalized.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  async function getSwarmSigner() {
    const account = accountStore.account as any;
    if (!account?.address || !account?.signMessage) {
      throw new Error('Wallet signer not available');
    }
    const owner = account.address as string;
    return {
      address: hexToBytes(owner),
      sign: async (digest: Uint8Array) => {
        let signature: unknown;
        try {
          signature = await account.signMessage({ message: { raw: digest } });
        } catch {
          const hex = `0x${Array.from(digest)
            .map((b: number) => b.toString(16).padStart(2, '0'))
            .join('')}`;
          signature = await account.signMessage({ message: hex });
        }
        if (signature instanceof Uint8Array) return signature;
        return hexToBytes(signature as string);
      },
    } as any;
  }

  function deriveUpsertKey(payload: any): string | null {
    if (!payload || typeof payload !== 'object') return null;
    if (['string', 'number'].includes(typeof payload.key))
      return String(payload.key);
    if (['string', 'number'].includes(typeof payload._key))
      return String(payload._key);
    if (['string', 'number'].includes(typeof payload.id))
      return String(payload.id);
    const candidates = [
      payload.hash,
      payload.token,
      payload.contract,
      payload.ownerId,
      payload.type,
      payload.title,
    ];
    return (
      candidates.find(
        (item) => typeof item === 'string' && item.trim().length > 0
      ) || null
    );
  }

  async function hashJson(payload: any): Promise<string> {
    const json = JSON.stringify(payload);
    const data = new TextEncoder().encode(json);
    const hash = sha256(data);
    if (typeof hash === 'string') {
      return hash.startsWith('0x') ? hash.slice(2) : hash;
    }
    return Array.from(hash as Uint8Array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function pruneJson(val: any): any {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') return val.trim() === '' ? undefined : val;
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    if (Array.isArray(val)) {
      const pruned = val
        .map((item) => pruneJson(item))
        .filter((item) => item !== undefined);
      return pruned.length ? pruned : undefined;
    }
    if (typeof val === 'object') {
      const pruned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        const p = pruneJson(v);
        if (p !== undefined) pruned[k] = p;
      }
      return Object.keys(pruned).length ? pruned : undefined;
    }
    return val;
  }

  function getBee(): Bee {
    if (!swarmApiUrl) throw new Error('SWARM_API_URL not configured');
    const swarmAuth = process.env.SWARM_AUTH as string | undefined;
    return new Bee(
      swarmApiUrl,
      swarmAuth ? { headers: { Authorization: swarmAuth } } : undefined
    );
  }

  function localCacheKey(owner: string, topicName: string) {
    return `tm-feed-local:${owner}:${topicName}`;
  }

  function readLocalCache(owner: string, topicName: string): FeedEntry[] {
    try {
      const raw = window.localStorage.getItem(localCacheKey(owner, topicName));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as FeedEntry[]) : [];
    } catch {
      return [];
    }
  }

  function writeLocalCache(owner: string, topicName: string, list: FeedEntry[]) {
    try {
      window.localStorage.setItem(localCacheKey(owner, topicName), JSON.stringify(list));
    } catch {
      // localStorage full – non-fatal
    }
  }

  /**
   * Load all feed items for the given target.
   * Returns the local cache immediately if available (avoids Swarm indexing delay),
   * then falls back to fetching from the Swarm feed reader.
   */
  async function loadItems(target: string): Promise<FeedEntry[]> {
    if (!swarmApiUrl) throw new Error('SWARM_API_URL not configured');
    const owner = (accountStore.account as any)?.address as string | undefined;
    if (!owner) throw new Error('Wallet not connected');
    const topicName = `tm-editor-${target}`;

    // Serve from local cache first – avoids Swarm node indexing delay after a save
    const cached = readLocalCache(owner, topicName);
    if (cached.length > 0) return cached;

    // Fall back to Swarm feed reader (e.g. different device / cache cleared)
    const bee = getBee();
    const topic = bee.makeFeedTopic(topicName);
    const reader = bee.makeFeedReader('sequence', topic, owner);
    try {
      const current = await reader.download();
      if (current.reference) {
        const data = await bee.downloadData(current.reference as any);
        const parsed = JSON.parse(new TextDecoder().decode(data));
        const items = Array.isArray(parsed) ? (parsed as FeedEntry[]) : [];
        // Warm the local cache from Swarm
        if (items.length > 0) writeLocalCache(owner, topicName, items);
        return items;
      }
    } catch {
      // Feed doesn't exist yet on Swarm
    }
    return [];
  }

  /**
   * Save a payload to the user's inventory feed for the given target.
   * Optionally supply `overrideKey` to upsert an existing entry by key.
   * Returns the entry key and SOC index written.
   */
  async function saveItem(
    target: string,
    payload: any,
    overrideKey?: string
  ): Promise<{ key: string; socIndex: string }> {
    const owner = (accountStore.account as any)?.address as string | undefined;
    if (!owner) throw new Error('Wallet not connected');
    if (!swarmApiUrl || !swarmBatchId)
      throw new Error('Swarm config missing (SWARM_API_URL or SWARM_BATCH)');

    const bee = getBee();
    const signer = await getSwarmSigner();
    const topicName = `tm-editor-${target}`;
    const topic = bee.makeFeedTopic(topicName);
    const feedType = 'sequence' as const;

    const reader = bee.makeFeedReader(feedType, topic, owner);
    const writer = bee.makeFeedWriter(feedType, topic, signer);

    let nextIndexHex = '0000000000000000';
    let existingArray: FeedEntry[] = readLocalCache(owner, topicName);
    try {
      const current = await reader.download();
      nextIndexHex =
        (current as any).feedIndexNext || '0000000000000000';
      if (current.reference) {
        const data = await bee.downloadData(current.reference as any);
        const swarmList = JSON.parse(new TextDecoder().decode(data));
        // Prefer the Swarm version if it has more entries (another device may have saved)
        if (Array.isArray(swarmList) && swarmList.length >= existingArray.length) {
          existingArray = swarmList;
        }
      }
    } catch {
      // First save or node hasn't indexed yet – use local cache as baseline
    }

    const socIndex = BigInt('0x' + nextIndexHex);
    const cleanPayload = pruneJson(payload) ?? {};
    const key =
      overrideKey ||
      deriveUpsertKey(cleanPayload) ||
      (await hashJson(cleanPayload));

    const list = Array.isArray(existingArray) ? [...existingArray] : [];
    const nowMs = Date.now();
    const idx = list.findIndex(
      (item: any) => item?.key === key && item?.target === target
    );
    const existingEntry = idx >= 0 ? list[idx] : null;
    const entry: FeedEntry = {
      key,
      target,
      updatedAt: new Date(nowMs).toISOString(),
      value: cleanPayload,
      id: existingEntry?.id ?? crypto.randomUUID(),
      name:
        cleanPayload.type ||
        cleanPayload.name ||
        cleanPayload.title ||
        target,
      createdAtMs: existingEntry?.createdAtMs ?? nowMs,
      updatedAtMs: nowMs,
      socIndex: socIndex.toString(),
    };

    if (idx >= 0) list[idx] = { ...list[idx], ...entry };
    else list.push(entry);

    const upload = await bee.uploadData(
      swarmBatchId,
      JSON.stringify(list)
    );
    await writer.upload(swarmBatchId, upload.reference, {
      index: nextIndexHex as any,
    });

    // Cache the written array locally so Load works immediately (before Swarm node indexes)
    writeLocalCache(owner, topicName, list);
    // Mark this feed as existing so TmListPanel knows to load it
    window.localStorage.setItem(
      `swarm:feed:${owner}:${topicName}`,
      upload.reference.toString()
    );

    return { key, socIndex: socIndex.toString() };
  }

  return { saveItem, loadItems };
}
