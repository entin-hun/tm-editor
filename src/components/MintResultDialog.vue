<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-pa-sm">
      <q-card-section>
        <div class="text-h6 text-center">NFT minted successfully</div>
      </q-card-section>
      <q-card-section class="row justify-evenly">
        <q-btn
          fab
          flat
          icon="language"
          @click="openURL(link)"
          color="secondary"
        />
        <q-btn
          fab
          flat
          icon="content_copy"
          @click="copyToClipboard($props.tokenId)"
          color="secondary"
        >
          <q-tooltip>{{ $props.tokenId }}</q-tooltip>
        </q-btn>
        <q-btn
          fab
          flat
          icon="info_outline"
          @click="openURL(packageLink)"
          color="secondary"
        />
      </q-card-section>
      <q-card-actions align="center">
        <q-btn color="primary" label="Close" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent, copyToClipboard, openURL } from 'quasar';

const props = defineProps<{ tokenId: string }>();

const readEnv = (...keys: string[]): string => {
  const ienv = ((typeof import.meta !== 'undefined'
    ? (import.meta as any).env
    : {}) || {}) as Record<string, string | undefined>;
  const penv = ((typeof process !== 'undefined' ? (process as any).env : {}) ||
    {}) as Record<string, string | undefined>;
  for (const key of keys) {
    const value = ienv[key] ?? penv[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const normalizedTokenId = BigInt(props.tokenId).toString();
const nftContract = readEnv(
  'VITE_NFT_CONTRACT',
  'NEXT_PUBLIC_NFT_CONTRACT',
  'NFT_CONTRACT'
);
const explorerTemplate = readEnv('VITE_EXPLORER_URL', 'EXPLORER_URL');

const buildExplorerLink = () => {
  if (!explorerTemplate) return '';
  let url = explorerTemplate
    .replaceAll('$NFT_CONTRACT', nftContract)
    .replaceAll('$TOKEN_ID', normalizedTokenId);

  const hasTokenPlaceholder = explorerTemplate.includes('$TOKEN_ID');
  if (!hasTokenPlaceholder) {
    url = `${url}${normalizedTokenId}`;
  }
  return url;
};

const link = buildExplorerLink();
const packageBase = readEnv(
  'VITE_PACKAGE_URL',
  'NEXT_PUBLIC_PACKAGING_URL',
  'PACKAGE_URL'
);
const packageLink = `${packageBase}/?tokenId=${props.tokenId}`;

defineEmits(useDialogPluginComponent.emits);

const { dialogRef, onDialogHide } = useDialogPluginComponent();
</script>
