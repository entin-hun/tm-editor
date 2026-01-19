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

const link = `${process.env.EXPLORER_URL}${BigInt(props.tokenId).toString()}`;
const packageLink = `${process.env.PACKAGE_URL}/?tokenId=${props.tokenId}`;

defineEmits(useDialogPluginComponent.emits);

const { dialogRef, onDialogHide } = useDialogPluginComponent();
</script>
