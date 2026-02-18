<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin q-pa-md" style="min-width: 360px">
      <q-card-section>
        <div class="text-h6">Web2 Login (Thirdweb)</div>
        <div class="text-caption text-grey-7 q-mt-xs">
          Sign in with email or social to create an in-app wallet.
        </div>
      </q-card-section>

      <q-card-section class="column q-gutter-md">
        <div class="text-caption text-grey-7">
          Social providers (require enabling in Thirdweb dashboard).
        </div>
        <div class="row q-gutter-sm">
          <q-btn label="Google" icon="google" color="primary" flat @click="connectWithSocial('google')" :loading="socialLoading" />
          <q-btn label="Apple" icon="apple" color="primary" flat @click="connectWithSocial('apple')" :loading="socialLoading" />
          <q-btn label="Facebook" icon="facebook" color="primary" flat @click="connectWithSocial('facebook')" :loading="socialLoading" />
          <q-btn label="Discord" icon="discord" color="primary" flat @click="connectWithSocial('discord')" :loading="socialLoading" />
          <q-btn label="GitHub" icon="code" color="primary" flat @click="connectWithSocial('github')" :loading="socialLoading" />
          <q-btn label="X" icon="alternate_email" color="primary" flat @click="connectWithSocial('x')" :loading="socialLoading" />
          <q-btn label="Telegram" icon="send" color="primary" flat @click="connectWithSocial('telegram')" :loading="socialLoading" />
          <q-btn label="Line" icon="chat" color="primary" flat @click="connectWithSocial('line')" :loading="socialLoading" />
          <q-btn label="Twitch" icon="videogame_asset" color="primary" flat @click="connectWithSocial('twitch')" :loading="socialLoading" />
          <q-btn label="Coinbase" icon="account_balance" color="primary" flat @click="connectWithSocial('coinbase')" :loading="socialLoading" />
        </div>

        <q-separator />

        <q-input
          v-model="email"
          label="Email"
          outlined
          dense
          type="email"
        />
        <div class="row q-gutter-sm">
          <q-btn
            label="Send Code"
            color="secondary"
            flat
            @click="sendEmailCode"
            :disable="!email"
            :loading="emailLoading"
          />
        </div>
        <q-input
          v-model="verificationCode"
          label="Verification Code"
          outlined
          dense
        />
        <q-btn
          label="Sign in with Email"
          color="primary"
          @click="connectWithEmail"
          :disable="!email || !verificationCode"
          :loading="emailLoading"
        />

        <div v-if="status" class="text-caption text-grey-6">
          {{ status }}
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" @click="onDialogHide" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import { inAppWallet, preAuthenticate } from 'thirdweb/wallets/in-app';
import { useAccountStore } from 'src/stores/account';

const { dialogRef, onDialogHide } = useDialogPluginComponent();
const $q = useQuasar();
const accountStore = useAccountStore();

const email = ref('');
const verificationCode = ref('');
const status = ref('');
const emailLoading = ref(false);
const socialLoading = ref(false);

const wallet = inAppWallet();

async function connectWalletWith(strategy: string, params: Record<string, unknown>) {
  const account = await wallet.connect({
    client: accountStore.client,
    chain: accountStore.chain,
    strategy: strategy as any,
    ...params,
  });
  accountStore.wallet = wallet as any;
  accountStore.account = account;
  localStorage.setItem('tm-wallet', 'inApp');
}

async function connectWithSocial(
  strategy:
    | 'google'
    | 'apple'
    | 'facebook'
    | 'discord'
    | 'github'
    | 'x'
    | 'telegram'
    | 'line'
    | 'twitch'
    | 'coinbase'
) {
  console.log('connectWithSocial clicked:', strategy);
  socialLoading.value = true;
  status.value = '';
  try {
    console.log('calling connectWalletWith...');
    await connectWalletWith(strategy, {
      auth: {
        mode: 'popup',
      },
    });
    console.log('connectWalletWith success');
    $q.notify({ message: 'Web2 wallet connected', color: 'positive' });
    onDialogHide();
  } catch (error) {
    console.error('connectWithSocial error:', error);
    $q.notify({
      message: `Web2 login failed: ${error instanceof Error ? error.message : String(error)}`,
      color: 'negative',
    });
  } finally {
    socialLoading.value = false;
  }
}

async function sendEmailCode() {
  if (!email.value) return;
  emailLoading.value = true;
  status.value = '';
  try {
    await preAuthenticate({
      client: accountStore.client,
      strategy: 'email',
      email: email.value,
    });
    status.value = 'Verification code sent.';
  } catch (error) {
    status.value = 'Failed to send verification code.';
  } finally {
    emailLoading.value = false;
  }
}

async function connectWithEmail() {
  if (!email.value || !verificationCode.value) return;
  emailLoading.value = true;
  status.value = '';
  try {
    await connectWalletWith('email', {
      email: email.value,
      verificationCode: verificationCode.value,
    });
    $q.notify({ message: 'Web2 wallet connected', color: 'positive' });
    onDialogHide();
  } catch (error) {
    $q.notify({
      message: `Email login failed: ${error instanceof Error ? error.message : String(error)}`,
      color: 'negative',
    });
  } finally {
    emailLoading.value = false;
  }
}
</script>
