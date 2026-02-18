import { defineStore } from 'pinia';
import {
  Chain,
  createThirdwebClient,
  defineChain,
  ThirdwebClient,
} from 'thirdweb';
import { Account, Wallet } from 'thirdweb/wallets';

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
      clientId: process.env.TW_CLIENT_ID || process.env.NEXT_PUBLIC_TW_CLIENT_ID || '',
    }),
    chain: defineChain({
      id: Number.parseInt(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || '10200'),
      rpc: process.env.CHAIN_RPC,
    }),
  }),
});
