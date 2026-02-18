<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-pa-sm">
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
import { useDialogPluginComponent, copyToClipboard } from 'quasar';
import { useAccountStore } from 'src/stores/account';
import { getContract, Hex, ZERO_ADDRESS } from 'thirdweb';
import { useAsyncState } from '@vueuse/core';
import { onMounted } from 'vue';
import { cancelListing } from 'thirdweb/extensions/marketplace';
import { approve } from 'thirdweb/extensions/erc721';

const accountStore = useAccountStore();

const props = defineProps<{ tokenId: bigint; listingId: bigint }>();

defineEmits(useDialogPluginComponent.emits);

const { dialogRef, onDialogHide } = useDialogPluginComponent();

const marketplaceContract = getContract({
  client: accountStore.client,
  chain: accountStore.chain,
  address: process.env.MARKETPLACE_CONTRACT,
});

const nftContract = getContract({
  client: accountStore.client,
  chain: accountStore.chain,
  address: process.env.NFT_CONTRACT,
});

const cancelListingTx = useAsyncState<Hex | undefined>(async () => {
  if (accountStore.account === undefined) throw new Error('Account undefined');
  if (accountStore.wallet === undefined) throw new Error('Wallet undefined');

  if (accountStore.wallet.getChain()?.id !== accountStore.chain.id)
    await accountStore.wallet.switchChain(accountStore.chain);

  const transaction = cancelListing({
    contract: marketplaceContract,
    listingId: props.listingId,
  });

  const result = await accountStore.wallet.sendTransaction(transaction);
  await result.wait();
  revokeTx.execute();
  return result.transactionHash;
}, undefined);

const revokeTx = useAsyncState<Hex | undefined>(
  async () => {
    const transaction = approve({
      contract: nftContract,
      tokenId: props.tokenId,
      to: ZERO_ADDRESS,
    });

    assert(accountStore.account !== undefined);
    assert(accountStore.wallet !== undefined);

    if (accountStore.wallet.getChain()?.id !== accountStore.chain.id)
      await accountStore.wallet.switchChain(accountStore.chain);

    const result = await accountStore.wallet.sendTransaction(transaction);
    await result.wait();
    return result.transactionHash;
  },
  undefined,
  { immediate: false }
);

onMounted(() => {
  cancelListingTx.execute();
});
</script>
