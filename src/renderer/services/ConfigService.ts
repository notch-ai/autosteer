import { LLMConfig } from './LLMService';
import { BaseService } from './BaseService';

const CONFIG_KEY = 'notch-llm-config';

export class ConfigService extends BaseService {
  private static instance: ConfigService;

  constructor() {
    super('ConfigService');
  }

  static getInstance(): ConfigService {
    if (!this.instance) {
      this.instance = new ConfigService();
    }
    return this.instance;
  }
  /**
   * Save LLM configuration to localStorage
   */
  static saveLLMConfig(config: LLMConfig): void {
    const instance = this.getInstance();
    instance.executeSync(() => {
      const configToSave = {
        ...config,
        apiKey: config.apiKey ? this.obfuscateKey(config.apiKey) : '',
      };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(configToSave));
    }, 'saveLLMConfig');
  }

  /**
   * Load LLM configuration from localStorage
   */
  static loadLLMConfig(): LLMConfig | null {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return null;

    // JSON.parse can fail - this is expected behavior, so we keep try-catch
    try {
      const config = JSON.parse(stored);
      return {
        ...config,
        apiKey: config.apiKey ? this.deobfuscateKey(config.apiKey) : '',
      };
    } catch {
      // Invalid JSON is expected - return null
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
