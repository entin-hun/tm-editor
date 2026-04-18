/**
 * Reown AppKit Integration for tm-editor
 *
 * Uses WALLETCONNECT_PROJECT_ID from environment
 * Provides minimal wallet connection abstraction
 */

import { createAppKit } from '@reown/appkit';
import { Ethers5Adapter } from '@reown/appkit-adapter-ethers5';
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
} from '@reown/appkit/networks';

let appKitInstance;
let appKitInitPromise;
let ethersAdapter;
const accountListeners = new Set();

function getProjectId() {
  return (
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
    import.meta.env.VITE_REOWN_PROJECT_ID
  );
}

function getMetadata() {
  if (typeof window === 'undefined') {
    return {
      name: 'Trace.Market Editor',
      description: 'Edit NFTs for use with Trace.Market',
      url: '',
      icons: [],
    };
  }

  const origin = window.location.origin;

  return {
    name: 'Trace.Market Editor',
    description: 'Edit NFTs for use with Trace.Market',
    url: origin,
    icons: [`${origin}/favicon.ico`],
  };
}

/**
 * Subscribe to AppKit account changes.
 * Callback receives { address, walletName } or null on disconnect.
 * Returns an unsubscribe function.
 */
export function onAppKitAccount(cb) {
  accountListeners.add(cb);
  return () => accountListeners.delete(cb);
}

function notifyListeners(info) {
  accountListeners.forEach((cb) => cb(info));
}

export async function initAppKit() {
  if (appKitInstance) return appKitInstance;
  if (appKitInitPromise) return appKitInitPromise;

  const projectId = getProjectId();

  if (!projectId) {
    console.warn(
      '[AppKit] Missing VITE_WALLETCONNECT_PROJECT_ID or VITE_REOWN_PROJECT_ID'
    );
    return undefined;
  }

  appKitInitPromise = Promise.resolve().then(() => {
    if (!ethersAdapter) {
      ethersAdapter = new Ethers5Adapter();
    }

    const networks = [mainnet, arbitrum, optimism, base, polygon];

    appKitInstance = createAppKit({
      projectId,
      adapters: [ethersAdapter],
      networks,
      defaultNetwork: arbitrum,
      metadata: getMetadata(),
      enableEIP6963: true,
      enableInjected: true,
      enableWalletConnect: true,
      allWallets: 'SHOW',
    });

    // Subscribe to account state changes
    appKitInstance.subscribeAccount((state) => {
      if (state.isConnected && state.address) {
        // Detect wallet name
        let walletName = state.connector?.name || null;
        if (!walletName) {
          const eth = typeof window !== 'undefined' && window.ethereum;
          if (eth) {
            if (eth.isMetaMask && !eth.isCoinbaseWallet)
              walletName = 'MetaMask';
            else if (eth.isCoinbaseWallet) walletName = 'Coinbase Wallet';
            else if (eth.isBraveWallet) walletName = 'Brave Wallet';
            else if (eth.isFrame) walletName = 'Frame';
            else walletName = 'Injected Wallet';
          } else {
            walletName = 'WalletConnect';
          }
        }
        console.log(
          '[AppKit] Account connected:',
          state.address,
          'via',
          walletName
        );
        notifyListeners({ address: state.address, walletName });
      } else if (!state.isConnected) {
        console.log('[AppKit] Account disconnected');
        notifyListeners(null);
      }
    });

    console.log('[AppKit] Initialized with project ID:', projectId);
    return appKitInstance;
  });

  return appKitInitPromise;
}

export async function openAppKitModal() {
  const appKit = await initAppKit();
  if (!appKit) return;
  await appKit.open({ view: 'Connect' });
}

export async function openAppKitOnramp() {
  const appKit = await initAppKit();
  if (!appKit) return;
  await appKit.open({ view: 'OnRampProviders' });
}

export async function disconnectAppKit() {
  if (!appKitInstance) return;
  await appKitInstance.disconnect();
}

export function getAppKitAddress() {
  if (!appKitInstance) return undefined;
  try {
    return appKitInstance.getAddress();
  } catch {
    return undefined;
  }
}
