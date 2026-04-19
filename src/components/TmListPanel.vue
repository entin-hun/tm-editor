<template>
  <div class="fit">
    <q-page-sticky :offset="[24, 24]">
      <q-btn fab icon="refresh" @click="reload" />
    </q-page-sticky>

    <div
      v-if="listRequest.isLoading.value || feedRequest.isLoading.value"
      class="fixed-center"
    >
      <div class="column content-center items-center">
        <q-spinner size="4em" />
        <div class="q-py-md">Fetching Data...</div>
      </div>
    </div>
    <div v-else-if="listRequest.error.value" class="fixed-center">
      <div class="column content-center items-center q-pa-md">
        <q-icon name="error" size="4em" />
        <div class="q-py-md">{{ listRequest.error }}</div>
        <div class="text-caption text-grey-5">
          Ensure wallet is connected and contract envs are set.
        </div>
      </div>
    </div>
    <div v-else class="column q-gutter-md">
      <div
        v-if="feedRequest.error.value"
        class="q-pa-md text-negative bg-red-1 rounded-borders"
      >
        <q-icon name="warning" class="q-mr-sm" />
        Feed Error: {{ feedRequest.error.value }}
      </div>

      <q-expansion-item label="Instances" icon="inventory_2" default-opened>
        <div v-if="getFeedItems('tm-editor-instance').length" class="row">
          <q-card
            v-for="(entry, idx) in getFeedItems('tm-editor-instance')"
            :key="'feed-inst-' + idx"
            flat
            bordered
            class="q-ma-sm col-12"
            style="width: 100%"
          >
            <q-card-section>
              <div class="row items-center justify-between">
                <div class="text-caption text-grey-8">
                  <q-icon name="rss_feed" size="xs" class="q-mr-xs" />
                  {{
                    entry.updatedAt
                      ? new Date(entry.updatedAt).toLocaleString()
                      : 'Unknown'
                  }}
                  <span
                    v-if="entry.key"
                    class="q-ml-sm text-weight-bold text-primary cursor-pointer"
                    @click="copyToClipboard(entry.key)"
                  >
                    #{{ entry.key }}
                    <q-tooltip>Copy Slug</q-tooltip>
                  </span>
                </div>
                <div class="row q-gutter-xs">
                  <q-btn
                    icon="edit"
                    flat
                    round
                    dense
                    color="primary"
                    @click="$emit('load-entry', entry)"
                  >
                    <q-tooltip>Load</q-tooltip>
                  </q-btn>
                  <q-btn
                    icon="share"
                    flat
                    round
                    dense
                    color="secondary"
                    @click="$emit('share', entry)"
                  >
                    <q-tooltip>Share</q-tooltip>
                  </q-btn>
                </div>
              </div>
              <div class="q-mt-sm text-body2" style="word-break: break-word">
                {{ getEntryValues(entry.value) }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div v-if="instanceNfts.length" class="row">
          <q-card
            v-for="item in instanceNfts"
            :key="item.tokenId.toString()"
            class="q-ma-sm col-12"
            style="width: 100%"
          >
            <q-card-section>
              <div class="row items-center q-mb-sm">
                <div class="col text-subtitle2">Token #{{ item.tokenId }}</div>
                <div
                  v-if="account !== undefined"
                  class="row items-center q-gutter-xs"
                >
                  <q-chip
                    v-if="item.listing !== undefined"
                    dense
                    color="positive"
                    text-color="white"
                    icon="public"
                    label="Publicly Listed"
                  />
                  <q-btn
                    dense
                    flat
                    icon="tune"
                    color="secondary"
                    @click="
                      openPriceDialog(
                        item.tokenId,
                        item.metadata,
                        false,
                        item.listing?.id ?? null
                      )
                    "
                  >
                    <q-tooltip>Edit listing price</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="item.listing !== undefined"
                    dense
                    color="negative"
                    icon="remove_shopping_cart"
                    label="De-list"
                    @click="cancelListing(item.tokenId, item.listing.id)"
                  />
                  <q-btn
                    v-else
                    dense
                    color="primary"
                    icon="sell"
                    label="List"
                    @click="createListing(item.tokenId, item.metadata)"
                  />
                </div>
              </div>
              <div class="row items-center">
                <div class="col text-caption text-grey-6">
                  {{ item.stringValues }}
                </div>
                <q-btn
                  round
                  flat
                  size="10px"
                  icon="content_copy"
                  @click="copyToClipboard(item.tokenId.toString())"
                  class="q-ml-sm"
                />
                <a
                  :href="fairFoodUrl(item.tokenId)"
                  target="_blank"
                  class="q-ml-sm"
                >
                  <q-icon name="open_in_new" size="16px" />
                </a>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <div
          v-if="
            !instanceNfts.length && !getFeedItems('tm-editor-instance').length
          "
          class="q-pa-md text-caption text-grey-6"
        >
          No instance items found.
        </div>
      </q-expansion-item>

      <q-expansion-item
        label="Tools"
        icon="precision_manufacturing"
        default-opened
      >
        <div v-if="getFeedItems('tm-editor-machine').length" class="row">
          <q-card
            v-for="(entry, idx) in getFeedItems('tm-editor-machine')"
            :key="'feed-machine-' + idx"
            flat
            bordered
            class="q-ma-sm col-12"
            style="width: 100%"
          >
            <q-card-section>
              <div class="row items-center justify-between">
                <div class="text-caption text-grey-8">
                  <q-icon name="rss_feed" size="xs" class="q-mr-xs" />
                  {{
                    entry.updatedAt
                      ? new Date(entry.updatedAt).toLocaleString()
                      : 'Unknown'
                  }}
                  <span
                    v-if="entry.key"
                    class="q-ml-sm text-weight-bold text-primary cursor-pointer"
                    @click="copyToClipboard(entry.key)"
                  >
                    #{{ entry.key }}
                    <q-tooltip>Copy Slug</q-tooltip>
                  </span>
                </div>
                <div class="row q-gutter-xs">
                  <q-btn
                    icon="edit"
                    flat
                    round
                    dense
                    color="primary"
                    @click="$emit('load-entry', entry)"
                  >
                    <q-tooltip>Load</q-tooltip>
                  </q-btn>
                  <q-btn
                    icon="share"
                    flat
                    round
                    dense
                    color="secondary"
                    @click="$emit('share', entry)"
                  >
                    <q-tooltip>Share</q-tooltip>
                  </q-btn>
                </div>
              </div>
              <div class="q-mt-sm text-body2" style="word-break: break-word">
                {{ getEntryValues(entry.value) }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div v-if="machineNfts.length" class="row">
          <q-card
            v-for="item in machineNfts"
            :key="item.tokenId.toString()"
            class="q-ma-sm col-12"
            style="width: 100%"
          >
            <q-card-section>
              <div class="row items-center q-mb-sm">
                <div class="col text-subtitle2">Token #{{ item.tokenId }}</div>
                <div
                  v-if="account !== undefined"
                  class="row items-center q-gutter-xs"
                >
                  <q-chip
                    v-if="item.listing !== undefined"
                    dense
                    color="positive"
                    text-color="white"
                    icon="public"
                    label="Publicly Listed"
                  />
                  <q-btn
                    dense
                    flat
                    icon="tune"
                    color="secondary"
                    @click="
                      openPriceDialog(
                        item.tokenId,
                        item.metadata,
                        false,
                        item.listing?.id ?? null
                      )
                    "
                  >
                    <q-tooltip>Edit listing price</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="item.listing !== undefined"
                    dense
                    color="negative"
                    icon="remove_shopping_cart"
                    label="De-list"
                    @click="cancelListing(item.tokenId, item.listing.id)"
                  />
                  <q-btn
                    v-else
                    dense
                    color="primary"
                    icon="sell"
                    label="List"
                    @click="createListing(item.tokenId, item.metadata)"
                  />
                </div>
              </div>
              <div class="row items-center">
                <div class="col text-caption text-grey-6">
                  {{ item.stringValues }}
                </div>
                <q-btn
                  round
                  flat
                  size="10px"
                  icon="content_copy"
                  @click="copyToClipboard(item.tokenId.toString())"
                  class="q-ml-sm"
                />
                <a
                  :href="fairFoodUrl(item.tokenId)"
                  target="_blank"
                  class="q-ml-sm"
                >
                  <q-icon name="open_in_new" size="16px" />
                </a>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <div
          v-if="
            !machineNfts.length && !getFeedItems('tm-editor-machine').length
          "
          class="q-pa-md text-caption text-grey-6"
        >
          No tool items found.
        </div>
      </q-expansion-item>

      <q-expansion-item label="Know-How" icon="menu_book" default-opened>
        <div v-if="getFeedItems('tm-editor-knowHow').length" class="row">
          <q-card
            v-for="(entry, idx) in getFeedItems('tm-editor-knowHow')"
            :key="'feed-kh-' + idx"
            flat
            bordered
            class="q-ma-sm col-12"
            style="width: 100%"
          >
            <q-card-section>
              <div class="row items-center justify-between">
                <div class="text-caption text-grey-8">
                  <q-icon name="rss_feed" size="xs" class="q-mr-xs" />
                  {{
                    entry.updatedAt
                      ? new Date(entry.updatedAt).toLocaleString()
                      : 'Unknown'
                  }}
                  <span
                    v-if="entry.key"
                    class="q-ml-sm text-weight-bold text-primary cursor-pointer"
                    @click="copyToClipboard(entry.key)"
                  >
                    #{{ entry.key }}
                    <q-tooltip>Copy Slug</q-tooltip>
                  </span>
                </div>
                <div class="row q-gutter-xs">
                  <q-btn
                    icon="edit"
                    flat
                    round
                    dense
                    color="primary"
                    @click="$emit('load-entry', entry)"
                  >
                    <q-tooltip>Load</q-tooltip>
                  </q-btn>
                  <q-btn
                    icon="share"
                    flat
                    round
                    dense
                    color="secondary"
                    @click="$emit('share', entry)"
                  >
                    <q-tooltip>Share</q-tooltip>
                  </q-btn>
                </div>
              </div>
              <div class="q-mt-sm text-body2" style="word-break: break-word">
                {{ getEntryValues(entry.value) }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <div v-if="knowHowNfts.length" class="row">
          <q-card
            v-for="item in knowHowNfts"
            :key="item.tokenId.toString()"
            class="q-ma-sm col-12"
            style="width: 100%"
          >
            <q-card-section>
              <div class="row items-center q-mb-sm">
                <div class="col text-subtitle2">Token #{{ item.tokenId }}</div>
                <div
                  v-if="account !== undefined"
                  class="row items-center q-gutter-xs"
                >
                  <q-chip
                    v-if="item.listing !== undefined"
                    dense
                    color="positive"
                    text-color="white"
                    icon="public"
                    label="Publicly Listed"
                  />
                  <q-btn
                    dense
                    flat
                    icon="tune"
                    color="secondary"
                    @click="
                      openPriceDialog(
                        item.tokenId,
                        item.metadata,
                        false,
                        item.listing?.id ?? null
                      )
                    "
                  >
                    <q-tooltip>Edit listing price</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="item.listing !== undefined"
                    dense
                    color="negative"
                    icon="remove_shopping_cart"
                    label="De-list"
                    @click="cancelListing(item.tokenId, item.listing.id)"
                  />
                  <q-btn
                    v-else
                    dense
                    color="primary"
                    icon="sell"
                    label="List"
                    @click="createListing(item.tokenId, item.metadata)"
                  />
                </div>
              </div>
              <div class="row items-center">
                <div class="col text-caption text-grey-6">
                  {{ item.stringValues }}
                </div>
                <q-btn
                  round
                  flat
                  size="10px"
                  icon="content_copy"
                  @click="copyToClipboard(item.tokenId.toString())"
                  class="q-ml-sm"
                />
                <a
                  :href="fairFoodUrl(item.tokenId)"
                  target="_blank"
                  class="q-ml-sm"
                >
                  <q-icon name="open_in_new" size="16px" />
                </a>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <div
          v-if="
            !knowHowNfts.length && !getFeedItems('tm-editor-knowHow').length
          "
          class="q-pa-md text-caption text-grey-6"
        >
          No know-how items found.
        </div>
      </q-expansion-item>

      <q-dialog v-model="priceDialogOpen">
        <q-card style="min-width: 420px; max-width: 92vw">
          <q-card-section class="text-subtitle1"
            >Edit Listing Price</q-card-section
          >
          <q-card-section class="column q-gutter-sm">
            <q-input
              v-model.number="priceDraft.amount"
              type="number"
              min="0"
              label="amount"
            />
            <q-select
              v-model="priceDraft.currency"
              :options="CHIADO_CURRENCY_OPTIONS"
              emit-value
              map-options
              label="currency"
            />
            <q-select
              v-model="priceDraft.type"
              :options="PRICE_TYPE_OPTIONS"
              label="type"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Cancel" v-close-popup />
            <q-btn color="primary" label="Save" @click="savePriceDialog" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core';
import { getOwnedNFTs } from 'thirdweb/extensions/erc721';
import { getContract } from 'thirdweb';
import { useAccountStore } from 'src/stores/account';
import { storeToRefs } from 'pinia';
import { copyToClipboard, useQuasar } from 'quasar';
import { computed, ref } from 'vue';
import { api } from 'src/boot/axios';
import { Pokedex } from '@trace.market/types';
import { useListingsStore } from 'src/stores/listings';
import { getAllListings, totalListings } from 'thirdweb/extensions/marketplace';
import CreateListingDialog from './CreateListingDialog.vue';
import CancelListingDialog from './CancelListingDialog.vue';
import { getColonyNetworkClient, Network } from '@colony/colony-js';
import { providers, utils } from 'ethers';
import { Bee } from '@ethersphere/bee-js';

const accountStore = useAccountStore();
const { account } = storeToRefs(accountStore);
const $q = useQuasar();

const env =
  typeof import.meta !== 'undefined' && (import.meta as any)?.env
    ? (import.meta as any).env
    : {};
const pickEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value =
      (env?.[key] as string | undefined) ??
      ((process as any)?.env?.[key] as string | undefined);
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const nftContractAddress = pickEnv(
  'VITE_NFT_CONTRACT',
  'VITE_NEXT_PUBLIC_NFT_CONTRACT',
  'NEXT_PUBLIC_NFT_CONTRACT',
  'NFT_CONTRACT'
);
const marketplaceContractAddress = pickEnv(
  'VITE_MARKETPLACE_CONTRACT',
  'VITE_NEXT_PUBLIC_MARKETPLACE_CONTRACT',
  'NEXT_PUBLIC_MARKETPLACE_CONTRACT',
  'MARKETPLACE_CONTRACT'
);
const packageUrl = pickEnv('VITE_PACKAGE_URL', 'PACKAGE_URL');

const CHIADO_CURRENCY_OPTIONS = [
  { label: 'EURe', value: '0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71' },
  { label: 'GBPe', value: '0x436AF2954BB436b6821Ab401112092e14CDBd546' },
  { label: 'USDe', value: '0x8bf987c9d041176758FE9C1180885bD4DA011a5a' },
];
const PRICE_TYPE_OPTIONS = ['is', 'budget', '%', 'payin30days', 'payin60days'];
const DEFAULT_CURRENCY = CHIADO_CURRENCY_OPTIONS[0].value;

const priceDialogOpen = ref(false);
const priceDialogTokenId = ref<bigint | null>(null);
const priceDialogMetadata = ref<Pokedex | null>(null);
const listAfterPriceSave = ref(false);
const priceDialogCurrentListingId = ref<bigint | null>(null);
const priceDraft = ref<{ amount: number; currency: string; type: string }>({
  amount: 0,
  currency: DEFAULT_CURRENCY,
  type: 'is',
});

interface NftWithMetadata {
  tokenId: bigint;
  blockNumber: bigint;
  metadata: Pokedex | null;
  stringValues: string;
}

type OwnedNftLite = {
  id: bigint;
  blockNumber?: bigint;
};

async function getOwnedNftsFromTransferLogs(
  ownerAddress: string,
  contractAddress: string
): Promise<OwnedNftLite[]> {
  const rpcUrl = pickEnv(
    'VITE_CHAIN_RPC',
    'CHAIN_RPC',
    'VITE_NEXT_PUBLIC_CHAIN_RPC',
    'NEXT_PUBLIC_CHAIN_RPC'
  );

  const provider = rpcUrl
    ? new providers.JsonRpcProvider(rpcUrl)
    : (window as any)?.ethereum?.request
    ? new providers.Web3Provider((window as any).ethereum, 'any')
    : null;

  if (!provider) return [];

  const ownerTopic = utils.hexZeroPad(ownerAddress, 32);
  const transferTopic = utils.id('Transfer(address,address,uint256)');

  const [receivedLogs, sentLogs] = await Promise.all([
    provider.getLogs({
      address: contractAddress,
      fromBlock: 0,
      toBlock: 'latest',
      topics: [transferTopic, null, ownerTopic],
    }),
    provider.getLogs({
      address: contractAddress,
      fromBlock: 0,
      toBlock: 'latest',
      topics: [transferTopic, ownerTopic],
    }),
  ]);

  const latestOwnership = new Map<
    string,
    { owner: string; blockNumber: bigint; logIndex: number }
  >();

  [...receivedLogs, ...sentLogs]
    .sort((left, right) => {
      if (left.blockNumber !== right.blockNumber) {
        return left.blockNumber - right.blockNumber;
      }
      return (left.logIndex || 0) - (right.logIndex || 0);
    })
    .forEach((log) => {
      const tokenId = BigInt(log.topics?.[3] || '0x0').toString();
      const to = `0x${String(log.topics?.[2] || '').slice(-40)}`.toLowerCase();
      latestOwnership.set(tokenId, {
        owner: to,
        blockNumber: BigInt(log.blockNumber || 0),
        logIndex: log.logIndex || 0,
      });
    });

  const ownerLower = ownerAddress.toLowerCase();
  return Array.from(latestOwnership.entries())
    .filter(([, info]) => info.owner === ownerLower)
    .map(([tokenId, info]) => ({
      id: BigInt(tokenId),
      blockNumber: info.blockNumber,
    }));
}

async function getOwnedNftsFallback(
  ownerAddress: string,
  contractAddress?: string
): Promise<OwnedNftLite[]> {
  const chainId = Number((accountStore.chain as any)?.id || 10200);
  const clientId = String((accountStore.client as any)?.clientId || '').trim();
  const normalizedContract = String(contractAddress || '').trim();

  if (normalizedContract) {
    try {
      const fromLogs = await getOwnedNftsFromTransferLogs(
        ownerAddress,
        normalizedContract
      );
      if (fromLogs.length > 0 || chainId === 10200) {
        return fromLogs;
      }
    } catch (error) {
      console.warn('[TmListPanel] Transfer-log fallback failed', error);
    }
  }

  if (!clientId || chainId === 10200) {
    return [];
  }

  const urls = [
    normalizedContract
      ? `https://${chainId}.insight.thirdweb.com/v1/tokens/erc721/${ownerAddress}?contractAddress=${encodeURIComponent(
          normalizedContract
        )}`
      : '',
    `https://${chainId}.insight.thirdweb.com/v1/tokens/erc721/${ownerAddress}`,
  ].filter(Boolean);

  let payload: {
    data?: Array<{
      collectionAddress?: string;
      tokenId?: string;
      balance?: string;
    }>;
  } | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'x-client-id': clientId,
          accept: 'application/json',
        },
      });
      if (!response.ok) {
        continue;
      }
      payload = (await response.json()) as {
        data?: Array<{
          collectionAddress?: string;
          tokenId?: string;
          balance?: string;
        }>;
      };
      break;
    } catch {
      // try next URL pattern
    }
  }

  if (!payload) {
    console.warn(
      '[TmListPanel] Insight fallback unavailable, returning empty owned NFT list'
    );
    return [];
  }

  const normalizedContractLower = normalizedContract.toLowerCase();

  return (payload.data || [])
    .filter((entry) => {
      if (!normalizedContractLower) return true;
      return (
        String(entry.collectionAddress || '').toLowerCase() ===
        normalizedContractLower
      );
    })
    .filter((entry) => BigInt(String(entry.balance || '0')) > 0n)
    .map((entry) => ({ id: BigInt(String(entry.tokenId || '0')) }));
}

function tokenIdToDecimalString(tokenId: unknown): string {
  if (typeof tokenId === 'bigint') return tokenId.toString();
  const raw = String(tokenId ?? '').trim();
  if (!raw) return '';
  try {
    if (raw.startsWith('0x') || raw.startsWith('0X')) {
      return BigInt(raw).toString(10);
    }
    if (/^\d+$/.test(raw)) return raw;
    return BigInt(raw).toString(10);
  } catch {
    return raw;
  }
}

function sameTokenId(left: unknown, right: unknown): boolean {
  try {
    return BigInt(String(left)) === BigInt(String(right));
  } catch {
    return String(left) === String(right);
  }
}

async function fetchMetadataByTokenId(
  tokenId: unknown
): Promise<Pokedex | null> {
  try {
    const decimalTokenId = tokenIdToDecimalString(tokenId);
    if (!decimalTokenId) return null;
    const response = await api.get<{ content: Pokedex }>(
      `/metadata/${decimalTokenId}`
    );
    return response.data.content;
  } catch {
    return null;
  }
}

function fairFoodUrl(tokenId: bigint) {
  return `${packageUrl}?tokenId=${tokenId}`;
}

function extractStringValues(obj: unknown): string[] {
  const values: string[] = [];

  function traverse(val: unknown) {
    if (typeof val === 'string') {
      values.push(val);
    } else if (Array.isArray(val)) {
      val.forEach(traverse);
    } else if (val && typeof val === 'object') {
      Object.values(val).forEach(traverse);
    }
  }

  traverse(obj);
  return values;
}

const listRequest = useAsyncState<NftWithMetadata[]>(async () => {
  if (!account.value) {
    throw new Error('Connect wallet to view owned NFTs');
  }

  let resolvedNftContractAddress = nftContractAddress;
  if (!resolvedNftContractAddress && useListingsStore().listings.length > 0) {
    const first = useListingsStore().listings[0] as any;
    resolvedNftContractAddress = String(
      first?.assetContractAddress || ''
    ).trim();
  }

  let ownedNfts: OwnedNftLite[] = [];
  if (resolvedNftContractAddress) {
    const contract = getContract({
      address: resolvedNftContractAddress,
      chain: accountStore.chain,
      client: accountStore.client,
    });

    try {
      ownedNfts = await getOwnedNFTs({
        contract,
        owner: account.value.address,
      });
    } catch (err: any) {
      console.warn('[TmListPanel] Primary owned-NFT lookup failed', err);
      ownedNfts = await getOwnedNftsFallback(
        account.value.address,
        resolvedNftContractAddress
      );
    }
  } else {
    // Last-resort mode for builds where NFT_CONTRACT is not exposed.
    ownedNfts = await getOwnedNftsFallback(account.value.address);
  }

  // Fetch metadata for each NFT
  const nftsWithMetadata = await Promise.all(
    ownedNfts.map(async (nft) => {
      try {
        const metadata = await fetchMetadataByTokenId(nft.id);
        if (!metadata) {
          throw new Error(`metadata missing for token ${String(nft.id)}`);
        }
        const stringValues = extractStringValues(metadata).join(', ');

        return {
          tokenId: nft.id,
          blockNumber: nft.blockNumber || 0n,
          metadata,
          stringValues,
        };
      } catch (error) {
        console.error(`Failed to fetch metadata for token ${nft.id}:`, error);
        return {
          tokenId: nft.id,
          blockNumber: nft.blockNumber || 0n,
          metadata: null,
          stringValues: '',
        };
      }
    })
  );

  return nftsWithMetadata;
}, []);

const swarmApiUrl = process.env.SWARM_API_URL;
const feedTopics = [
  { label: 'Instance Feed', topic: 'tm-editor-instance', icon: 'inventory_2' },
  {
    label: 'Tool Feed',
    topic: 'tm-editor-machine',
    icon: 'precision_manufacturing',
  },
  { label: 'Know-How Feed', topic: 'tm-editor-knowHow', icon: 'menu_book' },
];

type FeedLatest = {
  label: string;
  topic: string;
  icon: string;
  manifestRef: string | null;
  items: any[];
  error?: string;
  latest: string | null; // Keep for fallback or debug
};
defineEmits(['load-entry', 'share']);

const feedRequest = useAsyncState<FeedLatest[]>(async () => {
  if (!account.value) {
    return [];
  }
  if (!swarmApiUrl) {
    throw new Error('SWARM_API_URL is not configured');
  }

  const swarmAuth = process.env.SWARM_AUTH as string | undefined;
  const bee = new Bee(swarmApiUrl, swarmAuth ? { headers: { Authorization: swarmAuth } } : undefined);
  const owner = account.value.address;

  const results = await Promise.all(
    feedTopics.map(async (topicInfo) => {
      const key = `swarm:feed:${owner}:${topicInfo.topic}`;
      const manifestRef = window.localStorage.getItem(key);
      if (!manifestRef) {
        return {
          label: topicInfo.label,
          topic: topicInfo.topic,
          icon: topicInfo.icon,
          manifestRef: null,
          latest: null,
        } as FeedLatest;
      }
      try {
        const topic = bee.makeFeedTopic(topicInfo.topic);
        let feedUpdate;
        try {
          const reader = bee.makeFeedReader('sequence', topic, owner);
          feedUpdate = await reader.download();
        } catch (err: any) {
          // If we can't download the feed update (e.g. 404), maybe try just using manifestRef if it looks like a hash?
          // But actually manifestRef is just the feed manifest.
          // If reader fails, we likely have no updates.
          throw err;
        }

        let parsed;
        if (feedUpdate.reference) {
          // feedUpdate.reference is a Reference (hex string)
          const data = await bee.downloadData(feedUpdate.reference);
          const text = new TextDecoder().decode(data);
          parsed = JSON.parse(text);
        } else {
          // If reference is missing, the data is embedded in the feed update.
          // CAUTION: bee-js spreads the response.data into the return object.
          // If response.data was an Array, it becomes { "0": item0, "1": item1... }
          if (feedUpdate[0] !== undefined) {
            const arr = [];
            let i = 0;
            while (feedUpdate[i] !== undefined) {
              arr.push(feedUpdate[i]);
              i++;
            }
            parsed = arr;
          } else {
            parsed = feedUpdate; // Fallback for single object or empty
          }
        }

        // Filter out bee-js headers if parsed ended up being the object to be safe?
        // Actually, if it was an array, we reconstructed it cleanly.
        // If it was an object, we rely on Array.isArray check below.

        const items = Array.isArray(parsed) ? parsed : [];
        // No sort needed if we just display them, but newest first is good.
        // Assuming feed is append-only, but verify if items have timestamps.
        const sortedItems = items.slice().sort((a: any, b: any) => {
          const aTime = Date.parse(a?.updatedAt || '') || 0;
          const bTime = Date.parse(b?.updatedAt || '') || 0;
          return bTime - aTime;
        });

        const latestEntry = sortedItems[0];

        return {
          label: topicInfo.label,
          topic: topicInfo.topic,
          icon: topicInfo.icon,
          manifestRef,
          items: sortedItems,
          latest: latestEntry ? JSON.stringify(latestEntry, null, 2) : null,
        } as FeedLatest;
      } catch (error: unknown) {
        return {
          label: topicInfo.label,
          topic: topicInfo.topic,
          icon: topicInfo.icon,
          manifestRef,
          items: [],
          latest: null,
          error: error instanceof Error ? error.message : String(error),
        } as FeedLatest;
      }
    })
  );

  return results;
}, []);

const feedLatest = computed(() => feedRequest.state.value || []);

// Listings logic moved to bottom
// const listingsRequest = ...

function getEntryValues(valueObj: any): string {
  if (!valueObj || typeof valueObj !== 'object') return String(valueObj);
  return Object.values(valueObj)
    .filter((v) => v !== null && v !== undefined && typeof v !== 'object') // simple scalar values
    .join(', ');
}

function getInstancePrice(metadata: Pokedex | null) {
  const instance = (metadata as any)?.instance;
  return (instance?.price || null) as {
    amount?: number | string;
    currency?: string;
    type?: string;
  } | null;
}

function hasValidListingPrice(metadata: Pokedex | null): boolean {
  const price = getInstancePrice(metadata);
  if (!price) return false;
  const amount = Number(price.amount);
  const currency = String(price.currency || '').trim();
  return (
    Number.isFinite(amount) &&
    amount >= 0 &&
    /^0x[a-fA-F0-9]{40}$/.test(currency)
  );
}

async function openPriceDialog(
  tokenId: bigint,
  metadata: Pokedex | null,
  autoList = false,
  currentListingId: bigint | null = null
) {
  let resolvedMetadata = metadata;
  if (!resolvedMetadata) {
    resolvedMetadata = await fetchMetadataByTokenId(tokenId);
    if (resolvedMetadata) {
      const target = (listRequest.state.value || []).find((item) =>
        sameTokenId(item.tokenId, tokenId)
      );
      if (target) {
        target.metadata = resolvedMetadata;
        target.stringValues = extractStringValues(resolvedMetadata).join(', ');
      }
    }
  }

  if (!resolvedMetadata) {
    $q.notify({
      message: 'Cannot edit price: metadata not loaded',
      color: 'negative',
    });
    return;
  }

  const current = getInstancePrice(resolvedMetadata);
  const amount = Number(current?.amount);
  priceDraft.value = {
    amount: Number.isFinite(amount) ? amount : 0,
    currency: String(current?.currency || DEFAULT_CURRENCY),
    type: String(current?.type || 'is'),
  };
  priceDialogTokenId.value = tokenId;
  priceDialogMetadata.value = resolvedMetadata;
  listAfterPriceSave.value = autoList;
  priceDialogCurrentListingId.value = currentListingId ?? null;
  priceDialogOpen.value = true;
}

function applyPriceDraft() {
  const metadata = priceDialogMetadata.value;
  if (!metadata) return;
  const instance =
    (metadata as any).instance || ((metadata as any).instance = {});
  instance.price = {
    amount: Number(priceDraft.value.amount),
    currency: String(priceDraft.value.currency || DEFAULT_CURRENCY),
    type: String(priceDraft.value.type || 'is'),
  };
}

function savePriceDialog() {
  applyPriceDraft();
  const metadata = priceDialogMetadata.value;
  const tokenId = priceDialogTokenId.value;
  const shouldList = listAfterPriceSave.value;
  const existingListingId = priceDialogCurrentListingId.value;
  priceDialogOpen.value = false;
  listAfterPriceSave.value = false;
  priceDialogCurrentListingId.value = null;

  if (tokenId === null || !metadata) return;

  if (existingListingId !== null) {
    // Already listed — cancel the old listing then immediately relist with new price
    $q.dialog({
      component: CancelListingDialog,
      componentProps: { tokenId, listingId: existingListingId },
    }).onOk(() => {
      createListing(tokenId, metadata);
    });
  } else if (shouldList) {
    createListing(tokenId, metadata);
  }
}

// Listings logic moved to bottom
const listingsRequest = useAsyncState(async () => {
  if (!marketplaceContractAddress) {
    throw new Error('MARKETPLACE_CONTRACT is not configured');
  }
  const contract = getContract({
    address: marketplaceContractAddress,
    chain: accountStore.chain,
    client: accountStore.client,
  });

  const total = await totalListings({ contract });

  if (total) {
    const allListings = await getAllListings({
      contract,
      start: 0,
      count: total,
    });

    const active = allListings.filter((listing) => listing.status === 'ACTIVE');
    if (nftContractAddress) {
      useListingsStore().setAll(
        active.filter(
          (listing) =>
            listing.assetContractAddress.toLowerCase() ===
            nftContractAddress.toLowerCase()
        )
      );
    } else {
      useListingsStore().setAll(active);
    }
  }
}, undefined);

function getInstanceCandidate(metadata: Pokedex | null): unknown {
  if (!metadata || typeof metadata !== 'object') return null;
  return (metadata as any).instance ?? null;
}

function isMachineInstance(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    'providerSDomain' in (value as any) &&
    'hr' in (value as any)
  );
}

function isKnowHow(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    'hash' in (value as any) &&
    'inputs' in (value as any) &&
    'outputs' in (value as any)
  );
}

function getFeedItems(topic: string) {
  const feed = feedLatest.value.find((f) => f.topic === topic);
  return feed?.items || [];
}

const sortedNfts = computed(() => {
  const nfts = listRequest.state.value || [];
  const listings = useListingsStore().listings;

  // Add listing info to each NFT
  const nftsWithListings = nfts.map((nft) => ({
    ...nft,
    listing: listings.find((listing) => listing.tokenId === nft.tokenId),
  }));

  // Sort descending by block number (fallback to tokenId)
  return nftsWithListings.sort((a, b) => {
    const bnA = a.blockNumber ?? 0n;
    const bnB = b.blockNumber ?? 0n;
    if (bnA === bnB) {
      return a.tokenId < b.tokenId ? 1 : -1;
    }
    return bnA < bnB ? 1 : -1;
  });
});

const machineNfts = computed(() => {
  return sortedNfts.value.filter((item) => {
    const instance = getInstanceCandidate(item.metadata);
    return isMachineInstance(instance);
  });
});

const knowHowNfts = computed(() => {
  return sortedNfts.value.filter((item) => {
    const instance = getInstanceCandidate(item.metadata);
    return isKnowHow(instance);
  });
});

const instanceNfts = computed(() => {
  return sortedNfts.value.filter((item) => {
    const instance = getInstanceCandidate(item.metadata);
    return !isMachineInstance(instance) && !isKnowHow(instance);
  });
});

async function createListing(tokenId: bigint, metadata: Pokedex | null) {
  let resolvedMetadata = metadata;
  if (!resolvedMetadata) {
    resolvedMetadata = await fetchMetadataByTokenId(tokenId);
    if (resolvedMetadata) {
      const target = (listRequest.state.value || []).find((item) =>
        sameTokenId(item.tokenId, tokenId)
      );
      if (target) {
        target.metadata = resolvedMetadata;
        target.stringValues = extractStringValues(resolvedMetadata).join(', ');
      }
    }
  }

  if (!resolvedMetadata) {
    $q.notify({
      message: 'Cannot create listing: metadata not loaded',
      color: 'negative',
    });
    return;
  }

  if (!hasValidListingPrice(resolvedMetadata)) {
    void openPriceDialog(tokenId, resolvedMetadata, true);
    return;
  }

  $q.dialog({
    component: CreateListingDialog,
    componentProps: {
      tokenId,
      metadata: resolvedMetadata,
    },
  }).onOk(() => {
    reload();
  });
}

function cancelListing(tokenId: bigint, listingId: bigint) {
  $q.dialog({
    component: CancelListingDialog,
    componentProps: {
      tokenId,
      listingId,
    },
  }).onOk(() => {
    reload();
  });
}

function reload() {
  listRequest.execute();
  listingsRequest.execute();
  feedRequest.execute();
}
</script>

<style scoped>
.feed-json {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  color: #cfd8dc;
  margin: 0;
}
</style>
