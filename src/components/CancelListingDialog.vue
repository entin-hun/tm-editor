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
          v-if="cancelListingTx.isLoading.value"
          color="primary"
          size="3em"
        />
        <q-icon
          size="3em"
          name="done"
          color="green"
          v-else-if="cancelListingTx.isReady.value"
        />
        <q-icon
          size="3em"
          name="error_outline"
          color="red"
          v-else-if="cancelListingTx.error.value"
        />
        <div class="q-pl-sm">Canceling listing on Marketplace</div>
        <q-btn
          :disable="
            cancelListingTx.state.value === undefined &&
            cancelListingTx.error.value === undefined
          "
          round
          flat
          size="10px"
          icon="content_copy"
          @click="
            copyToClipboard(
              cancelListingTx.state.value! || cancelListingTx.error.value!
            )
          "
          class="q-mx-xs"
        >
          <q-tooltip
            v-if="
              cancelListingTx.isReady.value &&
              cancelListingTx.state.value !== undefined
            "
            >{{ cancelListingTx.state.value }}</q-tooltip
          >
          <q-tooltip v-if="cancelListingTx.error.value"
            >Transaction failed: {{ cancelListingTx.error.value }}</q-tooltip
          >
        </q-btn>
      </q-card-section>

      <q-card-section class="row no-wrap items-center">
        <q-spinner v-if="revokeTx.isLoading.value" color="primary" size="3em" />
        <q-icon
          size="3em"
          name="done"
          color="green"
          v-else-if="revokeTx.isReady.value"
        />
        <q-icon
          size="3em"
          name="error_outline"
          color="red"
          v-else-if="revokeTx.error.value"
        />
        <q-icon
          v-else-if="cancelListingTx.error.value"
          size="3em"
          name="close"
          color="grey"
        />
        <q-icon v-else size="3em" />
        <div class="q-pl-sm">Disapproving transfer of NFT by Marketplace</div>
        <q-btn
          :disable="
            revokeTx.state.value === undefined &&
            revokeTx.error.value === undefined
          "
          round
          flat
          size="10px"
          icon="content_copy"
          @click="
            copyToClipboard(revokeTx.state.value! || revokeTx.error.value!)
          "
          class="q-mx-xs"
        >
          <q-tooltip
            v-if="revokeTx.isReady.value && revokeTx.state.value !== undefined"
            >{{ revokeTx.state.value }}</q-tooltip
          >
          <q-tooltip
            v-if="revokeTx.isReady.value && revokeTx.state.value !== undefined"
            >{{ revokeTx.state.value }}</q-tooltip
          >
          <q-tooltip v-if="revokeTx.error.value"
            >Transaction failed: {{ revokeTx.error.value }}</q-tooltip
          >
        </q-btn>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="primary" label="Close" @click="onDialogHide" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import assert from 'assert';
import { useDialogPluginComponent, copyToClipboard } from 'quasar';
import { useAccountStore } from 'src/stores/account';
import { getContract, Hex, ZERO_ADDRESS, sendAndConfirmTransaction } from 'thirdweb';
import { useAsyncState } from '@vueuse/core';
import { computed, onMounted, ref } from 'vue';
import { cancelListing } from 'thirdweb/extensions/marketplace';
import { approve } from 'thirdweb/extensions/erc721';
import { createWallet } from 'thirdweb/wallets';

const accountStore = useAccountStore();

const props = defineProps<{ tokenId: bigint; listingId: bigint }>();

defineEmits(useDialogPluginComponent.emits);

const { dialogRef, onDialogHide, onDialogOk } = useDialogPluginComponent();
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

const marketplaceContract = getContract({
  client: accountStore.client,
  chain: accountStore.chain,
  address: marketplaceAddress,
});

const nftContract = getContract({
  client: accountStore.client,
  chain: accountStore.chain,
  address: nftAddress,
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
    const reconnected = await accountStore.wallet.connect({
      client: accountStore.client,
      chain: accountStore.chain,
    } as any);
    const reconnectedAddress = String(reconnected?.address || '').toLowerCase();
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
  } else if (!accountStore.account) {
    if (!accountStore.wallet) {
      accountStore.wallet = createWallet('io.metamask');
    }
    accountStore.account = await accountStore.wallet.connect({
      client: accountStore.client,
      chain: accountStore.chain,
    } as any);
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

const cancelListingTx = useAsyncState<Hex | undefined>(async () => {
  await ensureConnectedWallet();
  if (needsNetworkSwitch.value) {
    throw new Error(
      `Wrong network. Switch wallet to chain ${accountStore.chain.id}.`
    );
  }
  if (accountStore.account === undefined) throw new Error('Account undefined');

  const transaction = cancelListing({
    contract: marketplaceContract,
    listingId: props.listingId,
  });

  const { transactionHash } = await sendAndConfirmTransaction({
    transaction,
    account: accountStore.account,
  });
  revokeTx.execute();
  return transactionHash;
}, undefined);

const revokeTx = useAsyncState<Hex | undefined>(
  async () => {
    if (needsNetworkSwitch.value) {
      throw new Error(
        `Wrong network. Switch wallet to chain ${accountStore.chain.id}.`
      );
    }
    const transaction = approve({
      contract: nftContract,
      tokenId: props.tokenId,
      to: ZERO_ADDRESS,
    });

    assert(accountStore.account !== undefined);
    const { transactionHash } = await sendAndConfirmTransaction({
      transaction,
      account: accountStore.account,
    });
    onDialogOk();
    return transactionHash;
  },
  undefined,
  { immediate: false }
);

onMounted(() => {
  cancelListingTx.execute();
});
</script>
