<template>
  <q-page padding>
    <div class="row q-col-gutter-md justify-center">
      <div class="col-12 col-md-8">
        <q-card>
          <q-card-section>
            <div class="text-h6">Merkle Tree Inclusion Proof</div>
            <div class="text-subtitle2 text-grey-7">
              Verify that an item (Slug) is included in a specific Swarm Feed.
              This utility downloads the feed, constructs a Merkle Tree of all
              items, and generates an inclusion proof for the target item.
            </div>
          </q-card-section>

          <q-card-section>
            <div class="column q-gutter-md">
              <q-input
                v-model="ownerAddress"
                label="Owner Address (Wallet)"
                outlined
                dense
                placeholder="0x..."
              />

              <q-select
                v-model="selectedTopic"
                :options="feedTopicOptions"
                label="Feed Topic"
                outlined
                dense
                emit-value
                map-options
              />

              <q-input
                v-model="targetSlug"
                label="Item Slug (Reference)"
                outlined
                dense
                placeholder="Item Key/ID"
              />

              <div class="row justify-end">
                <q-btn
                  label="Generate Proof"
                  color="primary"
                  :loading="loading"
                  @click="generateProof"
                />
              </div>
            </div>
          </q-card-section>

          <q-separator v-if="result" />

          <q-card-section v-if="result">
            <div
              v-if="result.error"
              class="text-negative bg-red-1 q-pa-sm rounded-borders"
            >
              <q-icon name="error" /> {{ result.error }}
            </div>
            <div v-else>
              <div class="text-h6 text-positive row items-center">
                <q-icon name="check_circle" class="q-mr-sm" />
                Verified
              </div>
              <div class="q-mt-md">
                <div class="text-weight-bold">Merkle Root:</div>
                <div
                  class="bg-grey-2 q-pa-sm rounded-borders text-caption break-all font-mono"
                >
                  {{ result.root }}
                </div>
              </div>

              <div class="q-mt-md">
                <div class="text-weight-bold">Leaf Hash (Target):</div>
                <div
                  class="bg-grey-2 q-pa-sm rounded-borders text-caption break-all font-mono"
                >
                  {{ result.leaf }}
                </div>
              </div>

              <div class="q-mt-md">
                <div class="text-weight-bold">Metrics:</div>
                <div>Total Items: {{ result.totalItems }}</div>
                <div>Target Index: {{ result.index }}</div>
              </div>

              <div class="q-mt-md">
                <div class="text-weight-bold">Inclusion Proof (Siblings):</div>
                <div
                  v-if="result.proof.length === 0"
                  class="text-grey-7 text-italic"
                >
                  No siblings (Tree has only 1 item).
                </div>
                <div v-else class="column q-gutter-xs q-mt-xs">
                  <div
                    v-for="(hash, idx) in result.proof"
                    :key="idx"
                    class="bg-grey-2 q-pa-xs rounded-borders text-caption break-all font-mono"
                  >
                    {{ hash }}
                  </div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h6">ZKP Experiment (Alpha)</div>
            <div class="text-subtitle2 text-grey-7">
              This is a lightweight playground to model what a zero-knowledge
              proof could attest to. It does not generate a real proof. It
              evaluates a JSONata rule against provided JSON (plain or base64)
              and computes a commitment hash of the evaluation result.
            </div>
          </q-card-section>

          <q-card-section>
            <div class="column q-gutter-md">
              <q-input
                v-model="jsonataExpression"
                label="JSONata expression"
                outlined
                dense
                placeholder="$exists(instance) and instance.category = 'food'"
              />

              <q-input
                v-model="jsonataInput"
                type="textarea"
                label="Swarm JSON (plaintext or base64)"
                outlined
                autogrow
                placeholder='{ "key": "...", "value": { ... } }'
              />

              <div class="row justify-end">
                <q-btn
                  label="Evaluate"
                  color="secondary"
                  :loading="jsonataLoading"
                  @click="runJsonataCheck"
                />
              </div>
            </div>
          </q-card-section>

          <q-separator v-if="jsonataStatus" />

          <q-card-section v-if="jsonataStatus">
            <div
              v-if="jsonataError"
              class="text-negative bg-red-1 q-pa-sm rounded-borders"
            >
              <q-icon name="error" /> {{ jsonataError }}
            </div>
            <div v-else>
              <div class="text-weight-bold">Conforms:</div>
              <div class="q-mt-xs">
                <q-badge
                  :color="jsonataConforms ? 'positive' : 'negative'"
                  align="middle"
                >{{ jsonataConforms ? 'Yes' : 'No' }}</q-badge>
              </div>

              <div class="q-mt-md">
                <div class="text-weight-bold">Evaluation Result:</div>
                <pre class="bg-grey-2 q-pa-sm rounded-borders text-caption">{{
                  jsonataResult
                }}</pre>
              </div>

              <div class="q-mt-md">
                <div class="text-weight-bold">Commitment Hash:</div>
                <div
                  class="bg-grey-2 q-pa-sm rounded-borders text-caption break-all font-mono"
                >
                  {{ jsonataCommitment }}
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { utils } from 'ethers';
import { Bee } from '@ethersphere/bee-js';
import jsonata from 'jsonata';

const ownerAddress = ref('');
const selectedTopic = ref('tm-editor-instance');
const targetSlug = ref('');
const loading = ref(false);
const result = ref<any>(null);

const jsonataExpression = ref('');
const jsonataInput = ref('');
const jsonataLoading = ref(false);
const jsonataStatus = ref(false);
const jsonataError = ref('');
const jsonataResult = ref('');
const jsonataConforms = ref(false);
const jsonataCommitment = ref('');

const feedTopicOptions = [
  { label: 'Instances (tm-editor-instance)', value: 'tm-editor-instance' },
  { label: 'Tools (tm-editor-machine)', value: 'tm-editor-machine' },
  { label: 'Know-How (tm-editor-knowHow)', value: 'tm-editor-knowHow' },
];

const swarmApiUrl = process.env.SWARM_API_URL;

function hashLeaf(data: any): string {
  // Hash the JSON string of the full item or just the key?
  // Let's hash the full JSON string to represent the "content".
  // We must ensure stable stringify or assume the input object is what we verify.
  // For simplicity, we use the raw object from the feed array.
  const json = JSON.stringify(data);
  return utils.keccak256(utils.toUtf8Bytes(json));
}

function hashPair(a: string, b: string): string {
  // Sort pair to allow for easy inclusion checking without index tracking if strictly implementing sorted tree
  // But standard Merkle proofs usually rely on index/position.
  // Let's implement valid standard Merkle Tree logic: H(a, b)
  // Actually, sorted pairs are common (OpenZeppelin), but let's stick to simple H(l, r)
  // To be robust without knowing position, sorted pairs (H(min(a,b), max(a,b))) is better.
  if (a.toLowerCase() < b.toLowerCase()) {
    return utils.keccak256(utils.solidityPack(['bytes32', 'bytes32'], [a, b]));
  } else {
    return utils.keccak256(utils.solidityPack(['bytes32', 'bytes32'], [b, a]));
  }
}

function buildTree(leaves: string[]) {
  let layers = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const prevLayer = layers[layers.length - 1];
    const nextLayer = [];
    for (let i = 0; i < prevLayer.length; i += 2) {
      const left = prevLayer[i];
      const right = i + 1 < prevLayer.length ? prevLayer[i + 1] : left; // Duplicate last if odd
      nextLayer.push(hashPair(left, right));
    }
    layers.push(nextLayer);
  }
  return layers;
}

function getProof(leaves: string[], index: number, layers: string[][]) {
  const proof = [];
  let layerIndex = 0;
  let currentIndex = index;

  while (layerIndex < layers.length - 1) {
    const layer = layers[layerIndex];
    const isRight = currentIndex % 2 === 1;
    const pairIndex = isRight ? currentIndex - 1 : currentIndex + 1;

    if (pairIndex < layer.length) {
      proof.push(layer[pairIndex]);
    } else {
      // Used self as pair
      proof.push(layer[currentIndex]);
    }

    currentIndex = Math.floor(currentIndex / 2);
    layerIndex++;
  }
  return proof;
}

async function generateProof() {
  result.value = null;
  if (!ownerAddress.value || !selectedTopic.value || !targetSlug.value) {
    result.value = { error: 'Please fill all fields.' };
    return;
  }
  if (!swarmApiUrl) {
    result.value = { error: 'Swarm API Config missing.' };
    return;
  }

  loading.value = true;
  try {
    const bee = new Bee(swarmApiUrl);
    const topic = bee.makeFeedTopic(selectedTopic.value);

    // 1. Download Feed
    let items: any[] = [];
    try {
      const reader = bee.makeFeedReader('sequence', topic, ownerAddress.value);
      const feedUpdate = await reader.download();

      if (feedUpdate.reference) {
        const data = await bee.downloadData(feedUpdate.reference);
        const text = new TextDecoder().decode(data);
        items = JSON.parse(text);
      } else {
        if (feedUpdate[0] !== undefined) {
          let i = 0;
          while (feedUpdate[i] !== undefined) {
            items.push(feedUpdate[i]);
            i++;
          }
        } else {
          items = Array.isArray(feedUpdate) ? feedUpdate : [feedUpdate];
        }
      }
    } catch (e: any) {
      throw new Error(`Failed to fetch feed: ${e.message}`);
    }

    if (!Array.isArray(items)) {
      throw new Error('Feed content is not an array.');
    }

    // 2. Find Item
    const index = items.findIndex(
      (item: any) => String(item.key) === targetSlug.value
    );
    if (index === -1) {
      throw new Error(
        `Item with slug "${targetSlug.value}" not found in feed.`
      );
    }

    // 3. Prepare Leaves
    // Deterministic cleanup same as editor might be needed if objects differ?
    // For ProofPage, we just hash what we downloaded. Proof verifies inclusion IN THE DOWNLOADED DATA.
    const leaves = items.map((item) => hashLeaf(item));
    const targetLeaf = leaves[index];

    // 4. Build Tree
    const layers = buildTree(leaves);
    const root = layers[layers.length - 1][0];
    const proof = getProof(leaves, index, layers);

    result.value = {
      root,
      leaf: targetLeaf,
      proof,
      index,
      totalItems: items.length,
    };
  } catch (e: any) {
    result.value = { error: e.message };
  } finally {
    loading.value = false;
  }
}

function parseJsonataInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('JSON input is empty.');
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  try {
    const decoded = atob(trimmed);
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error('Input must be JSON or base64-encoded JSON.');
  }
}

async function runJsonataCheck() {
  jsonataStatus.value = false;
  jsonataError.value = '';
  jsonataResult.value = '';
  jsonataConforms.value = false;
  jsonataCommitment.value = '';

  if (!jsonataExpression.value.trim()) {
    jsonataError.value = 'JSONata expression is required.';
    jsonataStatus.value = true;
    return;
  }

  jsonataLoading.value = true;
  try {
    const payload = parseJsonataInput(jsonataInput.value);
    const expression = jsonata(jsonataExpression.value);
    const evaluation = await expression.evaluate(payload);
    const serialized = JSON.stringify(evaluation, null, 2);

    jsonataResult.value = serialized;
    jsonataConforms.value = evaluation === true;
    jsonataCommitment.value = utils.keccak256(
      utils.toUtf8Bytes(JSON.stringify(evaluation))
    );
  } catch (error: any) {
    jsonataError.value = error?.message || 'JSONata evaluation failed.';
  } finally {
    jsonataLoading.value = false;
    jsonataStatus.value = true;
  }
}
</script>

<style scoped>
.break-all {
  word-break: break-all;
}
.font-mono {
  font-family: monospace;
}
</style>
