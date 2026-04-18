<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-pa-sm">
      <q-card-section
        v-if="needsNetworkSwitch"
        class="row items-center q-gutter-sm"
      >
        <q-icon name="warning" color="orange" size="1.5em" />
        <div class="col">
          Wrong network. Please switch wallet to chain
          {{ accountStore.chain.id }}.
        </div>
        <q-btn
          color="primary"
          label="Switch Network"
          @click="switchToTargetChain"
        />
      </q-card-section>

      <q-card-section class="row no-wrap items-center">
        <q-spinner
          v-if="approveTx.isLoading.value"
          color="primary"
          size="3em"
        />
        <q-icon
          size="3em"
          name="done"
          color="green"
          v-else-if="approveTx.isReady.value"
        />
        <q-icon
          size="3em"
          name="error_outline"
          color="red"
          v-else-if="approveTx.error.value"
        />
        <div class="q-pl-sm">Approving transfer of NFT by Marketplace</div>
        <q-btn
          :disable="
            approveTx.state.value === undefined &&
            approveTx.error.value === undefined
          "
          round
          flat
          size="10px"
          icon="content_copy"
          @click="
            copyToClipboard(approveTx.state.value! || approveTx.error.value!)
          "
          class="q-mx-xs"
        >
          <q-tooltip
            v-if="
              approveTx.isReady.value && approveTx.state.value !== undefined
            "
            >{{ approveTx.state.value }}</q-tooltip
          >
          <q-tooltip v-if="approveTx.error.value"
            >Transaction failed: {{ approveTx.error.value }}</q-tooltip
          >
        </q-btn>
      </q-card-section>

      <q-card-section class="row no-wrap items-center">
        <q-spinner
          v-if="createListingTx.isLoading.value"
          color="primary"
          size="3em"
        />
        <q-icon
          size="3em"
          name="done"
          color="green"
          v-else-if="createListingTx.isReady.value"
        />
        <q-icon
          size="3em"
          name="error_outline"
          color="red"
          v-else-if="createListingTx.error.value"
        />
        <q-icon
          v-else-if="approveTx.error.value"
          size="3em"
          name="close"
          color="grey"
        />
        <q-icon v-else size="3em" />
        <div class="q-pl-sm">Creating listing on Marketplace</div>
        <q-btn
          :disable="
            createListingTx.state.value === undefined &&
            createListingTx.error.value === undefined
          "
          round
          flat
          size="10px"
          icon="content_copy"
          @click="
            copyToClipboard(
              createListingTx.state.value! || createListingTx.error.value!
            )
          "
          class="q-mx-xs"
        >
          <q-tooltip
            v-if="
              createListingTx.isReady.value &&
              createListingTx.state.value !== undefined
            "
            >{{ createListingTx.state.value }}</q-tooltip
          >
          <q-tooltip
            v-if="
              createListingTx.isReady.value &&
              createListingTx.state.value !== undefined
            "
            >{{ createListingTx.state.value }}</q-tooltip
          >
          <q-tooltip v-if="createListingTx.error.value"
            >Transaction failed: {{ createListingTx.error.value }}</q-tooltip
          >
        </q-btn>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="primary" label="Close" @click="onDialogHide" />
      </q-card-actions>
      <q-card-section
        v-if="approveTx.error.value || createListingTx.error.value"
        class="text-negative text-caption"
      >
        {{ String(approveTx.error.value || createListingTx.error.value) }}
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import assert from 'assert';
import { computed, onMounted, ref } from 'vue';
import { useDialogPluginComponent, copyToClipboard } from 'quasar';
import { useAccountStore } from 'src/stores/account';
import {
  getContract,
  Hex,
  sendAndConfirmTransaction,
  sendTransaction,
} from 'thirdweb';
import { Pokedex } from '@trace.market/types';
import { useAsyncState } from '@vueuse/core';
import { approve, ownerOf } from 'thirdweb/extensions/erc721';
import { createListing } from 'thirdweb/extensions/marketplace';
import { createWallet } from 'thirdweb/wallets';

const accountStore = useAccountStore();

const props = defineProps<{ tokenId: bigint; metadata: Pokedex }>();

defineEmits(useDialogPluginComponent.emits);

const { dialogRef, onDialogHide } = useDialogPluginComponent();
const needsNetworkSwitch = ref(false);
const targetChainHex = computed(
  () => `0x${accountStore.chain.id.toString(16)}`
);

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
const marketplaceAddress = pickEnv(
  'VITE_MARKETPLACE_CONTRACT',
  'VITE_NEXT_PUBLIC_MARKETPLACE_CONTRACT',
  'NEXT_PUBLIC_MARKETPLACE_CONTRACT',
  'MARKETPLACE_CONTRACT'
);
const nftAddress = pickEnv(
  'VITE_NFT_CONTRACT',
  'VITE_NEXT_PUBLIC_NFT_CONTRACT',
  'NEXT_PUBLIC_NFT_CONTRACT',
  'NFT_CONTRACT'
);
const isAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const marketplaceContract = getContract({
  client: accountStore.client,
  chain: accountStore.chain,
  address: marketplaceAddress as string,
});

const nftContract = getContract({
  client: accountStore.client,
  chain: accountStore.chain,
  address: nftAddress as string,
});

const ensureConnectedWallet = async () => {
  const ethereum = (window as any)?.ethereum;
  const hasTxCapability = (account: any) =>
    !!account && typeof account.sendTransaction === 'function';
  const connectedAddress = String(
    accountStore.account?.address || ''
  ).toLowerCase();

  const candidateProviders = Array.isArray(ethereum?.providers)
    ? [ethereum, ...ethereum.providers]
    : ethereum
    ? [ethereum]
    : [];
  const uniqueProviders = candidateProviders.filter(
    (provider: any, index: number, arr: any[]) =>
      provider?.request && arr.indexOf(provider) === index
  );

  let provider = uniqueProviders[0];
  for (const candidate of uniqueProviders) {
    try {
      const accounts = ((await candidate.request({
        method: 'eth_accounts',
      })) || []) as string[];
      if (
        connectedAddress &&
        accounts.some(
          (address) => String(address).toLowerCase() === connectedAddress
        )
      ) {
        provider = candidate;
        break;
      }
    } catch {
      // try the next injected provider
    }
  }

  if (!provider?.request) {
    if (!accountStore.account) {
      throw new Error('No wallet connected. Connect wallet first.');
    }
    if (!hasTxCapability(accountStore.account)) {
      throw new Error(
        'Connected account cannot sign transactions. Reconnect wallet with MetaMask.'
      );
    }
    needsNetworkSwitch.value = false;
    return;
  }

  const mustReconnect = !hasTxCapability(accountStore.account);

  if (accountStore.account && mustReconnect) {
    if (!accountStore.wallet) {
      accountStore.wallet = createWallet('io.metamask');
    }
    try {
      const reconnected = await accountStore.wallet.connect({
        client: accountStore.client,
        chain: accountStore.chain,
      } as any);
      const reconnectedAddress = String(
        reconnected?.address || ''
      ).toLowerCase();
      if (
        connectedAddress &&
        reconnectedAddress &&
        reconnectedAddress !== connectedAddress
      ) {
        throw new Error(
          `Wallet signer address (${reconnected.address}) differs from the connected app wallet (${accountStore.account?.address}). Switch the injected wallet/account to match.`
        );
      }
      accountStore.account = reconnected as any;
    } catch (e: any) {
      const message = e?.message || String(e);
      throw new Error(`Wallet reconnection failed: ${message}`);
    }
  } else if (!accountStore.account) {
    if (!accountStore.wallet) {
      accountStore.wallet = createWallet('io.metamask');
    }
    try {
      accountStore.account = await accountStore.wallet.connect({
        client: accountStore.client,
        chain: accountStore.chain,
      } as any);
    } catch (e: any) {
      const message = e?.message || String(e);
      throw new Error(`Wallet connection failed: ${message}`);
    }
  }

  if (!hasTxCapability(accountStore.account)) {
    throw new Error(
      'Connected account cannot sign transactions. Reconnect wallet with MetaMask.'
    );
  }

  const currentHex = (await provider.request({
    method: 'eth_chainId',
  })) as string;
  needsNetworkSwitch.value =
    String(currentHex || '').toLowerCase() !==
    targetChainHex.value.toLowerCase();
};

const switchToTargetChain = async () => {
  const provider = (window as any)?.ethereum;
  if (!provider?.request) return;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainHex.value }],
    });
    needsNetworkSwitch.value = false;
  } catch (err: any) {
    if (err?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: targetChainHex.value,
            chainName: process.env.CHAIN_NAME || 'Gnosis Chiado',
            rpcUrls: [process.env.CHAIN_RPC || 'https://rpc.chiadochain.net'],
            nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
            blockExplorerUrls: ['https://gnosis-chiado.blockscout.com'],
          },
        ],
      });
      needsNetworkSwitch.value = false;
      return;
    }
    throw err;
  }
};

const createListingTx = useAsyncState<Hex | undefined>(
  async () => {
    const instance = props.metadata.instance;
    if (instance.category !== 'food') {
      throw new Error('NFT instance is not a food item');
    }
    const listingPrice = (instance as any)?.price as
      | { amount?: string | number; currency?: string }
      | undefined;

    if (!listingPrice) {
      throw new Error('NFT has no listing price. Set instance.price first.');
    }
    if (listingPrice.amount === undefined || listingPrice.amount === null) {
      throw new Error('NFT listing price has no amount.');
    }
    if (!listingPrice.currency || !String(listingPrice.currency).trim()) {
      throw new Error(
        'NFT listing price has empty currency address. Set instance.price.currency to an ERC20 contract address.'
      );
    }

    const rootExpiryDate = Number((instance as any)?.expiryDate ?? 0);
    const nowMs = Date.now();
    const oneYearMs = 1000 * 60 * 60 * 24 * 365;
    const oneHourMs = 1000 * 60 * 60;
    const expiryMs =
      rootExpiryDate > 0
        ? rootExpiryDate < 1e12
          ? rootExpiryDate * 1000
          : rootExpiryDate
        : 0;

    // Use NFT expiry only if it is in the future; otherwise fall back to a future listing window.
    const endMs = expiryMs > nowMs + oneHourMs ? expiryMs : nowMs + oneYearMs;
    const endTimestamp = new Date(endMs);

    const transaction = createListing({
      contract: marketplaceContract,
      assetContractAddress: nftContract.address,
      tokenId: props.tokenId,
      quantity: 1n,
      currencyContractAddress: String(listingPrice.currency),
      pricePerTokenWei: String(listingPrice.amount),
      endTimestamp,
      isReservedListing: false,
    });
    await ensureConnectedWallet();
    if (needsNetworkSwitch.value) {
      throw new Error(
        `Wrong network. Switch wallet to chain ${accountStore.chain.id}.`
      );
    }
    assert(accountStore.account !== undefined);

    return sendTransaction({
      transaction,
      account: accountStore.account,
    })
      .catch((error) => {
        console.error(error);
        return Promise.reject(error);
      })
      .then(({ transactionHash }) => Promise.resolve(transactionHash));
  },
  undefined,
  { immediate: false }
);

const approveTx = useAsyncState<Hex | undefined>(
  async () => {
    if (!isAddress(marketplaceAddress)) {
      throw new Error(
        `Invalid MARKETPLACE_CONTRACT: ${marketplaceAddress || '<empty>'}`
      );
    }
    if (!isAddress(nftAddress)) {
      throw new Error(`Invalid NFT_CONTRACT: ${nftAddress || '<empty>'}`);
    }
    const transaction = approve({
      contract: nftContract,
      tokenId: props.tokenId,
      to: marketplaceContract.address,
    });

    await ensureConnectedWallet();
    if (needsNetworkSwitch.value) {
      throw new Error(
        `Wrong network. Switch wallet to chain ${accountStore.chain.id}.`
      );
    }
    assert(accountStore.account !== undefined);

    const tokenOwner = await ownerOf({
      contract: nftContract,
      tokenId: props.tokenId,
    });
    if (
      String(tokenOwner).toLowerCase() !==
      String(accountStore.account.address).toLowerCase()
    ) {
      throw new Error(
        `Connected wallet is not token owner (owner: ${tokenOwner}, connected: ${
          accountStore.account.address
        }, tokenId: ${props.tokenId.toString()}).`
      );
    }
    if (
      String(accountStore.account.address || '').toLowerCase() ===
      String(marketplaceContract.address || '').toLowerCase()
    ) {
      throw new Error(
        `Marketplace contract resolves to connected wallet address (${marketplaceContract.address}). Check env keys (MARKETPLACE_CONTRACT/NEXT_PUBLIC_MARKETPLACE_CONTRACT).`
      );
    }

    return sendAndConfirmTransaction({
      transaction,
      account: accountStore.account,
    })
      .catch((error) => Promise.reject(error))
      .then(({ transactionHash }) => {
        createListingTx.execute();
        return Promise.resolve(transactionHash);
      });
  },
  undefined,
  { immediate: false }
);

onMounted(() => {
  approveTx.execute();
});
</script>
