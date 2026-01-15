<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white" style="display: none">
      <q-toolbar>
        <q-toolbar-title> Supply Chain NFT Editor </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core';
import { useAccountStore } from 'src/stores/account';
import { copyToClipboard } from 'quasar';

defineOptions({
  name: 'MainLayout',
});

const accountStore = useAccountStore();

const walletDisconnect = useAsyncState(
  () => {
    return (
      accountStore.wallet
        ?.disconnect()
        .then(() => (accountStore.account = undefined)) || Promise.resolve()
    );
  },
  undefined,
  { immediate: false }
);
</script>
