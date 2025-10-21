import { logger } from '@/commons/utils/logger';
import { LLMConfig } from './LLMService';

const CONFIG_KEY = 'notch-llm-config';

export class ConfigService {
  /**
   * Save LLM configuration to localStorage
   */
  static saveLLMConfig(config: LLMConfig): void {
    try {
      const configToSave = {
        ...config,
        apiKey: config.apiKey ? this.obfuscateKey(config.apiKey) : '',
      };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(configToSave));
    } catch (error) {
      logger.error('Failed to save LLM config:', error);
    }
  }

  /**
   * Load LLM configuration from localStorage
   */
  static loadLLMConfig(): LLMConfig | null {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (!stored) return null;

      const config = JSON.parse(stored);
      return {
        ...config,
        apiKey: config.apiKey ? this.deobfuscateKey(config.apiKey) : '',
      };
    } catch (error) {
      logger.error('Failed to load LLM config:', error);
      return null;
    }
  }

  /**
   * Get LLM configuration with fallback to default
   */
  static getLLMConfig(): LLMConfig {
    const config = this.loadLLMConfig();
    if (config) {
      return config;
    }

    // Return default configuration
    return {
      provider: 'claude-code',
      apiKey: '',
      apiUrl: '',
      model: '',
      temperature: 0.7,
      maxTokens: 2000,
    };
  }

  /**
   * Clear LLM configuration
   */
  static clearLLMConfig(): void {
    localStorage.removeItem(CONFIG_KEY);
  }

  /**
   * Simple obfuscation for API keys (NOT secure - use proper encryption in production)
   */
  private static obfuscateKey(key: string): string {
    return btoa(key);
  }

  /**
   * Simple deobfuscation for API keys
   */
  private static deobfuscateKey(obfuscated: string): string {
    try {
      return atob(obfuscated);
    } catch {
      return '';
    }
  }
}
