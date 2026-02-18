import {
  getColonyNetworkClient,
  Network,
  type ColonyNetworkClient,
} from '@colony/colony-js';
import { providers } from 'ethers';

// Define NetworkId manually to avoid missing dependency @colony/core
export enum NetworkId {
  Mainnet = 1,
  Goerli = 5,
  Gnosis = 100,
  ArbitrumOne = 42161,
  ArbitrumSepolia = 421614,
}

export type WalletConnection = {
  provider: providers.Web3Provider;
  signer: providers.JsonRpcSigner;
  address: string;
  chainId: number;
};

export async function connectWallet(): Promise<WalletConnection> {
  if (typeof window === 'undefined') {
    throw new Error('Wallet connection is only available in the browser.');
  }

  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error(
      'No injected wallet found. Install MetaMask or a compatible wallet.'
    );
  }

  const provider = new providers.Web3Provider(ethereum, 'any');
  await provider.send('eth_requestAccounts', []);
  const signer = provider.getSigner();
  const address = await signer.getAddress();
  const { chainId } = await provider.getNetwork();

  return { provider, signer, address, chainId };
}

export function mapChainIdToColonyNetwork(chainId: number): Network | null {
  switch (chainId) {
    case NetworkId.Gnosis:
      return Network.Gnosis;
    case NetworkId.Mainnet:
      return Network.Mainnet;
    case NetworkId.Goerli:
      return Network.Goerli;
    case NetworkId.ArbitrumOne:
      return Network.ArbitrumOne;
    case NetworkId.ArbitrumSepolia:
      return Network.ArbitrumSepolia;
    default:
      return null;
  }
}

export async function initColonyNetworkClient(
  connection: WalletConnection,
  overrideNetwork?: Network
): Promise<ColonyNetworkClient> {
  const colonyNetwork =
    overrideNetwork ?? mapChainIdToColonyNetwork(connection.chainId);
  if (!colonyNetwork) {
    throw new Error(`Unsupported chainId ${connection.chainId}.`);
  }
  return getColonyNetworkClient(colonyNetwork, connection.signer);
}

type ChainParams = {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

const NETWORK_CHAIN_PARAMS: Partial<Record<Network, ChainParams>> = {
  [Network.Mainnet]: {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.ankr.com/eth'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  [Network.Goerli]: {
    chainId: '0x5',
    chainName: 'Goerli',
    nativeCurrency: { name: 'Goerli ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.ankr.com/eth_goerli'],
    blockExplorerUrls: ['https://goerli.etherscan.io'],
  },
  [Network.Gnosis]: {
    chainId: '0x64',
    chainName: 'Gnosis',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    rpcUrls: ['https://rpc.gnosischain.com'],
    blockExplorerUrls: ['https://gnosisscan.io'],
  },
  [Network.ArbitrumOne]: {
    chainId: '0xA4B1',
    chainName: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
  [Network.ArbitrumSepolia]: {
    chainId: '0x66EEE',
    chainName: 'Arbitrum Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://sepolia.arbiscan.io'],
  },
  [Network.Custom]: {
    chainId: '0x1',
    chainName: 'Custom',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.ankr.com/eth'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
};

export async function requestNetworkSwitch(target: Network) {
  if (typeof window === 'undefined') {
    throw new Error('Network switch is only available in the browser.');
  }
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error('No injected wallet found.');
  }
  const params = NETWORK_CHAIN_PARAMS[target];
  if (!params) {
    throw new Error('Unsupported network.');
  }
  await ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [params],
  });
}
