import type { AIConfig, AIProvider } from '../../types/ai';
import { DEFAULT_MODELS } from '../../config/aiConfig';

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
 * Service for managing AI configuration (provider, API key, model)
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

      // Deobfuscate API key
      if (parsed.apiKey) {
        parsed.apiKey = deobfuscate(parsed.apiKey);
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
      // Obfuscate API key before storing
      const toStore = {
        ...config,
        apiKey: config.apiKey ? obfuscate(config.apiKey) : '',
      };

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
    return !!(config && config.enabled && config.apiKey && config.provider);
  }

  /**
   * Get API key for current provider (deobfuscated)
   */
  getApiKey(): string | null {
    const config = this.getConfig();
    return config?.apiKey || null;
  }

  /**
   * Create default configuration for a provider
   */
  createDefaultConfig(provider: AIProvider, apiKey: string): AIConfig {
    return {
      provider,
      apiKey,
      model: DEFAULT_MODELS[provider],
      enabled: true,
      validated: false,
      // Validation timestamps are set only after a successful test
      lastValidated: undefined,
      lastError: undefined,
    };
  }

  /**
   * Mark configuration as validated (or failed)
   */
  markValidated(success: boolean, error?: string): void {
    const config = this.getConfig();
    if (!config) return;

    this.saveConfig({
      ...config,
      validated: success,
      lastValidated: new Date().toISOString(),
      lastError: success ? undefined : error,
    });
  }
}

// Singleton instance
export const aiConfigStorage = new AIConfigStorage();
