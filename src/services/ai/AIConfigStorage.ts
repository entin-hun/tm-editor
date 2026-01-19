import type { AIConfig, AIProvider, ProviderConfig } from '../../types/ai';

const STORAGE_KEY = 'tm-editor-ai-config';
const OBFUSCATION_KEY = 'trace-market-2026'; // Simple XOR obfuscation

/**
 * Simple XOR obfuscation for API keys (NOT cryptographically secure!)
 * Only prevents casual viewing in localStorage inspector
 */
function obfuscate(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^
        OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    );
  }
  return btoa(result); // base64 encode
}

function deobfuscate(encoded: string): string {
  try {
    const decoded = atob(encoded);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^
          OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
      );
    }
    return result;
  } catch (error) {
    console.error('Failed to deobfuscate API key:', error);
    return '';
  }
}

/**
 * Service for managing AI configuration with multi-provider support
 * Stores config in localStorage with basic obfuscation
 */
export class AIConfigStorage {
  /**
   * Get stored AI configuration
   */
  getConfig(): AIConfig | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);

      // Migrate old config structure to new multi-provider structure
      if (!parsed.providers && parsed.provider && parsed.apiKey) {
        const oldApiKey = deobfuscate(parsed.apiKey);
        return {
          providers: {
            [parsed.provider]: {
              apiKey: oldApiKey,
              validated: parsed.validated,
              lastValidated: parsed.lastValidated,
              lastError: parsed.lastError,
            },
          },
          activeProvider: parsed.provider,
          enabled: parsed.enabled ?? true,
        };
      }

      // Initialize providers object if missing
      if (!parsed.providers) {
        parsed.providers = {};
      }

      // Deobfuscate API keys for all providers
      Object.keys(parsed.providers).forEach((provider) => {
        if (parsed.providers[provider]?.apiKey) {
          parsed.providers[provider].apiKey = deobfuscate(
            parsed.providers[provider].apiKey
          );
        }
      });

      // Ensure activeProvider is set
      if (!parsed.activeProvider && Object.keys(parsed.providers).length > 0) {
        parsed.activeProvider = Object.keys(parsed.providers)[0];
      }

      // Ensure enabled defaults to true
      if (parsed.enabled === undefined) {
        parsed.enabled = true;
      }

      return parsed as AIConfig;
    } catch (error) {
      console.error('Failed to load AI config:', error);
      return null;
    }
  }

  /**
   * Save AI configuration
   */
  saveConfig(config: AIConfig): void {
    try {
      // Obfuscate API keys before storing
      const toStore: any = {
        ...config,
        providers: {},
      };

      Object.keys(config.providers || {}).forEach((provider) => {
        const providerConfig = config.providers[provider as AIProvider];
        if (providerConfig) {
          toStore.providers[provider] = {
            ...providerConfig,
            apiKey: providerConfig.apiKey
              ? obfuscate(providerConfig.apiKey)
              : '',
          };
        }
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      window.dispatchEvent(new Event('ai-config-updated'));
    } catch (error) {
      console.error('Failed to save AI config:', error);
      throw new Error('Failed to save AI configuration');
    }
  }

  /**
   * Update specific config fields
   */
  updateConfig(updates: Partial<AIConfig>): void {
    const current = this.getConfig();
    if (!current) {
      throw new Error('No AI config to update');
    }

    this.saveConfig({ ...current, ...updates });
  }

  /**
   * Clear AI configuration
   */
  clearConfig(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear AI config:', error);
    }
  }

  /**
   * Check if AI is configured and enabled
   */
  isConfigured(): boolean {
    const config = this.getConfig();
    console.log('[AIConfigStorage] isConfigured check - config:', config);

    if (!config || !config.enabled || !config.providers) {
      console.log(
        `[AIConfigStorage] isConfigured: false (config: ${!!config}, enabled: ${
          config?.enabled
        }, providers: ${!!config?.providers})`
      );
      return false;
    }

    // Check if active provider has a valid API key
    const providerConfig = config.providers[config.activeProvider];
    const result = !!(providerConfig && providerConfig.apiKey);
    console.log(
      `[AIConfigStorage] isConfigured: ${result} (provider: ${
        config.activeProvider
      }, hasKey: ${!!providerConfig?.apiKey})`
    );
    return result;
  }

  /**
   * Get API key for a specific provider (deobfuscated)
   */
  getApiKey(provider?: AIProvider): string | null {
    const config = this.getConfig();
    if (!config || !config.providers) return null;

    const targetProvider = provider || config.activeProvider;
    return config.providers[targetProvider]?.apiKey || null;
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider: AIProvider): ProviderConfig | null {
    const config = this.getConfig();
    if (!config || !config.providers) return null;
    return config.providers[provider] || null;
  }

  /**
   * Update a specific provider's API key and validation status
   */
  updateProvider(
    provider: AIProvider,
    apiKey: string,
    validated?: boolean,
    error?: string
  ): void {
    let config = this.getConfig();
    if (!config) {
      config = {
        providers: {},
        activeProvider: provider,
        enabled: true,
      };
    }

    config.providers[provider] = {
      apiKey,
      validated,
      lastValidated:
        validated !== undefined ? new Date().toISOString() : undefined,
      lastError: error,
    };

    this.saveConfig(config);
  }

  /**
   * Remove a provider's API key
   */
  clearProvider(provider: AIProvider): void {
    const config = this.getConfig();
    if (!config || !config.providers) return;

    delete config.providers[provider];
    this.saveConfig(config);
  }

  /**
   * Set the active provider for task execution
   */
  setActiveProvider(provider: AIProvider): void {
    const config = this.getConfig();
    if (!config || !config.providers) return;

    config.activeProvider = provider;
    this.saveConfig(config);
  }

  /**
   * Get all configured providers
   */
  getConfiguredProviders(): AIProvider[] {
    const config = this.getConfig();
    if (!config || !config.providers) return [];

    return Object.keys(config.providers).filter(
      (p) => config.providers[p as AIProvider]?.apiKey
    ) as AIProvider[];
  }

  /**
   * Get the active API key (for the active provider)
   */
  getActiveApiKey(): string | null {
    const config = this.getConfig();
    if (!config || !config.activeProvider) return null;

    const providerConfig = config.providers[config.activeProvider];
    return providerConfig?.apiKey || null;
  }

  /**
   * Get the active provider
   */
  getActiveProvider(): AIProvider | null {
    const config = this.getConfig();
    if (!config) return null;

    return config.activeProvider || null;
  }
}

// Singleton instance
export const aiConfigStorage = new AIConfigStorage();
