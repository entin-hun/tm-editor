<template>
  <div class="fit">
    <q-page-sticky :offset="[24, 24]">
      <q-btn fab icon="refresh" @click="reload" />
    </q-page-sticky>

    <div v-if="listRequest.isLoading.value || feedRequest.isLoading.value" class="fixed-center">
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
      <div v-if="feedRequest.error.value" class="q-pa-md text-negative bg-red-1 rounded-borders">
        <q-icon name="warning" class="q-mr-sm" />
        Feed Error: {{ feedRequest.error.value }}
      </div>

      <q-expansion-item
        label="Instances"
        icon="inventory_2"
        default-opened
      >
        <div v-if="getFeedItems('tm-editor-instance').length" class="row">
           <q-card v-for="(entry, idx) in getFeedItems('tm-editor-instance')" :key="'feed-inst-'+idx" flat bordered class="q-ma-sm col-12" style="width: 100%">
              <q-card-section>
                 <div class="row items-center justify-between">
                   <div class="text-caption text-grey-8">
                     <q-icon name="rss_feed" size="xs" class="q-mr-xs" />
                     {{ entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : 'Unknown' }}
                   </div>
                   <div class="row q-gutter-xs">
                     <q-btn icon="edit" flat round dense color="primary" @click="$emit('load-entry', entry)">
                       <q-tooltip>Load</q-tooltip>
                     </q-btn>
                     <q-btn icon="share" flat round dense color="secondary" @click="$emit('share', entry)">
                       <q-tooltip>Share</q-tooltip>
                     </q-btn>
                   </div>
                 </div>
                 <div class="q-mt-sm text-body2" style="word-break: break-word;">
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
                <div v-if="account !== undefined">
                  <q-btn
                    v-if="item.listing !== undefined"
                    fab-mini
                    @click="cancelListing(item.tokenId, item.listing.id)"
                    icon="close"
                    dense
                    color="negative"
                  />
                  <q-btn
                    v-else
                    fab-mini
                    @click="createListing(item.tokenId, item.metadata)"
                    icon="sell"
                    dense
                    color="primary"
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
        <div v-if="!instanceNfts.length && !getFeedItems('tm-editor-instance').length" class="q-pa-md text-caption text-grey-6">
          No instance items found.
        </div>
      </q-expansion-item>

      <q-expansion-item label="Tools" icon="precision_manufacturing" default-opened>
        <div v-if="getFeedItems('tm-editor-machine').length" class="row">
           <q-card v-for="(entry, idx) in getFeedItems('tm-editor-machine')" :key="'feed-machine-'+idx" flat bordered class="q-ma-sm col-12" style="width: 100%">
              <q-card-section>
                 <div class="row items-center justify-between">
                   <div class="text-caption text-grey-8">
                     <q-icon name="rss_feed" size="xs" class="q-mr-xs" />
                     {{ entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : 'Unknown' }}
                   </div>
                   <div class="row q-gutter-xs">
                     <q-btn icon="edit" flat round dense color="primary" @click="$emit('load-entry', entry)">
                       <q-tooltip>Load</q-tooltip>
                     </q-btn>
                     <q-btn icon="share" flat round dense color="secondary" @click="$emit('share', entry)">
                       <q-tooltip>Share</q-tooltip>
                     </q-btn>
                   </div>
                 </div>
                 <div class="q-mt-sm text-body2" style="word-break: break-word;">
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
                <div v-if="account !== undefined">
                  <q-btn
                    v-if="item.listing !== undefined"
                    fab-mini
                    @click="cancelListing(item.tokenId, item.listing.id)"
                    icon="close"
                    dense
                    color="negative"
                  />
                  <q-btn
                    v-else
                    fab-mini
                    @click="createListing(item.tokenId, item.metadata)"
                    icon="sell"
                    dense
                    color="primary"
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
        <div v-if="!machineNfts.length && !getFeedItems('tm-editor-machine').length" class="q-pa-md text-caption text-grey-6">
          No tool items found.
        </div>
      </q-expansion-item>

      <q-expansion-item label="Know-How" icon="menu_book" default-opened>
        <div v-if="getFeedItems('tm-editor-knowHow').length" class="row">
           <q-card v-for="(entry, idx) in getFeedItems('tm-editor-knowHow')" :key="'feed-kh-'+idx" flat bordered class="q-ma-sm col-12" style="width: 100%">
              <q-card-section>
                 <div class="row items-center justify-between">
                   <div class="text-caption text-grey-8">
                     <q-icon name="rss_feed" size="xs" class="q-mr-xs" />
                     {{ entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : 'Unknown' }}
                   </div>
                   <div class="row q-gutter-xs">
                     <q-btn icon="edit" flat round dense color="primary" @click="$emit('load-entry', entry)">
                       <q-tooltip>Load</q-tooltip>
                     </q-btn>
                     <q-btn icon="share" flat round dense color="secondary" @click="$emit('share', entry)">
                       <q-tooltip>Share</q-tooltip>
                     </q-btn>
                   </div>
                 </div>
                 <div class="q-mt-sm text-body2" style="word-break: break-word;">
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
                <div v-if="account !== undefined">
                  <q-btn
                    v-if="item.listing !== undefined"
                    fab-mini
                    @click="cancelListing(item.tokenId, item.listing.id)"
                    icon="close"
                    dense
                    color="negative"
                  />
                  <q-btn
                    v-else
                    fab-mini
                    @click="createListing(item.tokenId, item.metadata)"
                    icon="sell"
                    dense
                    color="primary"
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
        <div v-if="!knowHowNfts.length && !getFeedItems('tm-editor-knowHow').length" class="q-pa-md text-caption text-grey-6">
          No know-how items found.
        </div>
      </q-expansion-item>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core';
import { getOwnedNFTs } from 'thirdweb/extensions/erc721';
import { getContract } from 'thirdweb';
import { useAccountStore } from 'src/stores/account';
import { copyToClipboard, useQuasar } from 'quasar';
import { computed } from 'vue';
import { api } from 'src/boot/axios';
import { Pokedex } from '@trace.market/types';
import { useListingsStore } from 'src/stores/listings';
import { getAllListings, totalListings } from 'thirdweb/extensions/marketplace';
import CreateListingDialog from './CreateListingDialog.vue';
import CancelListingDialog from './CancelListingDialog.vue';
import { getColonyNetworkClient, Network } from '@colony/colony-js';
import { providers } from 'ethers';

function getBeeCtor() {
  const beeJs = (window as any).BeeJs as
    | { Bee: new (url: string, options?: unknown) => any }
    | undefined;
  if (!beeJs?.Bee) {
    throw new Error('BeeJs is not available. Reload after BeeJS boot completes.');
  }
  return beeJs.Bee;
}

const { chain, client, account } = useAccountStore();
const $q = useQuasar();

interface NftWithMetadata {
  tokenId: bigint;
  blockNumber: bigint;
  metadata: Pokedex | null;
  stringValues: string;
}

function fairFoodUrl(tokenId: bigint) {
  return `${process.env.PACKAGE_URL}?tokenId=${tokenId}`;
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
  if (!process.env.NFT_CONTRACT) {
    throw new Error('NFT_CONTRACT is not configured');
  }
  if (!account) {
    throw new Error('Connect wallet to view owned NFTs');
  }

  const contract = getContract({
    address: process.env.NFT_CONTRACT,
    chain,
    client,
  });

  const ownedNfts = await getOwnedNFTs({
    contract,
    owner: account.address,
  });

  // Fetch metadata for each NFT
  const nftsWithMetadata = await Promise.all(
    ownedNfts.map(async (nft) => {
      try {
        const response = await api.get<{ content: Pokedex }>(
          `/metadata/${nft.id}`
        );
        const metadata = response.data.content;
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
  { label: 'Tool Feed', topic: 'tm-editor-machine', icon: 'precision_manufacturing' },
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
  if (!account) {
    return [];
  }
  if (!swarmApiUrl) {
    throw new Error('SWARM_API_URL is not configured');
  }

  const Bee = getBeeCtor();
  const bee = new Bee(swarmApiUrl);
  const owner = account.address;

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
             while(feedUpdate[i] !== undefined) {
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
        const sortedItems = items
          .slice()
          .sort((a: any, b: any) => {
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
    .filter(v => v !== null && v !== undefined && typeof v !== 'object') // simple scalar values
    .join(', ');
}

// Listings logic moved to bottom
const listingsRequest = useAsyncState(async () => {

  const contract = getContract({
    address: process.env.MARKETPLACE_CONTRACT,
    chain,
    client,
  });

  const total = await totalListings({ contract });

  if (total) {
    const allListings = await getAllListings({
      contract,
      start: 0,
      count: total,
    });

    useListingsStore().setAll(
      allListings.filter(
        (listing) =>
          listing.assetContractAddress === process.env.NFT_CONTRACT &&
          listing.status === 'ACTIVE'
      )
    );
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

function createListing(tokenId: bigint, metadata: Pokedex | null) {
  if (!metadata) {
    $q.notify({
      message: 'Cannot create listing: metadata not loaded',
      color: 'negative',
    });
    return;
  }

  $q.dialog({
    component: CreateListingDialog,
    componentProps: {
      tokenId,
      metadata,
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
