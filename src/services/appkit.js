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
  console.log('[AppKit] Modal opened');
}

export async function openAppKitOnramp() {
  const appKit = await initAppKit();
  if (!appKit) return;

  await appKit.open({ view: 'OnRampProviders' });
  console.log('[AppKit] Onramp modal opened');
}
