<template>
  <div class="nft-editor-shell">
    <div class="nft-editor-main">
      <div class="q-pa-md nft-editor-scroll">
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
                    {{
                      accountStore.account?.address ||
                      emailAuthStore.email ||
                      'Connect'
                    }}
                  </span>
                </template>
                <div class="q-pa-md" style="min-width: 260px">
                  <div class="column q-gutter-sm">
                    <div class="text-caption text-grey-6">Connect Wallet</div>
                    <q-btn
                      label="Reown (Wallet/Social)"
                      icon="account_balance_wallet"
                      color="primary"
                      flat
                      @click="openAppKitModal"
                      v-close-popup
                    />
                    <div class="text-caption text-grey-6">
                      Connect with any wallet or social login (Google, X, etc.)
                    </div>
                    <q-btn
                      label="Onramp (Buy Crypto)"
                      icon="add_circle"
                      color="primary"
                      flat
                      @click="openAppKitOnramp"
                      v-close-popup
                    />
                    <div class="text-caption text-grey-6">
                      Buy crypto via Reown onramp (works on mobile too).
                    </div>
                    <q-separator />
                    <q-btn
                      label="Web2 Email"
                      icon="mail"
                      color="secondary"
                      flat
                      @click="openWeb2Login"
                      v-close-popup
                    />
                    <div class="text-caption text-grey-6">
                      Stores a verified login locally and creates a wallet from it.
                    </div>

                    <div v-if="accountStore.account?.address" class="row items-center q-gutter-sm">
                      <div class="text-caption text-grey-6">Wallet connected</div>
                      <q-btn
                        icon="content_copy"
                        @click="
                          accountStore.account?.address &&
                            copyToClipboard(accountStore.account.address)
                        "
                        flat
                        dense
                        round
                      />
                    </div>
                    <div v-if="accountStore.account?.address" class="row q-gutter-sm">
                      <q-btn
                        label="Disconnect Wallet"
                        color="negative"
                        flat
                        rounded
                        @click="walletDisconnect.execute()"
                        v-close-popup
                      />
                    </div>

                    <div v-if="emailAuthStore.email" class="row q-gutter-sm">
                      <q-btn
                        label="Logout Web2"
                        color="negative"
                        flat
                        @click="clearEmailAuth"
                        v-close-popup
                      />
                    </div>
                    <div
                      v-if="emailAuthStore.email"
                      class="text-caption text-grey-6"
                    >
                      Logged in as {{ emailAuthStore.email }}
                    </div>
                  </div>
                </div>
              </q-btn-dropdown>

              <q-btn
                label="Save"
                @click="onSaveClick"
                icon="save"
                color="primary"
                dense
                no-caps
              />
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
    </div>

    <div class="nft-editor-right" :class="{ 'is-open': rightPanelOpen }">
      <div v-if="rightPanelOpen" class="nft-editor-right-content">
        <div class="nft-editor-right-header">
          <div class="text-caption text-grey-5">{{ rightTabLabel }}</div>
          <q-btn flat dense icon="close" @click="closeRightPanel" />
        </div>
        <div class="nft-editor-right-body">
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
            <NftInputsFlow
              v-model="value"
              @open-ai-settings="rightTab = 'ai'"
            />
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
            v-else-if="rightTab === 'share'"
            class="q-pa-none"
            style="flex: 1; overflow: auto; min-height: 0"
          >
            <TmDaoPanel />
          </div>

          <div
            v-else
            class="q-pa-md"
            style="flex: 1; overflow: auto; min-height: 0"
          >
            <TmListPanel @load-entry="onLoadEntry" @share="onShareToDao" />
          </div>
        </div>
      </div>

      <div class="nft-editor-tabs">
        <q-tabs
          v-model="rightTab"
          vertical
          dense
          dark
          class="bg-grey-10 text-white"
          active-color="primary"
          indicator-color="primary"
        >
          <q-tab
            v-if="selectedTarget === 'instance'"
            name="flow"
            icon="hub"
            label="Inputs"
          />
          <q-tab
            v-if="selectedTarget === 'instance'"
            name="lines"
            icon="schema"
            label="Lines"
          />
          <q-tab name="ai" icon="psychology" label="AI" />
          <q-tab
            v-if="isAiConfigured && selectedTarget === 'instance'"
            name="eco"
            icon="eco"
            label="Eco"
          />
          <q-tab name="share" icon="groups" label="Share" />
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

    <div v-if="rightTab === 'lines'" class="flow-overlay">
      <div class="flow-overlay-header">
        <div class="text-caption text-grey-5">Flow</div>
        <q-btn flat dense icon="close" @click="closeRightPanel" />
      </div>
      <div class="flow-overlay-body">
        <FlowEditor v-model="value" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.nft-editor-shell {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.nft-editor-main {
  width: 100%;
  height: 100%;
}

.nft-editor-scroll {
  height: 100%;
  overflow: auto;
}

.nft-editor-right {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  display: flex;
  align-items: stretch;
  width: 72px;
  transition: width 0.2s ease;
  z-index: 20;
}

.nft-editor-right.is-open {
  width: 520px;
}

.nft-editor-right-content {
  flex: 1;
  min-width: 0;
  background: #11161b;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
}

.nft-editor-right-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nft-editor-right-body {
  flex: 1;
  min-height: 0;
}

.nft-editor-tabs {
  width: 72px;
  min-width: 72px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  height: 100%;
}

.flow-overlay {
  position: fixed;
  inset: 0;
  background: #0e141a;
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.flow-overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.flow-overlay-body {
  flex: 1;
  min-height: 0;
}
</style>

<script setup lang="ts">
import PokedexEditor from 'src/components/editors/PokedexEditor.vue';
import MintResultDialog from './MintResultDialog.vue';
import ProductDecompositionWizard from './decomposition/ProductDecompositionWizard.vue';
import TmDaoPanel from './TmDaoPanel.vue';
import AISettingsPanel from './settings/AISettingsPanel.vue';
import AIChatPanel from './ai/AIChatPanel.vue';
import EcoPanel from './editors/impacts/EcoPanel.vue';
import { api } from 'src/boot/axios';
import {
  provide,
  ref,
  Ref,
  watch,
  onMounted,
  onUnmounted,
  computed,
} from 'vue';
import { Pokedex, MachineInstance, KnowHow } from '@trace.market/types';
import {
  clone,
  defaultPokedex,
  defaultMachineInstance,
  defaultKnowHow,
} from './editors/defaults';
import { useQuasar, copyToClipboard } from 'quasar';
import { useAccountStore } from 'src/stores/account';
import { useWalletStore } from 'src/stores/wallet';
import { useColonyStore } from 'src/stores/colony';
import { useDecompositionStore } from 'src/stores/decomposition';
import { useAsyncState } from '@vueuse/core';
import { sha256 } from 'thirdweb/utils';
import { initAppKit, openAppKitModal, openAppKitOnramp } from 'src/services/appkit';
import { Network } from '@colony/colony-js';
import {
  estimateImpacts,
  downloadOpenLCAExport,
} from 'src/services/openLCAClient';
import TmListPanel from './TmListPanel.vue';
import NftInputsFlow from './nftFlow/NftInputsFlow.vue';
import FlowEditor from 'src/flow-editor/FlowEditor.vue';
import EmailLoginDialog from './EmailLoginDialog.vue';
import ThirdwebLoginDialog from './ThirdwebLoginDialog.vue';

import { aiConfigStorage } from 'src/services/ai/AIConfigStorage';
import { Bee } from '@ethersphere/bee-js';
import { useEmailAuthStore } from 'src/stores/emailAuth';
import {
  ensureAccountCode,
  getWalletAddress,
  loadWalletData,
} from 'src/services/emailWallet';

const $q = useQuasar();
const emailAuthStore = useEmailAuthStore();

const value: Ref<Pokedex> = ref(clone(defaultPokedex));
const machineDraft: Ref<MachineInstance> = ref(clone(defaultMachineInstance));
const knowHowDraft: Ref<KnowHow> = ref(clone(defaultKnowHow));

function openEmailLogin() {
  $q.dialog({ component: EmailLoginDialog });
}

function openWeb2Login() {
  $q.dialog({ component: ThirdwebLoginDialog });
}

function clearEmailAuth() {
  emailAuthStore.clear();
}

// Reown AppKit handles connection via modal

function promptWeb2ForOnchain(actionLabel: string) {
  $q.notify({
    message: `Web2 login detected. ${actionLabel} will use email wallet when available. Open Web2 to manage your email wallet.`,
    color: 'warning',
  });
  openWeb2Login();
}

// Handler for loading entry from TmListPanel
function onLoadEntry(entry: any) {
  if (entry && entry.value) {
    let newValue = JSON.parse(JSON.stringify(entry.value));

    // Attempt to parse if newValue is a stringified JSON (fixes double-stringification)
    if (typeof newValue === 'string') {
      try {
        const parsed = JSON.parse(newValue);
        if (parsed && typeof parsed === 'object') {
          newValue = parsed;
        }
      } catch (e) {
        /* ignore */
      }
    }

    if (entry.key) {
      newValue.key = entry.key; // Store original key for update logic
    }

    // Update the relevant model based on the target in the entry if possible,
    // or just update 'value' if it matches selectedTarget?
    // The entry has 'target' property.
    if (entry.target === 'machine') {
      selectedTarget.value = 'machine';
      machineDraft.value = newValue;
    } else if (entry.target === 'knowHow') {
      selectedTarget.value = 'knowHow';
      knowHowDraft.value = newValue;
    } else {
      selectedTarget.value = 'instance';
      value.value = newValue;
    }

    $q.notify({
      message: 'Loaded entry from feed',
      color: 'positive',
      icon: 'cloud_download',
    });
  }
}

async function saveToSwarmFeed(target: string, payload: any) {
  if (!accountStore.account) {
    throw new Error('Wallet not connected');
  }
  if (!swarmApiUrl || !swarmBatchId) {
    throw new Error('Swarm config missing (SWARM_API_URL or SWARM_BATCH).');
  }

  const bee = new Bee(swarmApiUrl);
  const signer = await getSwarmSigner();
  const ownerHex = accountStore.account?.address as string;
  const topicName = `tm-editor-${target}`; // Dynamic topic based on target
  const topic = bee.makeFeedTopic(topicName);
  const feedType = 'sequence' as const;

  const writer = bee.makeFeedWriter(feedType, topic, signer);
  const manifestKey = feedManifestCacheKey(ownerHex, topicName);
  let manifestReference = window.localStorage.getItem(manifestKey) || '';

  let existingArray: unknown = [];
  if (manifestReference) {
    try {
      const downloaded = await bee.downloadData(manifestReference);
      const text = new TextDecoder().decode(downloaded);
      existingArray = JSON.parse(text);
    } catch (error) {
      console.warn('[Swarm] Failed to read existing feed data', error);
    }
  }

  // Ensure payload is prudent
  const cleanPayload = pruneJson(payload) ?? {};

  // Reuse upsert logic, but we need to ensure upsertFeedArray uses 'target' correctly.
  // The upsertFeedArray function uses 'selectedTarget.value'.
  // We should pass target explicitly to upsertFeedArray or modify it.
  const nextArray = await upsertFeedArray(existingArray, cleanPayload, target);

  const upload = await bee.uploadData(swarmBatchId, JSON.stringify(nextArray));

  try {
    await writer.upload(swarmBatchId, upload.reference);
  } catch (err: any) {
    // 404 handling logic...
    const is404 =
      err?.status === 404 ||
      err?.response?.status === 404 ||
      err?.code === 404 ||
      (typeof err?.message === 'string' &&
        (err.message.includes('404') || err.message.includes('Not Found')));

    if (is404) {
      await writer.upload(swarmBatchId, upload.reference, { index: 0 });
    } else {
      throw err;
    }
  }

  if (!manifestReference) {
    const manifest = await bee.createFeedManifest(
      swarmBatchId,
      feedType,
      topic,
      ownerHex
    );
    manifestReference = manifest.reference;
    window.localStorage.setItem(manifestKey, manifestReference);
  }

  return manifestReference;
}

// Updated signature to accept target
async function upsertFeedArray(
  existing: unknown,
  payload: any,
  targetOverride?: string
) {
  const currentTarget = targetOverride || selectedTarget.value;
  const list = Array.isArray(existing) ? [...existing] : [];
  const key = deriveUpsertKey(payload) || (await hashJson(payload));
  const index = list.findIndex(
    (item: any) => item?.key === key && item?.target === currentTarget
  );
  const entry = {
    key,
    target: currentTarget,
    updatedAt: new Date().toISOString(),
    value: payload,
    // Add colonyAddress at top level of entry for easier indexing?
    // It's already in payload (value), but feed entry often wraps it.
    // Let's keep it in value for consistency with current schema.
    colonyAddress: payload.colonyAddress,
  };
  if (index >= 0) {
    list[index] = { ...list[index], ...entry };
  } else {
    list.push(entry);
  }
  return list;
}

async function onSaveClick() {
  if (!accountStore.account) {
    if (emailAuthStore.email) {
      promptWeb2ForOnchain('Save');
      return;
    }
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

  try {
    const payload = getActivePayload();
    await saveToSwarmFeed(selectedTarget.value, payload);
    $q.notify({
      message: 'Saved to Swarm feed.',
      color: 'positive',
    });
  } catch (error: unknown) {
    console.error('[Swarm] Save failed', error);
    $q.notify({
      message: `Save failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      color: 'negative',
      icon: 'error',
    });
  }
}

async function onShareToDao(entry: any) {
  if (!entry) return;
  if (!accountStore.account && emailAuthStore.email) {
    promptWeb2ForOnchain('DAO actions');
    return;
  }

  // Logic to determine label/name
  let label = entry.type || entry.value?.type;
  if (!label && (entry.target === 'machine' || entry.value?.category)) {
    label = entry.value?.category;
  }
  if (!label && entry.target === 'knowHow' && entry.value?.outputs) {
    const outputs = Array.isArray(entry.value.outputs)
      ? entry.value.outputs
      : [];
    if (outputs.length > 0 && outputs[0]?.type) {
      label = outputs[0].type;
    }
  }

  const existingColonyAddress =
    entry.colonyAddress || entry.value?.colonyAddress;

  if (existingColonyAddress) {
    // Existing DAO found
    localStorage.setItem('tm-dao.colony', existingColonyAddress);
    colonyStore.colonyAddress = existingColonyAddress;
    if (label) colonyStore.colonyLabel = label;
    rightTab.value = 'share';
  } else {
    // No DAO found. Create one automatically?
    $q.dialog({
      title: 'Create Colony DAO?',
      message: `No DAO found for "${
        label || 'this item'
      }". Would you like to create one now? This involves on-chain transactions.`,
      cancel: true,
      persistent: true,
    }).onOk(async () => {
      try {
        if (!accountStore.account) {
          throw new Error('Connect wallet first');
        }

        // Ensure walletStore (Colony) is connected and network initialized
        if (!walletStore.connection) {
          await walletStore.connect();
        }

        // Force switch to ArbitrumOne (required for Colony DAO creation)
        // We use ArbitrumOne as the default target for real DAOs
        const targetNetwork = Network.ArbitrumOne;

        // Only suggest switch if we are strictly not on the target chain?
        // walletStore.suggestNetworkSwitch should handle the check internally or we can check chainId.
        // But checking chainId here requires knowing the specific ID (42161).
        // Safer to let the store/service handle it.
        await walletStore.suggestNetworkSwitch(targetNetwork);

        if (!walletStore.networkClient) {
          $q.loading.show({ message: 'Initializing Colony Network...' });
          await walletStore.initNetworkClient(targetNetwork);
        }

        $q.loading.show({
          message:
            'Creating Colony DAO (Minting token + Deploying contract)...',
        });

        // 1. Prepare Metadata & Token Params
        const safeLabel = label || 'TraceMarket Item';
        // Generate symbol: first 3-4 consonants or chars?
        const safeSymbol =
          safeLabel
            .replace(/[^a-zA-Z]/g, '')
            .slice(0, 4)
            .toUpperCase() || 'TMKT';

        const payload = entry.value || {};

        // 2. Call Store Action
        const newAddress = await colonyStore.createColony({
          name: safeLabel,
          symbol: safeSymbol,
          metadata: payload,
        });

        // 3. Update entry with new address
        if (newAddress) {
          const updatedPayload = { ...payload, colonyAddress: newAddress };

          // 4. Save back to Feed
          await saveToSwarmFeed(entry.target, updatedPayload);

          $q.notify({
            message: 'DAO Created & Feed Updated!',
            color: 'positive',
          });

          // 5. Navigate
          colonyStore.colonyAddress = newAddress;
          colonyStore.colonyLabel = safeLabel;
          rightTab.value = 'share';
        }
      } catch (e: any) {
        $q.notify({
          message: `Creation failed: ${e.message}`,
          color: 'negative',
        });
      } finally {
        $q.loading.hide();
      }
    });
  }
}

type RightTab =
  | 'json'
  | 'flow'
  | 'lines'
  | 'tm-list'
  | 'wizard'
  | 'ai'
  | 'eco'
  | 'share';
const rightTab = ref<RightTab | null>(null);
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
  switchToTab: (tab: RightTab) => {
    if (tab === 'tm-list' && !accountStore.account) {
      // Don't switch to list if not connected
      return;
    }
    rightTab.value = tab;
  },
});
const rightPanelOpen = computed(
  () => rightTab.value !== null && rightTab.value !== 'lines'
);
const rightTabLabel = computed(() => {
  if (!rightTab.value) return 'Panel';
  const labels: Record<RightTab, string> = {
    ai: 'AI',
    flow: 'Inputs',
    lines: 'Flow',
    eco: 'Eco',
    share: 'Share',
    'tm-list': 'List',
    json: 'JSON',
    wizard: 'Wizard',
  };
  return labels[rightTab.value];
});

const closeRightPanel = () => {
  rightTab.value = null;
};

provide('pokedexActions', {
  updateInstance: (newInstance: any) => applyInstance(newInstance),
});

const decompositionStore = useDecompositionStore();
const accountStore = useAccountStore();
const walletStore = useWalletStore();
const colonyStore = useColonyStore();

const isAiConfigured = ref(false);
const aiChatHasMessages = ref(false);

function refreshAiConfig() {
  isAiConfigured.value = aiConfigStorage.isConfigured();
}

onMounted(async () => {
  console.log('[NftEditor] mounted');
  window.addEventListener('ai-config-updated', refreshAiConfig);
  refreshAiConfig();

  emailAuthStore.loadFromStorage();

  // Initialize Reown AppKit
  try {
    await initAppKit();
    console.log('[AppKit] AppKit initialized');
  } catch (err) {
    console.warn('[AppKit] AppKit init failed', err);
  }

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
    if (
      next !== 'instance' &&
      (rightTab.value === 'flow' ||
        rightTab.value === 'eco' ||
        rightTab.value === 'lines')
    ) {
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
  () => accountStore.account?.address,
  (next) => {
    if (next) {
      to.value = next;
    }
  }
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

const to = ref<string | undefined>(accountStore.account?.address);
const walletDropdownRef = ref<any>(null);
const selectedWallet = ref<'walletConnect' | 'metamask'>('metamask');
const walletOptions = [
  { label: 'WalletConnect (mobile)', value: 'walletConnect' },
  { label: 'MetaMask (browser)', value: 'metamask' },
];

const swarmApiUrl = process.env.SWARM_API_URL;
const swarmBatchId = process.env.SWARM_BATCH;
const feedManifestCacheKey = (owner: string, topic: string) =>
  `swarm:feed:${owner}:${topic}`;

const walletDisconnect = useAsyncState(
  () => {
    accountStore.account = undefined;
    accountStore.wallet = undefined;
    // AppKit handles its own disconnect via the modal
    return Promise.resolve();
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

async function resolveEmailWalletRecipient() {
  const email = emailAuthStore.email;
  if (!email) return undefined;

  const cached = loadWalletData(email);
  if (cached.walletAddress) return cached.walletAddress;

  const code = cached.code || ensureAccountCode(email);
  const address = await getWalletAddress(email, code);
  return address || undefined;
}

function onMintClick() {
  if (accountStore.account === undefined) {
    if (emailAuthStore.email) {
      return resolveEmailWalletRecipient()
        .then((address) => {
          if (!address) {
            $q.notify({
              message: 'Email wallet address not found. Open Auth0 login to fetch it.',
              color: 'negative',
            });
            return;
          }
          to.value = address;
          return mint();
        })
        .catch((error) => {
          $q.notify({
            message: `Email wallet lookup failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
            color: 'negative',
          });
        });
    }
    openEmailLogin();
    return;
  }
  return mint();
}

function getTopicName() {
  return `tm-editor-${selectedTarget.value}`;
}

function getActivePayload() {
  const target = getActiveJsonTarget();
  return stripBioFields(JSON.parse(JSON.stringify(target)));
}

function hexToBytes(hex: string) {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(normalized.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function getSwarmSigner() {
  const account = accountStore.account as any;
  if (!account?.address || !account?.signMessage) {
    throw new Error('Wallet signer not available');
  }
  const owner = account.address as string;
  return {
    address: hexToBytes(owner),
    sign: async (digest: Uint8Array) => {
      let signature: unknown;
      try {
        signature = await account.signMessage({ message: { raw: digest } });
      } catch (error) {
        const hex = `0x${Array.from(digest)
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')}`;
        signature = await account.signMessage({ message: hex });
      }
      if (signature instanceof Uint8Array) {
        return signature;
      }
      return hexToBytes(signature as string);
    },
  } as any;
}

function deriveUpsertKey(payload: any) {
  if (!payload || typeof payload !== 'object') return null;
  // If payload has an explicit key/id, use it.
  if (['string', 'number'].includes(typeof payload.key))
    return String(payload.key);
  if (['string', 'number'].includes(typeof payload._key))
    return String(payload._key);
  if (['string', 'number'].includes(typeof payload.id))
    return String(payload.id);

  const candidates = [
    payload.hash,
    payload.token,
    payload.contract,
    payload.ownerId,
    payload.type,
    payload.title,
  ];
  return (
    candidates.find(
      (item) => typeof item === 'string' && item.trim().length > 0
    ) || null
  );
}

async function hashJson(payload: any) {
  const json = JSON.stringify(payload);
  const data = new TextEncoder().encode(json);
  const hash = sha256(data);
  // Remove 0x prefix to match previous behavior (plain hex string)
  return hash.startsWith('0x') ? hash.slice(2) : hash;
}

function pruneJson(value: any): any {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0 ? undefined : value;
  }
  if (typeof value === 'number') {
    return value === 0 ? undefined : value;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    const next = value
      .map((item) => pruneJson(item))
      .filter((item) => item !== undefined);
    return next.length === 0 ? undefined : next;
  }
  if (typeof value === 'object') {
    const next: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      const pruned = pruneJson(val);
      if (pruned !== undefined) {
        next[key] = pruned;
      }
    });
    return Object.keys(next).length === 0 ? undefined : next;
  }
  return value;
}

// Wallet connection now handled by Reown AppKit modal

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
