/**
 * TypeScript interfaces for Claude Code service integration
 */

export interface ClaudeCodeMessage {
  content: string;
  sessionId: string;
}

export interface ClaudeCodeOptions {
  sessionId?: string;
  timeout?: number;
}

export interface ClaudeCodeService {
  sendMessage(message: string, options?: ClaudeCodeOptions): Promise<ClaudeCodeMessage>;
  abortRequest(): void;
  clearSession(sessionId: string): Promise<void>;
  initializeSession(): Promise<string>;
}

export interface ClaudeCodeConfig {
  mode: 'local' | 'api';
  apiUrl?: string;
}

export interface APIPromptResponse {
  success: true;
  data: {
    result: string;
    session_id: string;
  };
}

export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

export type APIResponse = APIPromptResponse | APIErrorResponse;

export interface APIPromptRequest {
  user: string;
}
