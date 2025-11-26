import { Agent } from '@/entities';
import { ComputedMessage } from '@/stores/chat.selectors';
import { ConfigService } from './ConfigService';
import { PermissionMode } from '@/types/permission.types';
import { ToolUseMessage, ToolResultMessage } from '@/types/streaming.types';

/**
 * Streaming callbacks for real-time updates
 */
export interface StreamingCallbacks {
  onChunk?: (content: string | Record<string, any>) => void; // Can be string or object with token data
  onComplete?: (content: string) => void;
  onError?: (error: Error) => void;
  onResult?: (result: any) => void; // Result message from streaming
  onToolUse?: (message: ToolUseMessage) => void;
  onToolResult?: (message: ToolResultMessage) => void;
}

/**
 * LLM Provider interface
 */
export interface LLMProvider {
  generateResponse(
    userMessage: string,
    agent: Agent,
    attachedResourceIds: string[],
    chatHistory: ComputedMessage[],
    streamingCallbacks?: StreamingCallbacks,
    options?: { permissionMode?: PermissionMode; workingDirectory?: string; projectId?: string }
  ): Promise<string>;
}

/**
 * Configuration for LLM providers
 */
export interface LLMConfig {
  provider: 'mock' | 'claude-code';
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  workingDirectory?: string;
}

/**
 * Main LLM Service that delegates to specific providers
 */
export class LLMService {
  private static provider: LLMProvider;
  private static config: LLMConfig;

  /**
   * Initialize the LLM service with a specific provider
   */
  static async initialize(config?: LLMConfig): Promise<void> {
    console.log('[LLMService] Initializing LLM service...', { configProvided: !!config });

    // Load saved config if not provided
    let finalConfig: LLMConfig;
    if (!config) {
      console.log('[LLMService] No config provided, loading from ConfigService...');
      const savedConfig = ConfigService.loadLLMConfig();
      console.log('[LLMService] Loaded config:', savedConfig);
      finalConfig = savedConfig || { provider: 'claude-code' };
      console.log('[LLMService] Final config:', finalConfig);
    } else {
      console.log('[LLMService] Using provided config:', config);
      finalConfig = config;
    }

    this.config = finalConfig;
    console.log('[LLMService] Saving config to ConfigService...');
    ConfigService.saveLLMConfig(finalConfig);
    console.log('[LLMService] Config saved');

    console.log('[LLMService] Initializing provider:', finalConfig.provider);
    switch (finalConfig.provider) {
      case 'claude-code':
        console.log('[LLMService] Loading ClaudeCodeProvider...');
        const { ClaudeCodeProvider } = await import('./providers/ClaudeCodeProvider');
        console.log('[LLMService] ClaudeCodeProvider loaded, creating instance...');
        this.provider = new ClaudeCodeProvider(finalConfig);
        console.log('[LLMService] ClaudeCodeProvider instance created');
        break;

      case 'mock':
      default:
        console.log('[LLMService] Loading MockLLMProvider...');
        const { MockLLMProvider } = await import('./providers/MockLLMProvider');
        console.log('[LLMService] MockLLMProvider loaded, creating instance...');
        this.provider = new MockLLMProvider(finalConfig);
        console.log('[LLMService] MockLLMProvider instance created');
        break;
    }
    console.log('[LLMService] LLM service initialization complete');
  }

  /**
   * Generate a response using the configured provider
   */
  static async generateResponse(
    userMessage: string,
    agent: Agent,
    attachedResourceIds: string[] = [],
    chatHistory: ComputedMessage[] = [],
    streamingCallbacks?: StreamingCallbacks,
    options?: { permissionMode?: PermissionMode; workingDirectory?: string; projectId?: string }
  ): Promise<string> {
    if (!this.provider) {
      // Initialize with claude-code provider as fallback
      await this.initialize({ provider: 'claude-code' });
    }

    return this.provider.generateResponse(
      userMessage,
      agent,
      attachedResourceIds,
      chatHistory,
      streamingCallbacks,
      options
    );
  }

  /**
   * Get current configuration
   */
  static getConfig(): LLMConfig | undefined {
    return this.config;
  }

  /**
   * Update configuration (requires re-initialization)
   */
  static async updateConfig(config: Partial<LLMConfig>): Promise<void> {
    const newConfig = { ...this.config, ...config };
    await this.initialize(newConfig);
  }

  /**
   * Stop any ongoing streaming
   */
  static stopStreaming(): void {
    // Check if provider has stopStreaming method
    if (this.provider && 'stopStreaming' in this.provider) {
      (this.provider as any).stopStreaming();
    }
  }
}
