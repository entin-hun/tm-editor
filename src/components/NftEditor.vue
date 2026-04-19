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
              <q-btn-dropdown ref="walletDropdownRef" flat padding="0" rounded>
                <template v-slot:label>
                  <span
                    style="
                      max-width: 12em;
                      text-overflow: ellipsis;
                      overflow: hidden;
                    "
                  >
                    {{
                      connectedWalletType
                        ? `${connectedWalletType}: ${(
                            accountStore.account?.address || ''
                          ).slice(0, 6)}...${(
                            accountStore.account?.address || ''
                          ).slice(-4)}`
                        : accountStore.account?.address ||
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
                      Stores a verified login locally and creates a wallet from
                      it.
                    </div>

                    <div
                      v-if="accountStore.account?.address"
                      class="column q-gutter-xs"
                    >
                      <div class="text-caption text-grey-6">
                        Wallet connected
                      </div>
                      <div class="text-caption text-grey-5">
                        {{ connectedWalletType || 'Unknown Wallet' }}
                      </div>
                      <div class="row items-center q-gutter-sm">
                        <q-btn
                          icon="content_copy"
                          @click="
                            accountStore.account?.address &&
                              copyToClipboard(accountStore.account.address)
                          "
                          flat
                          dense
                          round
                          size="sm"
                        />
                        <span class="text-caption text-grey-6"
                          >{{
                            (accountStore.account?.address || '').slice(0, 10)
                          }}...{{
                            (accountStore.account?.address || '').slice(-8)
                          }}</span
                        >
                      </div>
                    </div>
                    <div
                      v-if="accountStore.account?.address"
                      class="row q-gutter-sm"
                    >
                      <q-btn
                        label="Disconnect Wallet"
                        color="negative"
                        flat
                        rounded
                        @click="
                          disconnectAppKit();
                          walletDisconnect.execute();
                        "
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

    <div
      class="nft-editor-right"
      :class="{ 'is-open': rightPanelOpen, 'is-lines': rightTab === 'lines' }"
    >
      <div v-if="rightPanelOpen" class="nft-editor-right-content">
        <div class="nft-editor-right-header">
          <div class="text-caption text-grey-5">{{ rightTabLabel }}</div>
          <q-btn flat dense icon="close" @click="closeRightPanel" />
        </div>
        <div class="nft-editor-right-body">
          <div v-if="rightTab === 'json'" class="json-tab-container">
            <textarea
              v-model="jsonText"
              class="json-textarea-native"
              :class="{ 'has-error': hasJsonError }"
              spellcheck="false"
              @blur="parseJson"
              @input="onJsonTextareaInput"
            />
            <div v-if="hasJsonError" class="json-error-message">
              {{ jsonError }}
            </div>
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
            v-else-if="rightTab === 'lines'"
            class="lines-tab-container"
            @keydown.capture="handleLinesEnterNavigation"
          >
            <FlowEditor v-model="value" />
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
          :model-value="rightTab"
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
            @click="handleTabToggle('flow')"
          />
          <q-tab
            v-if="selectedTarget === 'instance' || selectedTarget === 'knowHow'"
            name="lines"
            icon="schema"
            label="Lines"
            @click="handleTabToggle('lines')"
          />
          <q-tab
            name="ai"
            icon="psychology"
            label="AI"
            @click="handleTabToggle('ai')"
          />
          <q-tab
            v-if="isAiConfigured && selectedTarget === 'instance'"
            name="eco"
            icon="eco"
            label="Eco"
            @click="handleTabToggle('eco')"
          />
          <q-tab
            name="share"
            icon="groups"
            label="Share"
            @click="handleTabToggle('share')"
          />
          <q-tab
            v-if="accountStore.account"
            name="tm-list"
            icon="view_list"
            label="List"
            @click="handleTabToggle('tm-list')"
          />
          <q-tab
            name="json"
            icon="code"
            label="JSON"
            @click="handleTabToggle('json')"
          />
          <q-tab
            v-if="decompositionStore.isWizardActive"
            name="wizard"
            icon="auto_fix_high"
            label="Wizard"
            @click="handleTabToggle('wizard')"
          />
        </q-tabs>
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

.nft-editor-right.is-lines {
  width: calc(100vw - 72px);
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
  display: flex;
  flex-direction: column;
}

.nft-editor-tabs {
  width: 72px;
  min-width: 72px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  height: 100%;
}

.json-tab-container {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.json-textarea-native {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  border: 1px solid #1f87ff;
  border-radius: 0;
  background: transparent;
  color: #fff;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.2858;
  padding: 12px;
  resize: none;
  outline: none;
}

.json-textarea-native.has-error {
  border-color: #ff5b5b;
}

.json-error-message {
  color: #ff9090;
  font-size: 12px;
  padding: 6px 10px;
}

.lines-tab-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
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
import {
  initAppKit,
  openAppKitModal,
  openAppKitOnramp,
  onAppKitAccount,
  disconnectAppKit,
} from 'src/services/appkit';
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
  if (!accountStore.account) throw new Error('Wallet not connected');
  if (!swarmApiUrl || !swarmBatchId)
    throw new Error('Swarm config missing (SWARM_API_URL or SWARM_BATCH).');

  const swarmAuth = process.env.SWARM_AUTH as string | undefined;
  const bee = new Bee(swarmApiUrl, swarmAuth ? { headers: { Authorization: swarmAuth } } : undefined);
  const signer = await getSwarmSigner();
  const ownerHex = accountStore.account.address as string;
  const topicName = `tm-editor-${target}`;
  const topic = bee.makeFeedTopic(topicName);
  const feedType = 'sequence' as const;

  const reader = bee.makeFeedReader(feedType, topic, ownerHex);
  const writer = bee.makeFeedWriter(feedType, topic, signer);

  // Read the current feed to get the next SOC index and existing array.
  // feedIndexNext is the 16-char hex string for the next SOC to write.
  // On first save (feed doesn't exist) the reader.download() throws → start at 0.
  let nextIndexHex = '0000000000000000';
  let existingArray: unknown[] = [];
  try {
    const current = await reader.download();
    nextIndexHex = (current as any).feedIndexNext || '0000000000000000';
    if (current.reference) {
      try {
        const data = await bee.downloadData(current.reference as any);
        existingArray = JSON.parse(new TextDecoder().decode(data));
      } catch {
        console.warn('[Swarm] Could not parse existing feed content');
      }
    }
  } catch {
    // Feed does not exist yet – first save, index stays at 0.
  }

  const socIndex = BigInt('0x' + nextIndexHex);
  const cleanPayload = pruneJson(payload) ?? {};
  const nextArray = await upsertFeedArray(
    existingArray,
    cleanPayload,
    target,
    socIndex
  );

  // Upload the new JSON blob; the returned reference is the SOC payload.
  const upload = await bee.uploadData(swarmBatchId, JSON.stringify(nextArray));

  // Write a versioned SOC at the explicit next index.
  await writer.upload(swarmBatchId, upload.reference, {
    index: nextIndexHex as any,
  });

  return { topic: topicName, socIndex: socIndex.toString() };
}

// Maps tm-editor target to DAO RegistryCategory (REGISTRY.md)
function targetToRegistryCategory(
  target: string
): 'tools' | 'services' | 'products' | 'knowhow' | 'facilities' {
  if (target === 'machine') return 'tools';
  if (target === 'knowHow') return 'knowhow';
  return 'products'; // 'instance' = food/non-food process output
}

async function upsertFeedArray(
  existing: unknown,
  payload: any,
  targetOverride?: string,
  socIndex?: bigint
) {
  const currentTarget = targetOverride || selectedTarget.value;
  const list = Array.isArray(existing) ? [...existing] : [];
  const key = deriveUpsertKey(payload) || (await hashJson(payload));
  const index = list.findIndex(
    (item: any) => item?.key === key && item?.target === currentTarget
  );
  const existingEntry = index >= 0 ? list[index] : null;
  const nowMs = Date.now();
  const entry = {
    key,
    target: currentTarget,
    updatedAt: new Date(nowMs).toISOString(),
    value: payload,
    colonyAddress: payload.colonyAddress,
    // DAO Registry-compatible fields (REGISTRY.md RegistryItem)
    id: existingEntry?.id ?? crypto.randomUUID(),
    registryCategory: targetToRegistryCategory(currentTarget),
    name: payload.type || payload.name || payload.title || currentTarget,
    description: payload.description || '',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    createdAtMs: existingEntry?.createdAtMs ?? nowMs,
    updatedAtMs: nowMs,
    // SOC version counter – which Swarm feed index this entry was last written at
    ...(socIndex !== undefined ? { socIndex: socIndex.toString() } : {}),
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
const connectedWalletType = ref<string | null>(null);

const DEBUG_SAMPLE_INSTANCE = {
  category: 'food',
  type: 'Honey Poppy Drink',
  bio: false,
  quantity: 1000,
  price: {
    amount: 0,
    currency: '0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71',
    type: 'is',
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
            currency: '0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71',
            type: 'is',
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
            currency: '0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71',
            type: 'is',
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
            currency: '0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71',
            type: 'is',
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
            currency: '0x7a47605930002CC2Cd2c3c408D1F33fc2a18aB71',
            type: 'is',
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

function syncJsonFromTarget(force = false) {
  if (hasJsonError.value && !force) return;
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
const rightPanelOpen = computed(() => rightTab.value !== null);
const rightTabLabel = computed(() => {
  if (!rightTab.value) return 'Panel';
  const labels: Record<RightTab, string> = {
    ai: 'AI',
    flow: 'Inputs',
    lines: 'Lines',
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

// Handle tab clicks to toggle on/off
const handleTabToggle = (newTab: RightTab | null) => {
  if (rightTab.value === newTab) {
    // Clicking same tab again closes it
    rightTab.value = null;
  } else {
    // Clicking different tab opens it
    rightTab.value = newTab;
  }
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

  // Subscribe to AppKit account changes - this is the source of truth for wallet connection
  const unsubAppKit = onAppKitAccount(
    (info: { address: string; walletName: string } | null) => {
      if (info) {
        const currentAccount = (accountStore as any).account;
        const sameAddress =
          String(currentAccount?.address || '').toLowerCase() ===
          String(info.address || '').toLowerCase();
        const hasTxCapability =
          !!currentAccount &&
          typeof currentAccount.sendTransaction === 'function';

        // Preserve an existing tx-capable Thirdweb signer for the same address.
        if (!sameAddress || !hasTxCapability) {
          (accountStore as any).account = {
            address: info.address,
            signMessage: async ({ message }: { message: any }) => {
              try {
                // @ts-ignore
                const ethereum = window.ethereum;
                if (!ethereum) throw new Error('No ethereum provider');

                const providers = Array.isArray(ethereum.providers)
                  ? [ethereum, ...ethereum.providers]
                  : [ethereum];

                let provider = ethereum;
                for (const candidate of providers) {
                  try {
                    const accounts = (await candidate.request({
                      method: 'eth_accounts',
                    })) as string[];
                    if (
                      accounts?.some(
                        (address) =>
                          String(address).toLowerCase() ===
                          String(info.address).toLowerCase()
                      )
                    ) {
                      provider = candidate;
                      break;
                    }
                  } catch {
                    // keep checking other providers
                  }
                }

                const accounts = await provider.request({
                  method: 'eth_requestAccounts',
                });
                if (!accounts?.length) throw new Error('No accounts');
                const msgHex =
                  typeof message === 'object' && message.raw
                    ? Array.from(message.raw as Uint8Array)
                        .map((b: number) => b.toString(16).padStart(2, '0'))
                        .join('')
                    : message;
                const sig = await provider.request({
                  method: 'personal_sign',
                  params: [
                    typeof msgHex === 'string' && !msgHex.startsWith('0x')
                      ? '0x' + msgHex
                      : msgHex,
                    info.address,
                  ],
                });
                return sig;
              } catch (e) {
                throw e;
              }
            },
          };
        }
        connectedWalletType.value = info.walletName;
      } else {
        (accountStore as any).account = undefined;
        (accountStore as any).wallet = undefined;
        connectedWalletType.value = null;
      }
    }
  );

  // Also check email wallet
  if (emailAuthStore.email) {
    connectedWalletType.value = 'Email Wallet';
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

  // Store unsubscribe for cleanup
  appKitUnsubscribe.value = unsubAppKit;
});

const appKitUnsubscribe = ref<(() => void) | null>(null);

onUnmounted(() => {
  window.removeEventListener('ai-config-updated', refreshAiConfig);
  appKitUnsubscribe.value?.();
});

watch(
  () => emailAuthStore.email,
  (email) => {
    if (email) connectedWalletType.value = 'Email Wallet';
    else if (!accountStore.account?.address) connectedWalletType.value = null;
  }
);

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
watch(rightTab, (tab, prevTab) => {
  if (tab !== 'wizard') {
    decompositionStore.closeWizard();
  }

  // When leaving Lines, force-refresh JSON cache from the flow-backed model.
  if (prevTab === 'lines') {
    syncJsonFromTarget(true);
  }

  // When entering JSON, always show latest model state even if JSON had prior parse errors.
  if (tab === 'json') {
    syncJsonFromTarget(true);
  }
});

watch(
  selectedTarget,
  (next) => {
    if (
      next !== 'instance' &&
      (rightTab.value === 'flow' ||
        rightTab.value === 'eco' ||
        (rightTab.value === 'lines' && next !== 'knowHow'))
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

function onJsonTextareaInput(event: Event) {
  const next = (event.target as HTMLTextAreaElement | null)?.value ?? '';
  onJsonInput(next);
}

function getFocusableElements(container: ParentNode | null): HTMLElement[] {
  if (!container) return [];
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
    )
  );
  return nodes.filter((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if ((el as HTMLInputElement).readOnly) return false;
    return true;
  });
}

function pickNearest(currentRect: DOMRect, candidates: HTMLElement[]) {
  if (candidates.length === 0) return null;
  const cx = currentRect.left + currentRect.width / 2;
  const cy = currentRect.top + currentRect.height / 2;
  let best: { el: HTMLElement; score: number } | null = null;
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - cx;
    const dy = ey - cy;
    const score = Math.hypot(dx, dy);
    if (!best || score < best.score) {
      best = { el, score };
    }
  }
  return best?.el || null;
}

function focusTopmostInOutputNode(
  root: HTMLElement,
  currentRect: DOMRect
): boolean {
  const resourceNodes = Array.from(
    root.querySelectorAll<HTMLElement>('.resource-node')
  );
  const outputNodes = resourceNodes.filter((node) => {
    const t = node.querySelector<HTMLInputElement>('.title-input')?.value || '';
    return t.toLowerCase().includes('output');
  });
  if (outputNodes.length === 0) return false;
  outputNodes.sort(
    (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
  );
  const topOutput = outputNodes[0];
  const fields = getFocusableElements(topOutput);
  if (fields.length === 0) return false;
  fields.sort(
    (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
  );
  const nearest = pickNearest(currentRect, fields) || fields[0];
  nearest.focus();
  return true;
}

function handleLinesEnterNavigation(event: KeyboardEvent) {
  const isForwardNext =
    event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey);
  if (!isForwardNext) return;

  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    )
  ) {
    return;
  }

  const root = target.closest('.lines-tab-container') as HTMLElement | null;
  const node = target.closest(
    '.idef0-node, .resource-node'
  ) as HTMLElement | null;
  if (!root || !node) return;

  event.preventDefault();
  event.stopPropagation();

  const currentRect = target.getBoundingClientRect();
  const nodeFields = getFocusableElements(node).filter((el) => el !== target);

  // 1) Right within same node
  const rightCandidates = nodeFields.filter((el) => {
    const r = el.getBoundingClientRect();
    const sameRow =
      Math.abs(
        r.top + r.height / 2 - (currentRect.top + currentRect.height / 2)
      ) <= 20;
    return sameRow && r.left > currentRect.left + 4;
  });
  if (rightCandidates.length > 0) {
    rightCandidates.sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left
    );
    rightCandidates[0].focus();
    return;
  }

  // 2) Down within same node
  const downCandidates = nodeFields.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top > currentRect.top + 4;
  });
  if (downCandidates.length > 0) {
    downCandidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const dy = ra.top - rb.top;
      if (Math.abs(dy) > 6) return dy;
      return ra.left - rb.left;
    });
    downCandidates[0].focus();
    return;
  }

  // 3) Topmost input in output node
  if (focusTopmostInOutputNode(root, currentRect)) return;
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
  const mintContent = getMintContent();
  return api
    .post('/mint', {
      to: to.value,
      content: mintContent,
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

function getMintContent(): Pokedex {
  // If the user is editing JSON, prefer that exact payload when valid.
  if (selectedTarget.value === 'instance') {
    try {
      const parsed = JSON.parse(jsonText.value);
      const cleaned = stripBioFields(parsed) as Pokedex;
      value.value = cleaned;
      hasJsonError.value = false;
      jsonError.value = '';
      return cleaned;
    } catch {
      // Fallback to current model state when JSON is not parseable.
    }
  }

  return stripBioFields(JSON.parse(JSON.stringify(value.value)));
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
  if (selectedTarget.value === 'instance' && hasJsonError.value) {
    $q.notify({
      message: 'JSON is invalid. Fix JSON errors before minting.',
      color: 'negative',
    });
    return;
  }

  if (accountStore.account === undefined) {
    if (emailAuthStore.email) {
      return resolveEmailWalletRecipient()
        .then((address) => {
          if (!address) {
            $q.notify({
              message:
                'Email wallet address not found. Open Auth0 login to fetch it.',
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
