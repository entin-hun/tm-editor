import { defineStore } from 'pinia';
import {
  Chain,
  createThirdwebClient,
  defineChain,
  ThirdwebClient,
} from 'thirdweb';
import { Account, Wallet } from 'thirdweb/wallets';

const env =
  typeof import.meta !== 'undefined' && (import.meta as any)?.env
    ? (import.meta as any).env
    : {};

const pickEnv = (...keys: string[]): string => {
  for (const key of keys) {
    const value =
      (env?.[key] as string | undefined) ??
      ((process as any)?.env?.[key] as string | undefined);
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const resolvedClientId = pickEnv(
  'VITE_TW_CLIENT_ID',
  'VITE_NEXT_PUBLIC_TW_CLIENT_ID',
  'NEXT_PUBLIC_TW_CLIENT_ID',
  'TW_CLIENT_ID'
);

const resolvedChainId = pickEnv(
  'VITE_CHAIN_ID',
  'CHAIN_ID',
  'VITE_NEXT_PUBLIC_CHAIN_ID',
  'NEXT_PUBLIC_CHAIN_ID'
);

// Browser runtime should prefer explicitly Vite-exposed RPC only.
// Falling back to CHAIN_RPC can force a non-CORS endpoint in client-side calls.
const resolvedChainRpc = pickEnv('VITE_CHAIN_RPC');

if (!resolvedClientId) {
  console.error(
    '[AccountStore] Missing Thirdweb clientId (TW_CLIENT_ID/NEXT_PUBLIC_TW_CLIENT_ID/VITE_TW_CLIENT_ID).'
  );
}

interface AccountState {
  wallet: Wallet | undefined;
  account: Account | undefined;
  readonly client: ThirdwebClient;
  readonly chain: Chain;
}

export const useAccountStore = defineStore('account', {
  state: (): AccountState => ({
    wallet: undefined,
    account: undefined,
    client: createThirdwebClient({
      clientId: resolvedClientId,
    }),
    chain: defineChain({
      id: Number.parseInt(resolvedChainId || '10200'),
      rpc: resolvedChainRpc || undefined,
    }),
  }),
});
