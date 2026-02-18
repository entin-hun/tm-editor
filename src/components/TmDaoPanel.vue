<template>
  <div class="q-pa-lg">
    <div class="column q-gutter-lg">
      <q-card>
        <q-card-section class="q-pb-sm">
          <div class="row items-center justify-between no-wrap">
            <div>
              <div class="text-h6">Wallet & Network</div>
              <div class="text-subtitle2 text-grey-7">
                Connect to start interacting with Colony
              </div>
            </div>
            <!-- Wallet/Network Status Indicator -->
            <div class="text-right">
              <div class="text-caption text-grey-7">
                {{ networkStatus }}
                <q-badge
                  v-if="networkName"
                  :color="networkMismatch ? 'negative' : 'secondary'"
                  class="q-ml-sm"
                >
                  {{ networkName }}
                </q-badge>
              </div>
            </div>
          </div>

          <!-- Network Mismatch Warning -->
          <div
            v-if="networkMismatch && colonyAddress"
            class="q-mt-sm row items-center q-gutter-sm bg-red-1 q-pa-sm rounded-borders text-negative"
          >
            <q-icon name="warning" size="sm" />
            <div class="col">
              Wallet network does not match selected Colony network.
            </div>
            <q-btn
              flat
              color="primary"
              label="Switch"
              dense
              @click="switchWalletNetwork"
            />
          </div>
          <div v-else-if="walletError" class="q-mt-sm text-negative">
            {{ walletError }}
          </div>

          <!-- Colony Address & Label Row -->
          <div class="row q-col-gutter-sm items-center q-mt-md">
            <div class="col-12 col-md-7">
              <q-input
                v-model="colonyAddress"
                label="Colony Address"
                outlined
                placeholder="0x... or numeric ID"
                @blur="handleColonyBlur"
                dense
              >
                <template v-slot:append>
                  <q-icon
                    v-if="colonyLoading"
                    name="hourglass_empty"
                    class="cursor-pointer animate-spin"
                  />
                  <q-icon v-else name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-5">
              <div
                v-if="colonyLabel"
                class="text-h6 text-primary q-pl-md"
                style="
                  line-height: 40px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                "
              >
                {{ colonyLabel }}
              </div>
              <div
                v-else
                class="text-grey-5 q-pl-md text-italic"
                style="line-height: 40px"
              >
                (No Colony Loaded)
              </div>
            </div>
          </div>

          <div class="text-caption text-grey-7 q-mt-xs q-pl-xs">
            DAO Network: <span class="text-weight-bold">Arbitrum One</span>
          </div>

          <div class="q-mt-sm text-grey-7">
            {{ colonyStatus }}
          </div>
          <div v-if="colonyError" class="q-mt-sm text-negative">
            {{ colonyError }}
          </div>
        </q-card-section>
        <q-separator />
      </q-card>

      <q-card>
        <q-card-section class="row items-center justify-between q-pb-sm">
          <div>
            <div class="text-h6">Dashboard</div>
            <div class="text-subtitle2 text-grey-7">
              Overview of cooperative performance, team balances, and
              contributors.
            </div>
          </div>
          <q-btn
            outline
            color="primary"
            label="Refresh Colony"
            @click="refreshColony"
            dense
          />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-subtitle2 text-grey-7 q-mb-sm">
            Skill Teams (Sub-skills)
          </div>
          <q-list bordered separator>
            <q-expansion-item
              v-for="team in teams"
              :key="team.id"
              :label="team.name"
            >
              <q-card flat>
                <q-card-section>
                  <div class="text-caption text-grey-7">
                    Funding Pot: {{ team.fundingPotId }}
                  </div>
                  <div class="text-caption text-grey-7">
                    Balance: {{ team.balance }} {{ tokenSymbol }}
                  </div>
                  <div class="text-caption text-grey-7 q-mt-sm">
                    Contributors
                  </div>
                  <q-list bordered separator class="q-mt-sm">
                    <q-item
                      v-for="contributor in team.contributors"
                      :key="contributor.address"
                    >
                      <q-item-section>
                        <q-item-label>{{ contributor.address }}</q-item-label>
                        <q-item-label caption>
                          {{ contributor.balance }} {{ tokenSymbol }}
                        </q-item-label>
                        <q-linear-progress
                          class="q-mt-xs"
                          :value="Number(contributor.percentage) / 100"
                          color="primary"
                        />
                      </q-item-section>
                      <q-item-section side>
                        <q-item-label
                          >{{ contributor.percentage }}%</q-item-label
                        >
                      </q-item-section>
                    </q-item>
                    <q-item v-if="team.contributors.length === 0">
                      <q-item-section>
                        <q-item-label>No contributors found.</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>
              </q-card>
            </q-expansion-item>
            <q-item v-if="teams.length === 0">
              <q-item-section>
                <q-item-label>No skill teams loaded yet.</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <q-separator class="q-my-md" />
          <div class="text-subtitle2 text-grey-7 q-mb-sm">Create Sub-skill</div>
          <div class="row q-col-gutter-sm items-end">
            <div class="col-12 col-md-4">
              <q-select
                v-model="subSkillParentId"
                :options="teamOptions"
                label="Parent Skill Team"
                outlined
                emit-value
                map-options
                dense
              />
            </div>
            <div class="col-12 col-md-5">
              <q-input
                v-model="subSkillName"
                label="Sub-skill Name"
                outlined
                dense
              />
            </div>
            <div class="col-12 col-md-3">
              <q-btn
                color="primary"
                label="Create Sub-skill"
                @click="createSubSkill"
                dense
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card>
        <q-card-section class="q-pb-sm">
          <div class="text-h6">Members</div>
          <div class="text-subtitle2 text-grey-7">
            Invite new members by minting tokens to them.
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="row q-col-gutter-sm items-end">
            <div class="col-12 col-md-6">
              <q-input
                v-model="inviteAddress"
                label="Wallet Address"
                outlined
                dense
              />
            </div>
            <div class="col-12 col-md-3">
              <q-input
                v-model="inviteAmount"
                label="Token Amount"
                outlined
                dense
              />
            </div>
            <div class="col-12 col-md-3">
              <q-btn
                color="primary"
                label="Invite Member"
                @click="inviteMember"
                dense
                icon="person_add"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card>
        <q-card-section class="q-pb-sm">
          <div class="text-h6">Tasks</div>
          <div class="text-subtitle2 text-grey-7">
            Create tasks with rich specs, assign teams, and release payments.
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-md-6">
              <q-select
                v-model="taskTeamId"
                :options="teamOptions"
                label="Sub-skill"
                outlined
                emit-value
                map-options
                dense
              />
            </div>
            <div class="col-12 col-md-6">
              <TimestampInput v-model="taskDueDate" label="Due Date" />
            </div>
          </div>
          <div class="row q-col-gutter-sm q-mt-sm">
            <div class="col-12 col-md-6">
              <q-input
                v-model="taskBudgetAmount"
                label="Budget Amount"
                outlined
                dense
              />
            </div>
            <div class="col-12 col-md-6">
              <q-select
                v-model="taskBudgetToken"
                :options="tokenOptions"
                label="Budget Token"
                outlined
                emit-value
                map-options
                dense
                :disable="tokenOptions.length === 0"
              />
            </div>
          </div>
          <div class="q-mt-md">
            <q-editor
              v-model="taskSpecHtml"
              :toolbar="editorToolbar"
              min-height="120px"
            />
            <div class="text-caption text-grey-7 q-mt-xs">
              {{ taskSpecStatus }}
            </div>
          </div>
          <div class="q-mt-md">
            <q-btn
              color="primary"
              label="Create Task"
              @click="createTask"
              dense
            />
          </div>
        </q-card-section>
      </q-card>

      <q-card>
        <q-card-section>
          <div class="text-h6">Governance</div>
          <div class="text-subtitle2 text-grey-7">
            Propose motions and stake reputation in disputes.
          </div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="text-subtitle2 text-grey-7 q-mb-sm">
            Guided Action Builder
          </div>
          <q-tabs
            v-model="motionTab"
            dense
            active-color="primary"
            indicator-color="primary"
            align="left"
          >
            <q-tab name="metadata" label="Update Metadata" />
            <q-tab name="transfer" label="Request Token Transfer" />
          </q-tabs>
          <q-separator class="q-my-md" />

          <div v-if="motionTab === 'metadata'">
            <q-input
              v-model="metadataJson"
              type="textarea"
              autogrow
              label="Metadata JSON (will upload to Swarm if long)"
              outlined
            />
            <div class="q-mt-md">
              <q-btn
                outline
                color="primary"
                label="Upload Metadata to Swarm"
                @click="uploadMetadata"
              />
              <q-btn
                class="q-ml-sm"
                outline
                color="primary"
                label="Build Metadata Action"
                @click="buildMetadataAction"
              />
            </div>
          </div>

          <div v-else>
            <div class="row q-col-gutter-sm">
              <div class="col-12 col-md-4">
                <q-select
                  v-model="transferPermissionDomainId"
                  :options="teamOptions"
                  label="Permission Skill Team"
                  outlined
                  emit-value
                  map-options
                  dense
                />
                <div class="text-caption text-grey-7 q-mt-xs">
                  Team that grants permissions for this motion.
                </div>
              </div>
              <div class="col-12 col-md-4">
                <q-input
                  v-model.number="transferChildSkillIndex"
                  type="number"
                  label="Child Skill Index"
                  outlined
                  dense
                />
                <div class="text-caption text-grey-7 q-mt-xs">
                  0 for same team; use child index when nesting teams.
                </div>
              </div>
              <div class="col-12 col-md-4">
                <q-select
                  v-model="transferTeamId"
                  :options="teamOptions"
                  label="Sub-skill"
                  outlined
                  emit-value
                  map-options
                  dense
                />
              </div>
            </div>
            <div class="row q-col-gutter-sm q-mt-sm">
              <div class="col-12 col-md-6">
                <q-input
                  v-model="transferRecipient"
                  label="Recipient"
                  outlined
                  dense
                />
              </div>
              <div class="col-12 col-md-3">
                <q-input
                  v-model="transferAmount"
                  label="Amount"
                  outlined
                  dense
                />
              </div>
            </div>
            <div class="q-mt-md">
              <q-input
                v-model="transferToken"
                label="Token Address (optional)"
                outlined
                dense
              />
            </div>
            <div class="q-mt-md">
              <q-btn
                outline
                color="primary"
                label="Build Transfer Action"
                @click="buildTransferAction"
                dense
              />
            </div>
          </div>

          <div class="q-mt-lg">
            <div class="text-subtitle2 text-grey-7">Motion Payload</div>
            <div class="row q-col-gutter-sm q-mt-sm">
              <div class="col-12 col-md-4">
                <q-input
                  v-model.number="motionDomainId"
                  type="number"
                  label="Skill Team ID"
                  outlined
                  dense
                />
              </div>
              <div class="col-12 col-md-8">
                <q-input
                  v-model="motionAltTarget"
                  label="Alt Target (0x0 for colony)"
                  outlined
                  dense
                />
                <div class="text-caption text-grey-7 q-mt-xs">
                  Use 0x0 for colony actions. Set a contract address only for
                  extensions.
                </div>
              </div>
            </div>
            <div class="q-mt-md">
              <q-input
                v-model="motionAction"
                label="Action (hex bytes)"
                outlined
                dense
              />
            </div>
            <div class="q-mt-md">
              <q-btn
                color="primary"
                label="Create Motion"
                @click="createMotion"
                dense
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useWalletStore } from 'src/stores/wallet';
import { useColonyStore } from 'src/stores/colony';
import TimestampInput from 'src/components/editors/TimestampInput.vue';

defineOptions({
  name: 'TmDaoPanel',
});

const $q = useQuasar();
const walletStore = useWalletStore();
const colonyStore = useColonyStore();

const walletAddress = computed(() => walletStore.address || '');
const chainId = computed(() =>
  walletStore.chainId ? String(walletStore.chainId) : ''
);
const networkStatus = computed(() => walletStore.networkStatus);
const walletError = computed(() => walletStore.lastError || '');
const canInitNetwork = computed(() => Boolean(walletStore.address));
const networkName = computed(() => {
  switch (walletStore.chainId) {
    case 1:
      return 'Mainnet';
    case 5:
      return 'Goerli';
    case 100:
      return 'Gnosis';
    case 42161:
      return 'Arbitrum One';
    case 421614:
      return 'Arbitrum Sepolia';
    default:
      return walletStore.chainId ? `Chain ${walletStore.chainId}` : '';
  }
});
const preferredNetwork = ref<string>('ArbitrumOne');

const colonyAddress = ref('');
const colonyLabel = computed(() => colonyStore.colonyLabel || '');
const tokenSymbol = computed(() => colonyStore.tokenInfo?.symbol || '');
const tokenAddress = computed(() => colonyStore.tokenInfo?.address || '');
const tokenOptions = computed(() =>
  colonyStore.tokenInfo
    ? [
        {
          label: `${colonyStore.tokenInfo.symbol} (${colonyStore.tokenInfo.address})`,
          value: colonyStore.tokenInfo.address,
        },
      ]
    : []
);
const teams = computed(() => colonyStore.teams);
const teamOptions = computed(() =>
  teams.value.map((team) => ({ label: team.name, value: team.id }))
);
const colonyStatus = computed(() => colonyStore.status);
const colonyLoading = computed(() => colonyStore.loading);
const colonyError = computed(() => colonyStore.lastError || '');
const canLoadColony = computed(
  () => walletStore.networkClientReady && colonyAddress.value.trim().length > 0
);
const networkMismatch = computed(() => {
  if (!walletStore.chainId || !preferredNetwork.value) {
    return false;
  }
  if (preferredNetwork.value === 'Xdai') {
    return walletStore.chainId !== 100;
  }
  if (preferredNetwork.value === 'ArbitrumOne') {
    return walletStore.chainId !== 42161;
  }
  if (preferredNetwork.value === 'ArbitrumSepolia') {
    return walletStore.chainId !== 421614;
  }
  if (preferredNetwork.value === 'Mainnet') {
    return walletStore.chainId !== 1;
  }
  if (preferredNetwork.value === 'Goerli') {
    return walletStore.chainId !== 5;
  }
  return false;
});

const taskTeamId = ref<number | null>(null);
const taskDueDate = ref<number | undefined>(undefined);
const taskSpecHtml = ref('');
const taskSpecSwarmUrl = ref('');
const taskSpecStatus = ref('');
const taskBudgetAmount = ref('');
const taskBudgetToken = ref('');
const editorToolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  ['quote', 'unordered', 'ordered', 'outdent', 'indent'],
  ['link', 'hr'],
  ['formatting'],
];

const subSkillParentId = ref<number | null>(null);
const subSkillName = ref('');

const motionDomainId = ref(1);
const motionAltTarget = ref('0x0000000000000000000000000000000000000000');
const motionAction = ref('0x');
const motionTab = ref<'metadata' | 'transfer'>('metadata');
const metadataJson = ref('');

const transferPermissionDomainId = ref<number | null>(null);
const transferChildSkillIndex = ref(0);
const transferTeamId = ref<number | null>(null);
const transferRecipient = ref('');
const transferAmount = ref('');
const transferToken = ref('');

const inviteAddress = ref('');
const inviteAmount = ref('');

let taskSpecTimer: ReturnType<typeof setTimeout> | undefined;
let colonyLoadTimer: ReturnType<typeof setTimeout> | undefined;
const lastLoadedColony = ref('');
const isAutoInitializing = ref(false);

async function connectWallet() {
  try {
    await walletStore.connect();
    $q.notify({
      message: 'Wallet connected.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    $q.notify({
      message: 'Wallet connection failed.',
      color: 'negative',
      icon: 'error',
    });
  }
}

async function initColonyNetwork() {
  try {
    await walletStore.initNetworkClient(preferredNetwork.value as any);
    $q.notify({
      message: 'Colony network client ready.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to init network client.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

async function switchWalletNetwork() {
  try {
    await walletStore.suggestNetworkSwitch(preferredNetwork.value as any);
    $q.notify({
      message: 'Switch request sent to wallet.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to switch wallet network.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

async function loadColony() {
  try {
    await colonyStore.loadColony(colonyAddress.value);
    lastLoadedColony.value = colonyAddress.value.trim();
    $q.notify({ message: 'Colony loaded.', color: 'primary', icon: 'check' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load colony.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

async function refreshColony() {
  try {
    await colonyStore.refreshColony();
    $q.notify({
      message: 'Colony refreshed.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to refresh colony.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

async function inviteMember() {
  try {
    if (!inviteAddress.value || !inviteAmount.value) {
      throw new Error('Address and amount are required.');
    }
    await colonyStore.mintTokens({
      address: inviteAddress.value,
      amount: inviteAmount.value,
    });
    inviteAddress.value = '';
    inviteAmount.value = '';
    $q.notify({
      message: 'Member invited (tokens minted).',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to invite member.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

async function createTask() {
  try {
    if (!taskTeamId.value) {
      throw new Error('Select a sub-skill for this task.');
    }
    if (!taskSpecSwarmUrl.value) {
      throw new Error('Task spec not yet uploaded to Swarm.');
    }
    const selectedTeam = teams.value.find(
      (team) => team.id === taskTeamId.value
    );
    const skillId = Number(selectedTeam?.skillId || 0);
    await colonyStore.createTask({
      specification: taskSpecSwarmUrl.value,
      domainId: taskTeamId.value,
      skillId,
      dueDate: taskDueDate.value ? Number(taskDueDate.value) : 0,
    });
    $q.notify({
      message: 'Task transaction submitted.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create task.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

async function createMotion() {
  try {
    await colonyStore.createMotion({
      domainId: motionDomainId.value,
      altTarget: motionAltTarget.value,
      action: motionAction.value,
    });
    $q.notify({
      message: 'Motion transaction submitted.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create motion.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

async function uploadMetadata() {
  try {
    const result = await colonyStore.uploadMetadataToSwarm(metadataJson.value);
    metadataJson.value = result.url;
    $q.notify({
      message: 'Metadata uploaded to Swarm.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to upload metadata.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

async function uploadTaskSpecBackground() {
  if (!taskSpecHtml.value) {
    taskSpecStatus.value = 'Task spec is empty.';
    taskSpecSwarmUrl.value = '';
    return;
  }
  try {
    taskSpecStatus.value = 'Uploading task spec to Swarm...';
    const payload = JSON.stringify({
      html: taskSpecHtml.value,
      budget: taskBudgetAmount.value
        ? {
            amount: taskBudgetAmount.value,
            token: taskBudgetToken.value || tokenAddress.value,
          }
        : undefined,
    });
    const result = await colonyStore.uploadTaskSpecToSwarm(payload);
    taskSpecSwarmUrl.value = result.url;
    taskSpecStatus.value = `Saved to ${result.url}`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to upload task spec.';
    taskSpecStatus.value = message;
  }
}

async function createSubSkill() {
  try {
    if (!subSkillParentId.value) {
      throw new Error('Select a parent skill team.');
    }
    await colonyStore.createSubSkill({
      parentDomainId: subSkillParentId.value,
      name: subSkillName.value,
    });
    subSkillName.value = '';
    $q.notify({
      message: 'Sub-skill created.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create sub-skill.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

function buildMetadataAction() {
  try {
    const action = colonyStore.buildEditColonyAction(metadataJson.value);
    motionAction.value = action;
    motionAltTarget.value = '0x0000000000000000000000000000000000000000';
    $q.notify({
      message: 'Metadata action built.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to build metadata action.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

function buildTransferAction() {
  try {
    if (!transferTeamId.value) {
      throw new Error('Select a team for transfer.');
    }
    const permissionDomainId =
      transferPermissionDomainId.value ?? transferTeamId.value;
    if (!permissionDomainId) {
      throw new Error('Select a permission team for transfer.');
    }
    const selectedTeam = teams.value.find(
      (team) => team.id === transferTeamId.value
    );
    const skillId = Number(selectedTeam?.skillId || 0);
    const action = colonyStore.buildAddPaymentAction({
      permissionDomainId,
      childSkillIndex: transferChildSkillIndex.value,
      recipient: transferRecipient.value,
      token: transferToken.value,
      amount: transferAmount.value,
      domainId: transferTeamId.value,
      skillId,
    });
    motionAction.value = action;
    motionAltTarget.value = '0x0000000000000000000000000000000000000000';
    $q.notify({
      message: 'Transfer action built.',
      color: 'primary',
      icon: 'check',
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to build transfer action.';
    $q.notify({ message, color: 'negative', icon: 'error' });
  }
}

onMounted(() => {
  const storedColony = localStorage.getItem('tm-dao.colony');
  if (storedColony) {
    colonyAddress.value = storedColony;
  }
});

// Auto-load colony when network client becomes ready and we have an address
watch(
  [() => walletStore.networkClientReady, colonyAddress],
  async ([isReady, address]) => {
    if (
      isReady &&
      address &&
      address.trim().length > 0 &&
      address !== lastLoadedColony.value &&
      !colonyStore.loading
    ) {
      await loadColony();
    }
  },
  { immediate: true }
);

watch(teams, (value) => {
  if (!taskTeamId.value && value.length > 0) {
    taskTeamId.value = value[0].id;
  }
  if (!subSkillParentId.value && value.length > 0) {
    subSkillParentId.value = value[0].id;
  }
  if (!transferPermissionDomainId.value && value.length > 0) {
    transferPermissionDomainId.value = value[0].id;
  }
  if (!transferTeamId.value && value.length > 0) {
    transferTeamId.value = value[0].id;
  }
});

watch(tokenAddress, (value) => {
  if (value && !taskBudgetToken.value) {
    taskBudgetToken.value = value;
  }
});

watch([taskSpecHtml, taskBudgetAmount, taskBudgetToken], () => {
  if (taskSpecTimer) {
    clearTimeout(taskSpecTimer);
  }
  taskSpecTimer = setTimeout(() => {
    uploadTaskSpecBackground();
  }, 800);
});

watch(
  [preferredNetwork, () => walletStore.address, () => walletStore.chainId],
  async () => {
    if (!walletStore.address || walletStore.networkClientReady) {
      return;
    }
    if (networkMismatch.value || isAutoInitializing.value) {
      return;
    }
    isAutoInitializing.value = true;
    try {
      await initColonyNetwork();
    } finally {
      isAutoInitializing.value = false;
    }
  },
  { immediate: true }
);

watch(colonyAddress, (value) => {
  if (value) {
    localStorage.setItem('tm-dao.colony', value);
  } else {
    localStorage.removeItem('tm-dao.colony');
  }
  if (colonyLoadTimer) {
    clearTimeout(colonyLoadTimer);
  }
  colonyLoadTimer = setTimeout(() => {
    queueAutoLoadColony();
  }, 600);
});

function queueAutoLoadColony() {
  const trimmed = colonyAddress.value.trim();
  if (!trimmed || !canLoadColony.value || networkMismatch.value) {
    return;
  }
  if (trimmed === lastLoadedColony.value) {
    return;
  }
  loadColony();
}

function handleColonyBlur() {
  if (colonyLoadTimer) {
    clearTimeout(colonyLoadTimer);
  }
  queueAutoLoadColony();
}
</script>
