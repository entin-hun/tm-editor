<template>
  <div class="column fit">
    <q-splitter v-model="split" style="height: 100vh">
      <template #before>
        <div
          class="q-pa-md"
          style="height: 100vh; overflow: auto; min-width: 0; max-width: 100%"
        >
          <PokedexEditor
            v-model="value"
            v-model:selectedTarget="selectedTarget"
            v-model:machineDraft="machineDraft"
            v-model:knowHowDraft="knowHowDraft"
          >
            <template #actions>
              <div class="row items-center q-gutter-sm">
                <q-btn-dropdown
                  ref="walletDropdownRef"
                  flat
                  padding="0"
                  rounded
                >
                  <template v-slot:label>
                    <span
                      style="
                        max-width: 12em;
                        text-overflow: ellipsis;
                        overflow: hidden;
                      "
                    >
                      {{ accountStore.account?.address ?? 'Connect Wallet' }}
                    </span>
                  </template>
                  <div class="q-pa-md" style="min-width: 240px">
                    <div class="column q-gutter-sm">
                      <div class="row items-center q-gutter-sm">
                        <q-select
                          v-model="selectedWallet"
                          :options="walletOptions"
                          dense
                          label="Wallet Provider"
                          class="col"
                        />
                        <q-btn
                          v-if="accountStore.account?.address"
                          icon="content_copy"
                          @click="
                            accountStore.account?.address &&
                              copyToClipboard(accountStore.account.address)
                          "
                          class="q-ml-sm"
                          flat
                          dense
                          round
                        />
                      </div>
                      <div class="row q-gutter-sm">
                        <q-btn
                          v-if="accountStore.account === undefined"
                          label="Connect"
                          color="primary"
                          @click="connectWallet"
                          v-close-popup
                        />
                        <q-btn
                          v-else
                          label="Disconnect"
                          color="negative"
                          flat
                          rounded
                          @click="walletDisconnect.execute()"
                          v-close-popup
                        />
                      </div>
                    </div>
                  </div>
                </q-btn-dropdown>

                <q-input
                  v-if="accountStore.account !== undefined"
                  label="to"
                  v-model="to"
                  dense
                  class="col"
                />
                <q-btn
                  label="On-Chain NFT"
                  @click="onMintClick"
                  icon="send"
                  color="primary"
                  dense
                  no-caps
                />
              </div>
            </template>
          </PokedexEditor>
        </div>
      </template>
      <template #after>
        <div class="row no-wrap" style="height: 100vh">
          <div class="column" style="flex: 1; min-width: 0; height: 100%">
            <div
              v-if="rightTab === 'json'"
              class="q-pa-md"
              style="flex: 1; overflow: auto; min-height: 0"
            >
              <q-input
                v-model="jsonText"
                type="textarea"
                filled
                style="height: 100%; min-height: calc(100vh - 200px)"
                :input-style="{
                  height: '100%',
                  minHeight: '100%',
                  fontFamily: 'monospace',
                }"
                @blur="parseJson"
                @update:model-value="onJsonInput"
                :error="hasJsonError"
                :error-message="jsonError"
              />
            </div>

            <div
              v-else-if="rightTab === 'flow'"
              style="flex: 1; overflow: auto; min-height: 0"
            >
              <NftInputsFlow v-model="value" @open-ai-settings="rightTab = 'ai'" />
            </div>

            <div
              v-else-if="rightTab === 'wizard'"
              class="q-pa-md"
              style="flex: 1; overflow: auto; min-height: 0"
            >
              <ProductDecompositionWizard @open-settings="rightTab = 'ai'" />
            </div>

            <div
              v-else-if="rightTab === 'ai'"
              class="q-pa-md"
              style="flex: 1; overflow: auto; min-height: 0"
            >
              <AISettingsPanel :has-messages="aiChatHasMessages" />
              <AIChatPanel @messages-changed="aiChatHasMessages = $event > 0" />
            </div>

            <div
              v-else-if="rightTab === 'eco'"
              class="q-pa-md bg-grey-10"
              style="flex: 1; overflow: auto; min-height: 0"
            >
              <EcoPanel :pokedex="value" />
            </div>

            <div
              v-else
              class="q-pa-md"
              style="flex: 1; overflow: auto; min-height: 0"
            >
              <TmListPanel />
            </div>
          </div>

          <div
            class="column items-center"
            style="
              flex-shrink: 0;
              width: 72px;
              min-width: 72px;
              border-left: 1px solid rgba(255, 255, 255, 0.1);
              height: 100%;
            "
          >
            <q-tabs
              v-model="rightTab"
              vertical
              dense
              dark
              class="bg-grey-10 text-white"
              active-color="primary"
              indicator-color="primary"
            >
              <q-tab name="ai" icon="psychology" label="AI" />
              <q-tab v-if="selectedTarget === 'instance'" name="flow" icon="hub" label="Flow" />
              <q-tab v-if="isAiConfigured && selectedTarget === 'instance'" name="eco" icon="eco" label="Eco" />
              <q-tab
                v-if="accountStore.account"
                name="tm-list"
                icon="view_list"
                label="List"
              />
              <q-tab name="json" icon="code" label="JSON" />

              <q-tab
                v-if="decompositionStore.isWizardActive"
                name="wizard"
                icon="auto_fix_high"
                label="Wizard"
              />
            </q-tabs>
          </div>
        </div>
      </template>
    </q-splitter>
  </div>
</template>

<script setup lang="ts">
import PokedexEditor from 'src/components/editors/PokedexEditor.vue';
import MintResultDialog from './MintResultDialog.vue';
import ProductDecompositionWizard from './decomposition/ProductDecompositionWizard.vue';
import AISettingsPanel from './settings/AISettingsPanel.vue';
import AIChatPanel from './ai/AIChatPanel.vue';
import EcoPanel from './editors/impacts/EcoPanel.vue';
import { api } from 'src/boot/axios';
import { provide, ref, Ref, watch, onMounted, onUnmounted } from 'vue';
import { Pokedex, MachineInstance, KnowHow } from '@trace.market/types';
import {
  clone,
  defaultPokedex,
  defaultMachineInstance,
  defaultKnowHow,
} from './editors/defaults';
import { useQuasar, copyToClipboard } from 'quasar';
import { useAccountStore } from 'src/stores/account';
import { useDecompositionStore } from 'src/stores/decomposition';
import { useAsyncState } from '@vueuse/core';
import { createWallet } from 'thirdweb/wallets';
import {
  estimateImpacts,
  downloadOpenLCAExport,
} from 'src/services/openLCAClient';
import TmListPanel from './TmListPanel.vue';
import NftInputsFlow from './nftFlow/NftInputsFlow.vue';

import { aiConfigStorage } from 'src/services/ai/AIConfigStorage';

const value: Ref<Pokedex> = ref(clone(defaultPokedex));
const machineDraft: Ref<MachineInstance> = ref(clone(defaultMachineInstance));
const knowHowDraft: Ref<KnowHow> = ref(clone(defaultKnowHow));
const rightTab = ref<'json' | 'flow' | 'tm-list' | 'wizard' | 'ai' | 'eco'>(
  'ai'
);
const selectedTarget = ref<'instance' | 'machine' | 'knowHow'>('instance');
const jsonText = ref('');
const hasJsonError = ref(false);
const jsonError = ref('');

const DEBUG_SAMPLE_INSTANCE = {
  category: 'food',
  type: 'Honey Poppy Drink',
  bio: false,
  quantity: 1000,
  price: {
    amount: 0,
    currency: '',
    type: 'budget',
  },
  iDs: [
    {
      id: 'https://www.plantsoul.hu/honey-poppy-1liter/',
      registry: 'url',
    },
  ],
  process: {
    type: 'blending',
    timestamp: 1768425427261,
    site: {
      location: {
        type: 'Point',
        coordinates: [0, 0],
      },
    },
    inputInstances: [
      {
        type: 'local',
        quantity: 470,
        priceShare: 1,
        instance: {
          category: 'food',
          type: 'Poppy',
          bio: false,
          quantity: 0,
          price: {
            amount: 0,
            currency: '',
            type: 'budget',
          },
          iDs: [],
          process: {
            type: 'harvest',
            inputInstances: [],
          },
        },
      },
      {
        type: 'local',
        quantity: 190,
        priceShare: 1,
        instance: {
          category: 'food',
          type: 'Acacia Honey',
          bio: false,
          quantity: 0,
          price: {
            amount: 0,
            currency: '',
            type: 'budget',
          },
          iDs: [],
          process: {
            type: 'harvest',
            inputInstances: [],
          },
        },
      },
      {
        type: 'local',
        quantity: 1000,
        priceShare: 1,
        instance: {
          category: 'food',
          type: 'Purified Water',
          bio: false,
          quantity: 0,
          price: {
            amount: 0,
            currency: '',
            type: 'budget',
          },
          iDs: [],
          process: {
            type: 'blending',
            inputInstances: [],
          },
        },
      },
      {
        type: 'local',
        quantity: 0.1,
        priceShare: 1,
        instance: {
          category: 'food',
          type: 'Salt',
          bio: false,
          quantity: 0,
          price: {
            amount: 0,
            currency: '',
            type: 'budget',
          },
          iDs: [],
          process: {
            type: 'harvest',
            inputInstances: [],
          },
        },
      },
    ],
  },
};

function normalizeInputInstances(instance: any): void {
  if (!instance || typeof instance !== 'object') return;

  // Recursively normalize inputInstances in process
  if (instance.process && Array.isArray(instance.process.inputInstances)) {
    instance.process.inputInstances = instance.process.inputInstances.map(
      (inp: any) => {
        if (!inp.type) {
          // Add type: 'local' if missing
          return {
            type: 'local',
            ...inp,
          };
        }
        return inp;
      }
    );
  }
}

function applyInstance(newInstance: any) {
  console.log('[NftEditor] updateInstance called with:', newInstance);

  // Normalize inputInstances to ensure they have type field
  if (newInstance && typeof newInstance === 'object') {
    normalizeInputInstances(newInstance);
  }

  // Directly mutate the instance property of the Pokedex object
  value.value.instance = newInstance;

  syncJsonFromTarget();

  console.log(
    '[NftEditor] value.value.instance after update:',
    value.value.instance
  );
}

function stripBioFields<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => stripBioFields(item)) as T;
  }
  if (input && typeof input === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
      if (key === 'bio') return;
      result[key] = stripBioFields(value);
    });
    return result as T;
  }
  return input;
}

function getActiveJsonTarget() {
  if (selectedTarget.value === 'machine') return machineDraft.value;
  if (selectedTarget.value === 'knowHow') return knowHowDraft.value;
  return value.value;
}

function setActiveJsonTarget(next: unknown) {
  if (selectedTarget.value === 'machine') {
    machineDraft.value = next as MachineInstance;
    return;
  }
  if (selectedTarget.value === 'knowHow') {
    knowHowDraft.value = next as KnowHow;
    return;
  }
  value.value = next as Pokedex;
}

function syncJsonFromTarget() {
  if (hasJsonError.value) return;
  const target = getActiveJsonTarget();
  const safe = stripBioFields(JSON.parse(JSON.stringify(target)));
  jsonText.value = JSON.stringify(safe, undefined, 2);
  hasJsonError.value = false;
  jsonError.value = '';
}

// Provide action to switch tabs (e.g. from generic editor)
provide('tabActions', {
  switchToTab: (tab: typeof rightTab.value) => {
    if (tab === 'tm-list' && !accountStore.account) {
      // Don't switch to list if not connected
      return;
    }
    rightTab.value = tab;
  },
});

provide('pokedexActions', {
  updateInstance: (newInstance: any) => applyInstance(newInstance),
});

const decompositionStore = useDecompositionStore();
const accountStore = useAccountStore();

const isAiConfigured = ref(false);
const aiChatHasMessages = ref(false);

function refreshAiConfig() {
  isAiConfigured.value = aiConfigStorage.isConfigured();
}

onMounted(() => {
  console.log('[NftEditor] mounted');
  window.addEventListener('ai-config-updated', refreshAiConfig);
  refreshAiConfig();

  // Support hash-based routing: /#/?debugApplySample=1
  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  const queryString =
    queryIndex >= 0
      ? hash.slice(queryIndex + 1)
      : window.location.search.replace(/^\?/, '');
  const params = new URLSearchParams(queryString);
  if (params.get('debugApplySample') === '1') {
    console.log('[NftEditor] Applying debug sample instance from query flag');
    applyInstance(DEBUG_SAMPLE_INSTANCE);
  }
});

onUnmounted(() => {
  window.removeEventListener('ai-config-updated', refreshAiConfig);
});

// Watch for wizard activation
watch(
  () => decompositionStore.isWizardActive,
  (isActive) => {
    if (isActive) {
      rightTab.value = 'wizard';
    } else if (rightTab.value === 'wizard') {
      rightTab.value = 'json';
    }
  }
);

// Watch for tab changes to update store
watch(rightTab, (tab) => {
  if (tab !== 'wizard') {
    decompositionStore.closeWizard();
  }
});

watch(
  selectedTarget,
  (next) => {
    if (next !== 'instance' && (rightTab.value === 'flow' || rightTab.value === 'eco')) {
      rightTab.value = 'json';
    }
    syncJsonFromTarget();
  },
  { immediate: true }
);

// Update JSON text when value changes from form
watch(
  value,
  () => {
    if (selectedTarget.value === 'instance') {
      syncJsonFromTarget();
    }
  },
  { deep: true }
);

watch(
  machineDraft,
  () => {
    if (selectedTarget.value === 'machine') {
      syncJsonFromTarget();
    }
  },
  { deep: true }
);

watch(
  knowHowDraft,
  () => {
    if (selectedTarget.value === 'knowHow') {
      syncJsonFromTarget();
    }
  },
  { deep: true }
);

// Parse JSON and update value when JSON text changes
function parseJson() {
  try {
    const parsed = JSON.parse(jsonText.value);
    const cleaned = stripBioFields(parsed);
    setActiveJsonTarget(cleaned);
    hasJsonError.value = false;
    jsonError.value = '';
  } catch (error: unknown) {
    hasJsonError.value = true;
    jsonError.value = error instanceof Error ? error.message : String(error);
  }
}

// Live-sync JSON edits to the form as soon as JSON becomes valid
function onJsonInput(newValue: string | number | null) {
  // q-input emits string or null; ignore null/empty transiently
  jsonText.value = typeof newValue === 'string' ? newValue : '';

  try {
    const parsed = JSON.parse(jsonText.value);
    const cleaned = stripBioFields(parsed);
    setActiveJsonTarget(cleaned);
    hasJsonError.value = false;
    jsonError.value = '';
  } catch (error: unknown) {
    // Keep error state but do not throw; form stays unchanged until valid JSON
    hasJsonError.value = true;
    jsonError.value = error instanceof Error ? error.message : String(error);
  }
}

const $q = useQuasar();
const split = ref(50);
const to = ref<string | undefined>(accountStore.account?.address);
const walletDropdownRef = ref<any>(null);
const selectedWallet = ref<'walletConnect' | 'metamask'>('walletConnect');
const walletOptions = [
  { label: 'WalletConnect (mobile)', value: 'walletConnect' },
  { label: 'MetaMask (browser)', value: 'metamask' },
];

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

function mint() {
  return api
    .post('/mint', {
      to: to.value,
      content: value.value,
    })
    .then((result) =>
      $q.dialog({
        title: 'Mint Result',
        // message: result.data.message,
        component: MintResultDialog,
        componentProps: { tokenId: result.data.tokenId },
      })
    );
}

function onMintClick() {
  if (accountStore.account === undefined) {
    // Until connected, Mint should prompt wallet connection UI.
    if (walletDropdownRef.value?.show) {
      walletDropdownRef.value.show();
      return;
    }
    if (walletDropdownRef.value?.toggle) {
      walletDropdownRef.value.toggle();
      return;
    }
    return;
  }
  return mint();
}

async function connectWallet() {
  try {
    let wallet;
    if (selectedWallet.value === 'walletConnect') {
      // Use default configuration which relies on accountStore.client via connect()
      wallet = createWallet('walletConnect');
    } else {
      wallet = createWallet('io.metamask');
    }

    await wallet.connect({
      client: accountStore.client,
      chain: accountStore.chain,
    });
    accountStore.wallet = wallet;
    accountStore.account = wallet.getAccount();
    to.value = accountStore.account?.address;

    $q.notify({ message: 'Wallet connected', color: 'positive' });
  } catch (error: unknown) {
    $q.notify({
      message: `Connect failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      color: 'negative',
      icon: 'error',
    });
  }
}

function estimateImpactsWithOpenLCA() {
  const impacts = estimateImpacts(value.value);

  $q.dialog({
    title: 'Estimated Environmental Impacts',
    message: `
      <div style="padding: 1em;">
        <div style="margin-bottom: 1em;">
          <strong>Carbon Footprint:</strong> ${impacts.carbon.toFixed(
            2
          )} kg CO2e
        </div>
        <div>
          <strong>Water Footprint:</strong> ${impacts.water.toFixed(2)} liters
        </div>
      </div>
    `,
    html: true,
    ok: {
      label: 'Close',
      color: 'primary',
    },
  });
}

function exportToOpenLCA() {
  try {
    downloadOpenLCAExport(value.value);
    $q.notify({
      message: 'openLCA export file downloaded',
      color: 'positive',
      icon: 'download',
      position: 'top',
    });
  } catch (error: unknown) {
    $q.notify({
      message: `Export failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      color: 'negative',
      icon: 'error',
      position: 'top',
    });
  }
}

provide('openlcaActions', {
  estimate: estimateImpactsWithOpenLCA,
  exportData: exportToOpenLCA,
});
</script>

<style scoped>
.fill-textarea {
  height: 100%;
}
.fill-textarea .q-field__control {
  height: 100%;
}
.fill-textarea .q-field__native {
  height: 100% !important;
  min-height: 100% !important;
  resize: none;
}
</style>
