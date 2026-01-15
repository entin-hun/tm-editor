<template>
  <div class="fit">
    <q-page-sticky :offset="[24, 24]">
      <q-btn fab icon="refresh" @click="reload" />
    </q-page-sticky>

    <div v-if="listRequest.isLoading.value" class="fixed-center">
      <div class="column content-center items-center">
        <q-spinner size="4em" />
        <div class="q-py-md">Fetching NFTs</div>
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
    <div v-else class="row">
      <q-card
        v-for="item in sortedNfts"
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

// Fetch marketplace listings
const listingsRequest = useAsyncState(async () => {
  if (!process.env.MARKETPLACE_CONTRACT) {
    return;
  }

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
}
</script>
