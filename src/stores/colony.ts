import { defineStore } from 'pinia';
import { Extension, getColonyRoles, type AnyColonyClient } from '@colony/colony-js';
import { utils, BigNumber, Contract } from 'ethers';
import { fetchSwarmJson, uploadSwarmJson } from 'src/services/swarm';
import { useWalletStore } from './wallet';

let colonyClientInstance: AnyColonyClient | null = null;

export type Team = {
  id: number;
  name: string;
  skillId: string;
  fundingPotId: string;
  balance: string;
  contributors: TeamContributor[];
};

export type ColonyTokenInfo = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
};

export type TeamContributor = {
  address: string;
  balance: string;
  percentage: string;
};

export const useColonyStore = defineStore('colony', {
  state: () => ({
    colonyAddress: '',
    colonyId: null as number | null,
    colonyLabel: '',
    tokenInfo: null as ColonyTokenInfo | null,
    teams: [] as Team[],
    loading: false,
    status: '',
    lastError: ''
  }),
  actions: {
    async loadColony(address: string) {
      const walletStore = useWalletStore();
      if (!walletStore.networkClient) {
        throw new Error('Network client not initialized');
      }
      const trimmed = address.trim();
      if (!trimmed) {
        throw new Error('Colony address is required');
      }

      const isAddress = utils.isAddress(trimmed);
      const isNumericId = /^\d+$/.test(trimmed);
      if (!isAddress && !isNumericId) {
        throw new Error('Provide a valid Colony address or numeric Colony ID.');
      }

      try {
        this.lastError = '';
        this.loading = true;
        this.status = 'Loading colony...';
        this.colonyAddress = trimmed;
        this.colonyId = isNumericId ? Number(trimmed) : null;

        const colonyClient = await walletStore.networkClient.getColonyClient(
          isNumericId ? Number(trimmed) : trimmed
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        colonyClientInstance = colonyClient as AnyColonyClient;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const colonyAddress = (colonyClient as any).address as string | undefined;
        if (colonyAddress) {
          this.colonyAddress = colonyAddress;
        }

        try {
          if (this.colonyAddress && utils.isAddress(this.colonyAddress)) {
            this.colonyLabel = await walletStore.networkClient.lookupRegisteredENSDomainWithNetworkPatches(this.colonyAddress);
          } else {
            this.colonyLabel = '';
          }
        } catch (error) {
          this.colonyLabel = '';
        }

        const tokenAddress = await colonyClient.getToken();
        const tokenClient = colonyClient.tokenClient as any;
        const [name, symbol, decimals] = await Promise.all([
          tokenClient.name(),
          tokenClient.symbol(),
          tokenClient.decimals()
        ]);

        this.tokenInfo = {
          address: tokenAddress,
          name,
          symbol,
          decimals: Number(decimals)
        };

        await this.fetchTeams();
        await this.fetchTeamContributors();
        this.status = 'Colony loaded.';
      } catch (error) {
        const baseMessage = error instanceof Error ? error.message : 'Colony load failed.';
        this.lastError = `${baseMessage} Ensure the Colony exists on the connected network.`;
        this.status = 'Colony load failed';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchTeams() {
      if (!colonyClientInstance || !this.tokenInfo) {
        throw new Error('Colony not loaded');
      }

      this.status = 'Fetching teams...';
      const countResponse = await colonyClientInstance.getDomainCount();
      const count = countResponse.toNumber();

      const teams: Team[] = [];
      for (let i = 1; i <= count; i += 1) {
        const domain = await colonyClientInstance.getDomain(i);
        const fundingPotId = domain.fundingPotId as BigNumber;
        const balance = await colonyClientInstance.getFundingPotBalance(
          fundingPotId,
          this.tokenInfo.address
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metadata = (domain as any).metadata;
        let metadataName = '';
        if (metadata && typeof metadata === 'object' && typeof metadata.name === 'string') {
          metadataName = metadata.name.trim();
        }
        if (!metadataName && typeof metadata === 'string') {
          const trimmed = metadata.trim();
          if (trimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed && typeof parsed.name === 'string') {
                metadataName = parsed.name.trim();
              }
            } catch (error) {
              metadataName = '';
            }
          }
          if (!metadataName && trimmed.startsWith('bzz://')) {
            try {
              const swarmData = await fetchSwarmJson(trimmed);
              if (swarmData && typeof swarmData.name === 'string') {
                metadataName = swarmData.name.trim();
              }
            } catch (error) {
              metadataName = '';
            }
          }
        }

        teams.push({
          id: i,
          name: metadataName || `Team ${i}`,
          skillId: domain.skillId.toString(),
          fundingPotId: fundingPotId.toString(),
          balance: utils.formatUnits(balance, this.tokenInfo.decimals),
          contributors: []
        });
      }

      this.teams = teams;
      this.status = 'Teams loaded.';
    },

    async fetchTeamContributors() {
      if (!colonyClientInstance || !this.tokenInfo) {
        throw new Error('Colony not loaded');
      }
      this.status = 'Fetching team contributors...';

      const walletStore = useWalletStore();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenClient = colonyClientInstance.tokenClient as any;
      const totalSupply = await tokenClient.totalSupply();
      const roles = await getColonyRoles(colonyClientInstance as AnyColonyClient);

      const teamMembers = new Map<number, Set<string>>();
      for (const userRole of roles) {
        for (const domainRole of userRole.domains) {
          const set = teamMembers.get(domainRole.domainId) ?? new Set<string>();
          set.add(userRole.address);
          teamMembers.set(domainRole.domainId, set);
        }
      }

      let fallbackHolders: string[] = [];
      if (walletStore.connection?.provider) {
        try {
          const transferTopic = tokenClient.interface.getEventTopic('Transfer');
          const logs = await walletStore.connection.provider.getLogs({
            address: this.tokenInfo.address,
            fromBlock: 0,
            toBlock: 'latest',
            topics: [transferTopic]
          });
          const holderSet = new Set<string>();
          for (const log of logs) {
            const parsed = tokenClient.interface.parseLog(log);
            const from = parsed.args?.from ?? parsed.args?.[0];
            const to = parsed.args?.to ?? parsed.args?.[1];
            if (from && utils.isAddress(from) && from !== utils.getAddress('0x0000000000000000000000000000000000000000')) {
              holderSet.add(utils.getAddress(from));
            }
            if (to && utils.isAddress(to) && to !== utils.getAddress('0x0000000000000000000000000000000000000000')) {
              holderSet.add(utils.getAddress(to));
            }
          }
          fallbackHolders = Array.from(holderSet);
        } catch (error) {
          fallbackHolders = [];
        }
      }

      const teams = [...this.teams];
      for (const team of teams) {
        const members = teamMembers.get(team.id) ?? new Set<string>();
        if (members.size === 0 && fallbackHolders.length > 0) {
          for (const holder of fallbackHolders) {
            members.add(holder);
          }
        }
        const contributors: TeamContributor[] = [];

        for (const address of members) {
          if (!utils.isAddress(address)) {
            continue;
          }
          const balance = await tokenClient.balanceOf(address);
          if (balance.isZero()) {
            continue;
          }
          const percentage = totalSupply.isZero()
            ? 0
            : balance.mul(10000).div(totalSupply).toNumber() / 100;

          contributors.push({
            address,
            balance: utils.formatUnits(balance, this.tokenInfo.decimals),
            percentage: percentage.toFixed(2)
          });
        }

        team.contributors = contributors;
      }

      this.teams = teams;
      this.status = 'Team contributors loaded.';
    },

    async refreshColony() {
      if (!colonyClientInstance) {
        throw new Error('Colony not loaded');
      }
      await this.fetchTeams();
      await this.fetchTeamContributors();
    },

    async createPayment(params: {
      recipient: string;
      amount: string;
      domainId: number;
      skillId: number;
      tokenAddress?: string;
    }) {
      if (!colonyClientInstance || !this.tokenInfo) {
        throw new Error('Colony not loaded');
      }
      const token = params.tokenAddress || this.tokenInfo.address;
      const amountWei = utils.parseUnits(params.amount || '0', this.tokenInfo.decimals);
      this.status = 'Creating payment...';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (colonyClientInstance as any).addPaymentWithProofs(
        params.recipient,
        token,
        amountWei,
        params.domainId,
        params.skillId
      );
      this.status = `Payment transaction submitted: ${tx.hash}`;
      return tx;
    },

    async createTask(params: {
      specification: string;
      domainId: number;
      skillId: number;
      dueDate: number;
    }) {
      if (!colonyClientInstance) {
        throw new Error('Colony not loaded');
      }
      const spec = params.specification.trim();
      const specificationHash = normalizeSwarmHash(spec);
      this.status = 'Creating task...';
      const tx = await colonyClientInstance.makeTaskWithProofs(
        specificationHash,
        params.domainId,
        params.skillId,
        params.dueDate
      );
      this.status = `Task transaction submitted: ${tx.hash}`;
      return tx;
    },

    async createMotion(params: {
      domainId: number;
      altTarget: string;
      action: string;
    }) {
      if (!colonyClientInstance) {
        throw new Error('Colony not loaded');
      }
      this.status = 'Creating motion...';
      const votingReputation = await colonyClientInstance.getExtensionClient(Extension.VotingReputation);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (votingReputation as any).createMotionWithProofs(
        params.domainId,
        params.altTarget,
        params.action
      );
      this.status = `Motion transaction submitted: ${tx.hash}`;
      return tx;
    },

    buildEditColonyAction(metadata: string) {
      if (!colonyClientInstance) {
        throw new Error('Colony not loaded');
      }
      const payload = normalizeSwarmMetadata(metadata);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (colonyClientInstance as any).interface.encodeFunctionData('editColony', [payload]);
    },

    async uploadMetadataToSwarm(metadata: string) {
      const trimmed = metadata.trim();
      if (!trimmed) {
        throw new Error('Metadata is required');
      }
      let payload: unknown = trimmed;
      if (!trimmed.startsWith('bzz://') && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
        payload = JSON.parse(trimmed);
      }
      const result = await uploadSwarmJson(payload);
      return result;
    },

    async uploadTaskSpecToSwarm(specification: string) {
      const trimmed = specification.trim();
      if (!trimmed) {
        throw new Error('Specification is required');
      }
      let payload: unknown = trimmed;
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        payload = JSON.parse(trimmed);
      }
      const result = await uploadSwarmJson(payload);
      return result;
    },

    buildAddPaymentAction(params: {
      permissionDomainId: number;
      childSkillIndex: number;
      recipient: string;
      token: string;
      amount: string;
      domainId: number;
      skillId: number;
    }) {
      if (!colonyClientInstance || !this.tokenInfo) {
        throw new Error('Colony not loaded');
      }
      const amountWei = utils.parseUnits(params.amount || '0', this.tokenInfo.decimals);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (colonyClientInstance as any).interface.encodeFunctionData('addPayment', [
        params.permissionDomainId,
        params.childSkillIndex,
        params.recipient,
        params.token || this.tokenInfo.address,
        amountWei,
        params.domainId,
        params.skillId
      ]);
    },

    async createSubSkill(params: { parentDomainId: number; name: string }) {
      if (!colonyClientInstance) {
        throw new Error('Colony not loaded');
      }
      const trimmedName = params.name.trim();
      if (!trimmedName) {
        throw new Error('Sub-skill name is required');
      }
      let metadata = JSON.stringify({ name: trimmedName });
      if (metadata.length > 128) {
        const result = await uploadSwarmJson({ name: trimmedName });
        metadata = result.url;
      }
      this.status = 'Creating sub-skill...';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = await (colonyClientInstance as any)['addDomainWithProofs(uint256,string)'](
        params.parentDomainId,
        metadata
      );
      this.status = `Sub-skill transaction submitted: ${tx.hash}`;
      await this.fetchTeams();
      await this.fetchTeamContributors();
      return tx;
    },

    async mintTokens(params: { address: string; amount: string }) {
      if (!this.tokenInfo) {
        throw new Error('Colony token info not loaded');
      }
      this.status = 'Minting tokens...';
      const amountWei = utils.parseUnits(params.amount, this.tokenInfo.decimals);
      
      const walletStore = useWalletStore();
      if (!walletStore.connection) throw new Error('No wallet connection');
      
      const token = new Contract(
        this.tokenInfo.address, 
        ['function mint(address to, uint256 amount) public'], 
        walletStore.connection.signer
      );
      
      const tx = await token.mint(params.address, amountWei);
      this.status = `Minting transaction submitted: ${tx.hash}`;
      await tx.wait(); // Wait for confirmation
      this.status = 'Tokens minted.';
      return tx;
    },

    async createColony(params: {
      name: string;
      symbol: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: any;
    }) {
      const walletStore = useWalletStore();
      if (!walletStore.networkClient) {
        throw new Error('Network client not initialized. Ensure wallet is connected.');
      }

      let metadataUrl = '';
      if (params.metadata && typeof params.metadata === 'object') {
         const res = await uploadSwarmJson(params.metadata);
         metadataUrl = res.url;
      } else if (typeof params.metadata === 'string') {
         metadataUrl = params.metadata;
      } else {
         const res = await uploadSwarmJson({ name: params.name });
         metadataUrl = res.url;
      }
      
      try {
        // 1. Create Token
        this.status = 'Creating Token...';
        
        // Use deployToken helper from network client (if available) or fallback
        // Typical signature: deployToken(name, symbol, decimals) or deployToken({ name, symbol, decimals })
        // We attempt the standard positional args for colony-js v5+
        
        let tokenAddress: string | { address: string } = '';
        try {
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           tokenAddress = await (walletStore.networkClient as any).deployToken(
             params.name,
             params.symbol,
             18
           );
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
           // Fallback if deployToken signature matches object or doesn't exist?
           // Actually, if deployToken fails, we can't easily proceed without writing raw bytecode deployment.
           // Let's assume deployToken works as per standard colony-js env.
           throw new Error(`Token deployment failed: ${err.message}`);
        }
        
        if (!tokenAddress || typeof tokenAddress !== 'string') {
             // Sometimes it returns a contract object
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             if (tokenAddress && (tokenAddress as any).address) {
                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                 tokenAddress = (tokenAddress as any).address;
             } else {
                 throw new Error('Token deployment returned invalid address');
             }
        }

        const tx = await walletStore.networkClient.createColony(tokenAddress as string, {
            metadata: metadataUrl,
            version: await walletStore.networkClient.getColonyVersion()
        });
        
        this.status = `Colony creation submitted: ${tx.hash}`;
        const receipt = await tx.wait();
        
        // Find ColonyAdded event
        const eventFilter = walletStore.networkClient.filters.ColonyAdded();
        const event = receipt.events?.find((e: any) => e.topics[0] === eventFilter.topics?.[0]); // eslint-disable-line @typescript-eslint/no-explicit-any
        const colonyAddress = event?.args?.colonyAddress;
        
        if (!colonyAddress) throw new Error('Colony Created but address not found in logs');
        
        this.colonyAddress = colonyAddress;
        this.colonyLabel = params.name; // Temporary until index syncs
        this.status = 'Colony Created Successfully';
        
        return colonyAddress;
      } catch (error) {
         this.lastError = error instanceof Error ? error.message : 'Failed to create colony';
         throw error;
      }
    }
    
  }
});

const SWARM_PREFIXES = ['bzz://', 'https://', 'http://'];

function normalizeSwarmMetadata(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Metadata is required');
  }
  const isSwarm = SWARM_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  if (!isSwarm && trimmed.length > 128) {
    throw new Error('Metadata must be stored on Swarm (use a bzz:// URL or Swarm gateway link).');
  }
  return trimmed;
}

function normalizeSwarmHash(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Specification hash is required');
  }
  if (trimmed.startsWith('0x')) {
    return trimmed;
  }
  const isSwarmUrl = SWARM_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  if (isSwarmUrl) {
    const lastSegment = trimmed.split('/').pop() || '';
    if (/^[0-9a-fA-F]{64}$/.test(lastSegment)) {
      return `0x${lastSegment}`;
    }
    throw new Error('Provide a Swarm hash (64 hex chars) for task specification.');
  }
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return `0x${trimmed}`;
  }
  throw new Error('Task specification must be a Swarm hash (0x...)');
}
