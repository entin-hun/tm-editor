import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { ColonyNetworkClient, Network } from '@colony/colony-js';
import { utils } from 'ethers';
import type { WalletConnection } from 'src/services/colony/network';
import { connectWallet, initColonyNetworkClient, requestNetworkSwitch } from 'src/services/colony/network';

utils.Logger.setLogLevel(utils.Logger.levels.ERROR);

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    connection: null as WalletConnection | null,
    networkClient: null as ColonyNetworkClient | null,
    networkClientReady: false,
    networkStatus: 'Not connected',
    lastError: ''
  }),
  getters: {
    address: (state) => state.connection?.address ?? '',
    chainId: (state) => state.connection?.chainId ?? null
  },
  actions: {
    async connect() {
      try {
        this.lastError = '';
        this.networkStatus = 'Connecting wallet...';
        const connection = await connectWallet();
        this.connection = markRaw({
          ...connection,
          provider: markRaw(connection.provider),
          signer: markRaw(connection.signer)
        });
        this.networkStatus = `Wallet connected (${connection.address.slice(0, 6)}...)`;
        return connection;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Wallet connection failed.';
        this.networkStatus = 'Wallet connection failed';
        throw error;
      }
    },
    async initNetworkClient(preferredNetwork?: Network) {
      if (!this.connection) {
        throw new Error('Wallet not connected');
      }
      try {
        this.lastError = '';
        this.networkStatus = 'Initializing Colony network client...';
        this.networkClient = markRaw(await initColonyNetworkClient(this.connection, preferredNetwork));
        this.networkClientReady = true;
        this.networkStatus = 'Colony network client ready';
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Network client init failed.';
        this.networkClientReady = false;
        this.networkClient = null;
        this.networkStatus = 'Network client init failed';
        throw error;
      }
    },
    async suggestNetworkSwitch(preferredNetwork: Network) {
      try {
        this.lastError = '';
        this.networkStatus = 'Requesting wallet network switch...';
        await requestNetworkSwitch(preferredNetwork);
        this.networkStatus = 'Wallet network switch requested';
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : 'Network switch failed.';
        this.networkStatus = 'Network switch failed';
        throw error;
      }
    }
  }
});
