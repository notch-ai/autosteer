import log from 'electron-log/renderer';

export interface LogContext {
  branchName?: string;
  agentId?: string;
  projectId?: string;
}

class LoggerService {
  private static instance: LoggerService;
  private context: LogContext = {};

  private constructor() {
    this.initializeLogger();
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private initializeLogger() {
    if (log.transports.file) {
      log.transports.file.level = false;
    }

    if (log.transports.console) {
      log.transports.console.level = false;
    }
  }

  setDevelopmentMode(_enabled: boolean) {
    // Development mode is handled in main process
    // This method exists for compatibility with DevModeToggle
  }

  updateContext(context: Partial<LogContext>) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  private formatMessage(message: string, data?: any): string {
    const contextStr =
      this.context.branchName && this.context.agentId
        ? `[${this.context.branchName} - ${this.context.agentId}] `
        : '';

    let formattedMessage = `${contextStr}${message}`;

    if (data !== undefined) {
      if (typeof data === 'object') {
        try {
          formattedMessage += '\n' + JSON.stringify(data, null, 2);
        } catch (error) {
          formattedMessage += '\n[Unserializable object]';
        }
      } else {
        formattedMessage += ': ' + String(data);
      }
    }

    return formattedMessage;
  }

  debug(message: string, data?: any) {
    const formatted = this.formatMessage(message, data);
    this.sendToMainProcess('debug', formatted);
  }

  info(message: string, data?: any) {
    const formatted = this.formatMessage(message, data);
    this.sendToMainProcess('info', formatted);
  }

  warn(message: string, data?: any) {
    const formatted = this.formatMessage(message, data);
    this.sendToMainProcess('warn', formatted);
  }

  error(message: string, error?: any) {
    const formatted = this.formatMessage(message, error);

    if (error instanceof Error && error.stack) {
      this.sendToMainProcess('error', `${formatted}\nStack trace:\n${error.stack}`);
    } else {
      this.sendToMainProcess('error', formatted);
    }
  }

  private sendToMainProcess(level: string, message: string) {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.invoke(`log:${level}`, message).catch(() => {});
    }
  }

  logClaudeResponse(response: any) {
    const timestamp = new Date().toLocaleString();
    const contextStr =
      this.context.branchName && this.context.agentId
        ? `[${this.context.branchName} - ${this.context.agentId}]`
        : '';

    const separator = '═'.repeat(80);
    const header = `╔${separator}╗`;
    const footer = `╚${separator}╝`;

    let formattedLog = `\n${header}\n`;
    formattedLog += `║ Claude CLI Response - ${timestamp} ${contextStr}\n`;
    formattedLog += `╟${'─'.repeat(80)}╢\n`;

    if (response.result) {
      formattedLog += '║ Result:\n';
      const resultLines = JSON.stringify(response.result, null, 2).split('\n');
      resultLines.forEach((line) => {
        formattedLog += `║   ${line}\n`;
      });
    }

    if (response.todos) {
      formattedLog += `╟${'─'.repeat(80)}╢\n`;
      formattedLog += '║ Todos:\n';
      response.todos.forEach((todo: any, index: number) => {
        formattedLog += `║   ${index + 1}. [${todo.status || 'pending'}] ${todo.content}\n`;
      });
    }

    if (response.usage) {
      formattedLog += `╟${'─'.repeat(80)}╢\n`;
      formattedLog += '║ Token Usage:\n';
      formattedLog += `║   Input: ${response.usage.inputTokens || 0}\n`;
      formattedLog += `║   Output: ${response.usage.outputTokens || 0}\n`;
      formattedLog += `║   Total: ${(response.usage.inputTokens || 0) + (response.usage.outputTokens || 0)}\n`;
      if (response.usage.totalCost) {
        formattedLog += `║   Cost: $${response.usage.totalCost.toFixed(4)}\n`;
      }
    }

    formattedLog += footer;

    this.sendToMainProcess('info', formattedLog);
  }

  getLogPath(): string {
    if (log.transports.file && typeof (log.transports.file as any).getFile === 'function') {
      return (log.transports.file as any).getFile()?.path || 'Unknown';
    }
    return 'Unknown';
  }

  async cleanOldLogs() {
    try {
      await window.electron?.ipcRenderer?.invoke('logs:cleanOldLogs', 7);
      this.info('Old logs cleaned successfully');
    } catch (error) {
      this.error('Failed to clean old logs', error);
    }
  }
}

export const logger = LoggerService.getInstance();
