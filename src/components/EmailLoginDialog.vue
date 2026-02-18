<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-pa-md" style="min-width: 360px">
      <q-card-section>
        <div class="text-h6">Email Login (ZK Email)</div>
        <div class="text-caption text-grey-7 q-mt-xs">
          This stores a verified email JWT locally. On-chain signing still
          requires a wallet until a relayer is wired.
        </div>
      </q-card-section>

      <q-card-section class="column q-gutter-md">
        <div v-if="googleClientId" class="column q-gutter-sm">
          <div class="text-subtitle2">Google Sign-In</div>
          <div ref="googleBtnRef" />
        </div>
        <div v-else class="text-caption text-grey-7">
          Set <span class="text-weight-bold">ZKEMAIL_GOOGLE_CLIENT_ID</span> to
          enable Google Sign-In.
        </div>

        <div v-if="auth0Ready" class="column q-gutter-sm">
          <div class="text-subtitle2">Auth0 Login</div>
          <q-btn
            label="Login with Auth0"
            color="primary"
            @click="handleAuth0Login"
          />
          <div class="text-caption text-grey-7">
            Configure Google, Apple, or Microsoft as connections in Auth0.
          </div>
        </div>
        <div v-else class="text-caption text-grey-7">
          Set <span class="text-weight-bold">VITE_AUTH0_DOMAIN</span> and
          <span class="text-weight-bold">VITE_AUTH0_CLIENT_ID</span> to enable Auth0.
        </div>

        <q-input
          v-model="jwtInput"
          type="textarea"
          autogrow
          outlined
          label="JWT (paste)"
          hint="You can paste a JWT here if you already have one."
        />

        <q-separator />

        <div class="column q-gutter-sm">
          <div class="text-subtitle2">Email Wallet (Relayer)</div>
          <div v-if="!emailAuth.email" class="text-caption text-grey-7">
            Log in with Auth0 or Google to enable on-chain email wallet actions.
          </div>
          <div v-else class="text-caption text-grey-7">
            Using email: {{ emailAuth.email }}
          </div>

          <q-input
            v-model="accountCode"
            label="Account code"
            outlined
            dense
          />

          <div class="row q-gutter-sm">
            <q-btn
              label="Generate Code"
              color="secondary"
              flat
              @click="handleGenerateCode"
              :disable="!emailAuth.email"
            />
            <q-btn
              label="Create Wallet"
              color="primary"
              @click="handleCreateWallet"
              :loading="walletBusy"
              :disable="!emailAuth.email || !accountCode"
            />
            <q-btn
              label="Fetch Address"
              color="primary"
              outline
              @click="handleFetchAddress"
              :loading="walletBusy"
              :disable="!emailAuth.email || !accountCode"
            />
          </div>

          <q-input
            v-model="walletAddress"
            label="Wallet address"
            outlined
            dense
            readonly
          />

          <div class="text-caption text-grey-7">NFT Transfer (relayed)</div>
          <q-input
            v-model="nftTokenId"
            label="Token ID"
            outlined
            dense
          />
          <q-input
            v-model="nftRecipient"
            label="Recipient (email or address)"
            outlined
            dense
          />
          <q-input
            v-model="nftContract"
            label="NFT contract address"
            outlined
            dense
          />
          <q-btn
            label="Transfer NFT"
            color="primary"
            @click="handleTransferNft"
            :loading="walletBusy"
            :disable="!emailAuth.email || !nftTokenId || !nftRecipient || !nftContract"
          />

          <div v-if="walletStatus" class="text-caption text-grey-6">
            {{ walletStatus }}
          </div>
        </div>
        <div class="row justify-end q-gutter-sm">
          <q-btn label="Cancel" flat @click="onDialogHide" />
          <q-btn
            label="Use JWT"
            color="primary"
            :disable="!jwtInput"
            @click="handleJwtSubmit"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import { useEmailAuthStore } from 'src/stores/emailAuth';
import { useAuth0 } from '@auth0/auth0-vue';
import {
  createAccount,
  ensureAccountCode,
  getWalletAddress,
  loadWalletData,
  saveWalletData,
  setLoggedInEmail,
  transferNft,
} from 'src/services/emailWallet';

const { dialogRef, onDialogHide } = useDialogPluginComponent();
const emailAuth = useEmailAuthStore();

const jwtInput = ref('');
const googleBtnRef = ref<HTMLDivElement | null>(null);
const googleClientId = process.env.ZKEMAIL_GOOGLE_CLIENT_ID || '';
const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN || '';
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE || '';
const auth0SecureOrigin =
  window.location.protocol === 'https:' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';
const auth0Ready = computed(
  () => Boolean(auth0Domain && auth0ClientId && auth0SecureOrigin)
);
let loginWithPopup: (params?: any) => Promise<void> = async () => {
  throw new Error('Auth0 is not available on this origin');
};
const idTokenClaims = ref<any>(null);

try {
  const auth0 = useAuth0();
  loginWithPopup = auth0.loginWithPopup;
  idTokenClaims.value = auth0.idTokenClaims.value;
  watch(
    () => auth0.idTokenClaims.value,
    (next) => {
      idTokenClaims.value = next;
    }
  );
} catch (error) {
  console.warn('[Auth0] Not initialized:', error);
}

const accountCode = ref('');
const walletAddress = ref('');
const walletStatus = ref('');
const walletBusy = ref(false);
const nftTokenId = ref('');
const nftRecipient = ref('');
const nftContract = ref(process.env.NFT_CONTRACT || '');

const loadGoogleScript = () =>
  new Promise<void>((resolve, reject) => {
    if ((window as any).google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector(
      'script[data-google-identity]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.setAttribute('data-google-identity', 'true');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script'));
    document.head.appendChild(script);
  });

const decodeJwtPayload = (jwt: string) => {
  const [, payload] = jwt.split('.');
  if (!payload) throw new Error('Invalid JWT');
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(json);
};

const handleJwtSubmit = () => {
  try {
    const payload = decodeJwtPayload(jwtInput.value);
    emailAuth.setJwt(jwtInput.value, payload?.email || payload?.sub || '');
    if (payload?.email || payload?.sub) {
      setLoggedInEmail(payload?.email || payload?.sub || '');
    }
    onDialogHide();
  } catch (error) {
    emailAuth.clear();
    throw error;
  }
};

const handleCredentialResponse = (response: any) => {
  if (!response?.credential) return;
  jwtInput.value = response.credential;
  handleJwtSubmit();
};

const handleAuth0Login = async () => {
  if (!auth0Ready.value) return;
  await loginWithPopup({
    authorizationParams: {
      redirect_uri: window.location.origin,
      scope: 'openid email profile',
      ...(auth0Audience ? { audience: auth0Audience } : {}),
    },
  });
  const claims = idTokenClaims.value;
  if (!claims?.__raw) throw new Error('No id_token from Auth0');
  jwtInput.value = claims.__raw;
  const email =
    (claims as any).email || (claims as any).nickname || (claims as any).sub;
  emailAuth.setJwt(claims.__raw, email || '');
  if (email) setLoggedInEmail(email);
  onDialogHide();
};

function syncWalletData() {
  if (!emailAuth.email) return;
  const data = loadWalletData(emailAuth.email);
  accountCode.value = data.code || ensureAccountCode(emailAuth.email);
  walletAddress.value = data.walletAddress || '';
}

function handleGenerateCode() {
  if (!emailAuth.email) return;
  accountCode.value = ensureAccountCode(emailAuth.email);
  saveWalletData(emailAuth.email, {
    code: accountCode.value,
    walletAddress: walletAddress.value,
  });
  walletStatus.value = 'Account code generated.';
}

async function handleCreateWallet() {
  if (!emailAuth.email) return;
  walletBusy.value = true;
  walletStatus.value = 'Creating wallet...';
  try {
    await createAccount(emailAuth.email);
    walletStatus.value = 'Wallet creation requested.';
  } catch (error) {
    walletStatus.value = 'Failed to create wallet.';
  } finally {
    walletBusy.value = false;
  }
}

async function handleFetchAddress() {
  if (!emailAuth.email) return;
  walletBusy.value = true;
  walletStatus.value = 'Fetching wallet address...';
  try {
    const address = await getWalletAddress(emailAuth.email, accountCode.value);
    walletAddress.value = address;
    saveWalletData(emailAuth.email, {
      code: accountCode.value,
      walletAddress: address,
    });
    walletStatus.value = address ? 'Wallet address loaded.' : 'No address found.';
  } catch (error) {
    walletStatus.value = 'Failed to fetch wallet address.';
  } finally {
    walletBusy.value = false;
  }
}

async function handleTransferNft() {
  if (!emailAuth.email) return;
  walletBusy.value = true;
  walletStatus.value = 'Submitting NFT transfer...';
  try {
    const res = await transferNft(
      emailAuth.email,
      nftTokenId.value,
      nftContract.value,
      nftRecipient.value
    );
    walletStatus.value = res || 'NFT transfer submitted.';
  } catch (error) {
    walletStatus.value = 'Failed to transfer NFT.';
  } finally {
    walletBusy.value = false;
  }
}

onMounted(async () => {
  if (!googleClientId) return;
  await loadGoogleScript();
  const google = (window as any).google;
  if (!google?.accounts?.id || !googleBtnRef.value) return;
  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleCredentialResponse,
  });
  google.accounts.id.renderButton(googleBtnRef.value, {
    theme: 'outline',
    size: 'large',
  });
});

watch(
  () => emailAuth.email,
  (next) => {
    if (!next) return;
    syncWalletData();
  },
  { immediate: true }
);

</script>
