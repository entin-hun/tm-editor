<template>
  <q-page class="bg-grey-10 text-white" style="min-height: 100vh">
    <!-- ── Hero / Explainer ──────────────────────────────────────── -->
    <section class="hero q-pa-xl text-center">
      <div class="hero-logo q-mb-sm">
        <q-icon name="hub" size="56px" color="primary" />
      </div>
      <div class="text-h4 text-weight-bold q-mb-sm">trace.market Editor</div>
      <div
        class="text-subtitle1 text-grey-4 q-mb-md"
        style="max-width: 640px; margin: 0 auto"
      >
        Build verifiable, decentralised supply-chain records. Each entry is
        stored as a <strong>versioned Swarm feed</strong> (SOC) so every update
        is auditable and content-addressed on-chain.
      </div>
      <div class="row justify-center q-gutter-md q-mb-xl">
        <q-chip icon="location_on" color="dark" text-color="white" outline>
          GeoJSON Locations
        </q-chip>
        <q-chip
          icon="precision_manufacturing"
          color="dark"
          text-color="white"
          outline
        >
          Tools &amp; Machines
        </q-chip>
        <q-chip icon="menu_book" color="dark" text-color="white" outline>
          Know-How (AJV schema)
        </q-chip>
        <q-chip icon="inventory_2" color="dark" text-color="white" outline>
          Product Instances
        </q-chip>
        <q-chip icon="rss_feed" color="dark" text-color="white" outline>
          Versioned Swarm feed
        </q-chip>
      </div>
      <q-btn
        label="Open Full Editor"
        color="primary"
        icon="edit"
        size="lg"
        @click="$router.push('/editor')"
      />
    </section>

    <!-- ── Feature cards ────────────────────────────────────────── -->
    <section class="q-px-xl q-pb-xl">
      <div class="row q-gutter-lg justify-center">
        <!-- ── Location card ──────────────────────────────────── -->
        <q-card dark class="feature-card col-12 col-md-auto">
          <q-card-section class="card-header">
            <q-icon
              name="location_on"
              size="28px"
              color="positive"
              class="q-mr-sm"
            />
            <span class="text-h6">Location</span>
            <q-space />
            <q-btn-dropdown flat dense icon="more_vert" color="grey-5">
              <q-list dark>
                <q-item clickable v-close-popup @click="locationAction('load')">
                  <q-item-section avatar
                    ><q-icon name="cloud_download"
                  /></q-item-section>
                  <q-item-section>Load from feed</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="locationAction('delete')"
                  :disable="!locationDirty"
                >
                  <q-item-section avatar
                    ><q-icon name="delete" color="negative"
                  /></q-item-section>
                  <q-item-section class="text-negative"
                    >Delete draft</q-item-section
                  >
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="text-caption text-grey-5 q-mb-md">
              GeoJSON <code>Point</code> — longitude / latitude with optional
              interactive Mapbox map.
            </div>
            <SiteEditor v-model="locationDraft" label="site" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              label="Reset"
              icon="undo"
              :disable="!locationDirty"
              @click="locationAction('reset')"
            />
            <q-btn
              color="positive"
              :label="locationSaving ? 'Saving…' : 'Save to feed'"
              icon="save"
              :loading="locationSaving"
              @click="locationAction('save')"
            />
          </q-card-actions>
          <q-banner
            v-if="locationMsg"
            dense
            :class="locationMsgClass"
            class="q-mx-md q-mb-sm"
          >
            {{ locationMsg }}
          </q-banner>
        </q-card>

        <!-- ── Tool / Machine card ────────────────────────────── -->
        <q-card dark class="feature-card col-12 col-md-auto">
          <q-card-section class="card-header">
            <q-icon
              name="precision_manufacturing"
              size="28px"
              color="secondary"
              class="q-mr-sm"
            />
            <span class="text-h6">Tool / Machine</span>
            <q-space />
            <q-btn-dropdown flat dense icon="more_vert" color="grey-5">
              <q-list dark>
                <q-item clickable v-close-popup @click="machineAction('load')">
                  <q-item-section avatar
                    ><q-icon name="cloud_download"
                  /></q-item-section>
                  <q-item-section>Load from feed</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="machineAction('delete')"
                  :disable="!machineDirty"
                >
                  <q-item-section avatar
                    ><q-icon name="delete" color="negative"
                  /></q-item-section>
                  <q-item-section class="text-negative"
                    >Delete draft</q-item-section
                  >
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="text-caption text-grey-5 q-mb-md">
              Describe a physical tool, machine or software licence that your
              operation relies on.
            </div>
            <MachineInstanceEditor
              v-model="machineDraft"
              label="tool"
              :show-reference-hash="false"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              label="Reset"
              icon="undo"
              :disable="!machineDirty"
              @click="machineAction('reset')"
            />
            <q-btn
              color="secondary"
              :label="machineSaving ? 'Saving…' : 'Save to feed'"
              icon="save"
              :loading="machineSaving"
              @click="machineAction('save')"
            />
          </q-card-actions>
          <q-banner
            v-if="machineMsg"
            dense
            :class="machineMsgClass"
            class="q-mx-md q-mb-sm"
          >
            {{ machineMsg }}
          </q-banner>
        </q-card>

        <!-- ── Know-How card ──────────────────────────────────── -->
        <q-card dark class="feature-card col-12 col-md-auto">
          <q-card-section class="card-header">
            <q-icon
              name="menu_book"
              size="28px"
              color="primary"
              class="q-mr-sm"
            />
            <span class="text-h6">Know-How</span>
            <q-space />
            <q-btn
              flat
              dense
              icon="schema"
              color="grey-5"
              :class="{ 'text-primary': knowHowTab === 'lines' }"
              @click="knowHowTab = 'lines'"
            >
              <q-tooltip>Lines view</q-tooltip>
            </q-btn>
            <q-btn
              flat
              dense
              icon="verified"
              color="grey-5"
              :class="{ 'text-primary': knowHowTab === 'schema' }"
              @click="knowHowTab = 'schema'"
            >
              <q-tooltip>AJV schema</q-tooltip>
            </q-btn>
            <q-btn-dropdown flat dense icon="more_vert" color="grey-5">
              <q-list dark>
                <q-item clickable v-close-popup @click="knowHowAction('load')">
                  <q-item-section avatar
                    ><q-icon name="cloud_download"
                  /></q-item-section>
                  <q-item-section>Load from feed</q-item-section>
                </q-item>
                <q-item
                  clickable
                  v-close-popup
                  @click="knowHowAction('delete')"
                  :disable="!knowHowDirty"
                >
                  <q-item-section avatar
                    ><q-icon name="delete" color="negative"
                  /></q-item-section>
                  <q-item-section class="text-negative"
                    >Delete draft</q-item-section
                  >
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <div class="text-caption text-grey-5 q-mb-md">
              Document a reusable process method. Switch to
              <strong>Lines</strong> for the flow graph or
              <strong>Schema</strong> to validate against the generated AJV JSON
              Schema.
            </div>

            <!-- Lines tab: inline FlowEditor scoped to knowHow -->
            <div v-if="knowHowTab === 'lines'" class="know-how-lines">
              <KnowHowEditor
                v-model="knowHowDraft"
                label="know-how"
                :show-reference-hash="false"
              />
            </div>

            <!-- Schema tab: AJV validation panel -->
            <div v-else class="know-how-schema">
              <KnowHowSchemaPanel :know-how="knowHowDraft" />
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn
              flat
              label="Reset"
              icon="undo"
              :disable="!knowHowDirty"
              @click="knowHowAction('reset')"
            />
            <q-btn
              color="primary"
              :label="knowHowSaving ? 'Saving…' : 'Save to feed'"
              icon="save"
              :loading="knowHowSaving"
              @click="knowHowAction('save')"
            />
          </q-card-actions>
          <q-banner
            v-if="knowHowMsg"
            dense
            :class="knowHowMsgClass"
            class="q-mx-md q-mb-sm"
          >
            {{ knowHowMsg }}
          </q-banner>
        </q-card>
      </div>
    </section>

    <!-- ── Load-from-feed dialog ─────────────────────────────── -->
    <q-dialog v-model="loadDialogOpen">
      <q-card dark style="min-width: 420px; max-width: 92vw">
        <q-card-section class="text-subtitle1">
          Load from Swarm feed
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div v-if="feedItems.length === 0" class="text-caption text-grey-5">
            No saved entries found for <em>{{ loadDialogTopic }}</em
            >.
          </div>
          <q-list v-else dark separator>
            <q-item
              v-for="(entry, idx) in feedItems"
              :key="idx"
              clickable
              @click="applyFeedEntry(entry)"
            >
              <q-item-section>
                <q-item-label>{{
                  entry.name || entry.key || '(unnamed)'
                }}</q-item-label>
                <q-item-label caption>{{ entry.updatedAt }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  @click.stop="deleteFeedEntry(entry)"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { Bee } from '@ethersphere/bee-js';
import { KnowHow, MachineInstance, Site } from '@trace.market/types';
import { useAccountStore } from 'src/stores/account';
import SiteEditor from 'src/components/editors/SiteEditor.vue';
import MachineInstanceEditor from 'src/components/editors/MachineInstanceEditor.vue';
import KnowHowEditor from 'src/components/editors/KnowHowEditor.vue';
import KnowHowSchemaPanel from 'src/components/KnowHowSchemaPanel.vue';
import {
  clone,
  defaultKnowHow,
  defaultSite,
  defaultMachineInstance,
} from 'src/components/editors/defaults';

const router = useRouter();
const $q = useQuasar();
const accountStore = useAccountStore();

const swarmApiUrl = process.env.SWARM_API_URL as string | undefined;
const swarmBatchId = process.env.SWARM_BATCH as string | undefined;

// ── Draft state ──────────────────────────────────────────────────
const locationDraft = ref<Site>(clone(defaultSite));
const machineDraft = ref<MachineInstance>(clone(defaultMachineInstance));
const knowHowDraft = ref<KnowHow>(clone(defaultKnowHow));
const knowHowTab = ref<'lines' | 'schema'>('lines');

const locationSaving = ref(false);
const machineSaving = ref(false);
const knowHowSaving = ref(false);

const locationMsg = ref('');
const machineMsg = ref('');
const knowHowMsg = ref('');

const locationMsgClass = computed(() =>
  locationMsg.value.startsWith('✓')
    ? 'bg-positive text-white'
    : 'bg-negative text-white'
);
const machineMsgClass = computed(() =>
  machineMsg.value.startsWith('✓')
    ? 'bg-positive text-white'
    : 'bg-negative text-white'
);
const knowHowMsgClass = computed(() =>
  knowHowMsg.value.startsWith('✓')
    ? 'bg-positive text-white'
    : 'bg-negative text-white'
);

// ── Dirty tracking ───────────────────────────────────────────────
const locationDirty = ref(false);
const machineDirty = ref(false);
const knowHowDirty = ref(false);

watch(
  locationDraft,
  () => {
    locationDirty.value = true;
  },
  { deep: true }
);
watch(
  machineDraft,
  () => {
    machineDirty.value = true;
  },
  { deep: true }
);
watch(
  knowHowDraft,
  () => {
    knowHowDirty.value = true;
  },
  { deep: true }
);

// ── Load dialog ──────────────────────────────────────────────────
const loadDialogOpen = ref(false);
const loadDialogTopic = ref('');
const feedItems = ref<any[]>([]);
let loadDialogTarget: 'location' | 'machine' | 'knowHow' = 'location';

// ── Swarm helpers ────────────────────────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function getSwarmSigner() {
  const account = accountStore.account as any;
  if (!account?.address || !account?.signMessage)
    throw new Error('Wallet not connected');
  return {
    address: hexToBytes(account.address as string),
    sign: async (digest: Uint8Array) => {
      let sig: unknown;
      try {
        sig = await account.signMessage({ message: { raw: digest } });
      } catch {
        const hex = `0x${Array.from(digest)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`;
        sig = await account.signMessage({ message: hex });
      }
      return sig instanceof Uint8Array ? sig : hexToBytes(sig as string);
    },
  } as any;
}

async function readFeed(topic: string): Promise<any[]> {
  if (!swarmApiUrl || !accountStore.account) return [];
  const bee = new Bee(swarmApiUrl);
  const t = bee.makeFeedTopic(topic);
  const reader = bee.makeFeedReader(
    'sequence',
    t,
    accountStore.account.address as string
  );
  try {
    const update = await reader.download();
    if (!update.reference) return [];
    const data = await bee.downloadData(update.reference as any);
    const parsed = JSON.parse(new TextDecoder().decode(data));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFeed(topic: string, items: any[]): Promise<void> {
  if (!swarmApiUrl || !swarmBatchId) throw new Error('Swarm not configured');
  if (!accountStore.account) throw new Error('Wallet not connected');
  const bee = new Bee(swarmApiUrl);
  const signer = await getSwarmSigner();
  const t = bee.makeFeedTopic(topic);
  const writer = bee.makeFeedWriter('sequence', t, signer);
  const reader = bee.makeFeedReader(
    'sequence',
    t,
    accountStore.account.address as string
  );

  let nextIndexHex = '0000000000000000';
  try {
    const cur = await reader.download();
    nextIndexHex = (cur as any).feedIndexNext || '0000000000000000';
  } catch {
    /* first save */
  }

  const upload = await bee.uploadData(swarmBatchId, JSON.stringify(items));
  await writer.upload(swarmBatchId, upload.reference, {
    index: nextIndexHex as any,
  });
}

// ── upsert helper ────────────────────────────────────────────────
async function upsertEntry(
  existing: any[],
  value: any,
  key: string
): Promise<any[]> {
  const list = [...existing];
  const idx = list.findIndex((e) => e.key === key);
  const nowMs = Date.now();
  const entry = {
    key,
    updatedAt: new Date(nowMs).toISOString(),
    updatedAtMs: nowMs,
    createdAtMs: (idx >= 0 ? list[idx].createdAtMs : null) ?? nowMs,
    id: (idx >= 0 ? list[idx].id : null) ?? crypto.randomUUID(),
    value,
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  return list;
}

function setMsg(kind: 'location' | 'machine' | 'knowHow', msg: string) {
  if (kind === 'location') locationMsg.value = msg;
  else if (kind === 'machine') machineMsg.value = msg;
  else knowHowMsg.value = msg;
  setTimeout(() => {
    if (kind === 'location') locationMsg.value = '';
    else if (kind === 'machine') machineMsg.value = '';
    else knowHowMsg.value = '';
  }, 4000);
}

// ── Actions ──────────────────────────────────────────────────────
async function locationAction(action: 'save' | 'load' | 'reset' | 'delete') {
  if (action === 'reset') {
    locationDraft.value = clone(defaultSite);
    locationDirty.value = false;
    return;
  }
  if (action === 'load') {
    await openLoadDialog('tm-editor-location', 'location');
    return;
  }
  if (action === 'delete') {
    locationDraft.value = clone(defaultSite);
    locationDirty.value = false;
    setMsg('location', '✓ Draft cleared');
    return;
  }

  locationSaving.value = true;
  try {
    const existing = await readFeed('tm-editor-location');
    const key = locationDraft.value.label ||
      `${locationDraft.value.location?.coordinates?.[0] ?? 0},${locationDraft.value.location?.coordinates?.[1] ?? 0}`;
    const next = await upsertEntry(existing, locationDraft.value, key);
    await writeFeed('tm-editor-location', next);
    locationDirty.value = false;
    setMsg('location', '✓ Saved to Swarm feed');
  } catch (e: any) {
    setMsg('location', e.message || 'Save failed');
  } finally {
    locationSaving.value = false;
  }
}

async function machineAction(action: 'save' | 'load' | 'reset' | 'delete') {
  if (action === 'reset') {
    machineDraft.value = clone(defaultMachineInstance);
    machineDirty.value = false;
    return;
  }
  if (action === 'load') {
    await openLoadDialog('tm-editor-machine', 'machine');
    return;
  }
  if (action === 'delete') {
    machineDraft.value = clone(defaultMachineInstance);
    machineDirty.value = false;
    setMsg('machine', '✓ Draft cleared');
    return;
  }

  machineSaving.value = true;
  try {
    const existing = await readFeed('tm-editor-machine');
    const key =
      machineDraft.value.ownerId ||
      machineDraft.value.category ||
      String(Date.now());
    const next = await upsertEntry(existing, machineDraft.value, key);
    await writeFeed('tm-editor-machine', next);
    machineDirty.value = false;
    setMsg('machine', '✓ Saved to Swarm feed');
  } catch (e: any) {
    setMsg('machine', e.message || 'Save failed');
  } finally {
    machineSaving.value = false;
  }
}

async function knowHowAction(action: 'save' | 'load' | 'reset' | 'delete') {
  if (action === 'reset') {
    knowHowDraft.value = clone(defaultKnowHow);
    knowHowDirty.value = false;
    return;
  }
  if (action === 'load') {
    await openLoadDialog('tm-editor-knowHow', 'knowHow');
    return;
  }
  if (action === 'delete') {
    knowHowDraft.value = clone(defaultKnowHow);
    knowHowDirty.value = false;
    setMsg('knowHow', '✓ Draft cleared');
    return;
  }

  knowHowSaving.value = true;
  try {
    const existing = await readFeed('tm-editor-knowHow');
    const key =
      knowHowDraft.value.hash || knowHowDraft.value.owner || String(Date.now());
    const next = await upsertEntry(existing, knowHowDraft.value, key);
    await writeFeed('tm-editor-knowHow', next);
    knowHowDirty.value = false;
    setMsg('knowHow', '✓ Saved to Swarm feed');
  } catch (e: any) {
    setMsg('knowHow', e.message || 'Save failed');
  } finally {
    knowHowSaving.value = false;
  }
}

// ── Load dialog helpers ──────────────────────────────────────────
async function openLoadDialog(topic: string, target: typeof loadDialogTarget) {
  loadDialogTopic.value = topic;
  loadDialogTarget = target;
  feedItems.value = await readFeed(topic);
  loadDialogOpen.value = true;
}

function applyFeedEntry(entry: any) {
  const v = entry.value ?? entry;
  if (loadDialogTarget === 'location') {
    locationDraft.value = v as Site;
    locationDirty.value = false;
  } else if (loadDialogTarget === 'machine') {
    machineDraft.value = v as MachineInstance;
    machineDirty.value = false;
  } else {
    knowHowDraft.value = v as KnowHow;
    knowHowDirty.value = false;
  }
  loadDialogOpen.value = false;
}

async function deleteFeedEntry(entry: any) {
  const existing = await readFeed(loadDialogTopic.value);
  const next = existing.filter((e) => e.key !== entry.key && e.id !== entry.id);
  await writeFeed(loadDialogTopic.value, next);
  feedItems.value = next;
}
</script>

<style scoped>
.hero {
  background: linear-gradient(160deg, #0d1117 0%, #11161b 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.feature-card {
  background: #11161b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 340px;
  max-width: 440px;
  flex: 1 1 340px;
}
.card-header {
  display: flex;
  align-items: center;
  padding-bottom: 4px;
}
.know-how-lines,
.know-how-schema {
  min-height: 120px;
}
</style>
