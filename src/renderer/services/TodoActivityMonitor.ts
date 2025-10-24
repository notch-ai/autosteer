/**
 * TodoActivityMonitor - Infers relationships between todos and Claude Code messages
 *
 * Since Claude Code's output structure is fixed and doesn't provide explicit linking
 * between todos and their execution messages, this service uses temporal analysis,
 * content matching, and contextual clues to infer relationships.
 *
 * Updated to support multi-agent architecture - each agent has its own isolated monitor.
 */

export interface Todo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

export interface TodoWriteMessage {
  type: 'tool_use';
  tool_name: 'TodoWrite';
  tool_input: {
    todos: Todo[];
  };
  timestamp: string;
  messageId: string;
}

export interface InferredActivity {
  messageId: string;
  toolName: string;
  toolInput: Record<string, unknown> | undefined;
  timestamp: string;
  confidence: number;
  reasoning: string;
  toolResult?:
    | {
        structuredPatch?: any;
        [key: string]: any;
      }
    | undefined;
}

export interface TodoActivities {
  todoId: string;
  todoContent: string;
  status: Todo['status'];
  inferredMessages: InferredActivity[];
  activitySummary: string;
  estimatedProgress: number;
  lastUpdated: string;
}

export interface StreamingMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result';
  timestamp: string;
  content?: unknown;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  parentId?: string;
  isSidechain?: boolean;
  tool_id?: string;
  parent_tool_use_id?: string | null;
  parent_message_id?: string; // The ChatMessage ID for generating consistent todo IDs
  toolResult?: {
    structuredPatch?: any;
    [key: string]: any;
  };
}

export interface TaskAgent {
  id: string;
  description: string;
  subagent_type?: string | undefined;
  prompt?: string | undefined;
  timestamp: string;
  status: 'active' | 'completed';
  parentTodoId?: string; // Link to parent todo if launched as part of a todo task
}

export interface TaskAgentActivity {
  taskAgent: TaskAgent;
  inferredMessages: InferredActivity[];
  activitySummary: string;
  lastUpdated: string;
}

export class TodoActivityMonitor {
  // Agent-specific storage: agentId -> data
  private agentData: Map<
    string,
    {
      todoStates: Map<string, Todo[]>;
      messageBuffer: StreamingMessage[];
      todoActivities: Map<string, TodoActivities>;
      activeTodos: Map<string, Todo>;
      taskAgents: Map<string, TaskAgent>;
      taskAgentActivities: Map<string, TaskAgentActivity>;
      isLiveStreaming: boolean;
      lastProcessedSignature?: string | undefined;
      activeContextStack: string[]; // Stack of active todo IDs for parent-child tracking
    }
  > = new Map();

  private currentAgentId: string | null = null;

  constructor() {
    // Initialize with empty state
  }

  /**
   * Set the current agent context (backward compatible with setWorktree)
   */
  setWorktree(agentId: string | null): void {
    this.currentAgentId = agentId;
    if (agentId && !this.agentData.has(agentId)) {
      this.agentData.set(agentId, {
        todoStates: new Map(),
        messageBuffer: [],
        todoActivities: new Map(),
        activeTodos: new Map(),
        taskAgents: new Map(),
        taskAgentActivities: new Map(),
        isLiveStreaming: false,
        activeContextStack: [],
      });
    }
  }

  /**
   * Get data for current agent
   */
  private getCurrentData() {
    if (!this.currentAgentId) {
      // Return empty data if no agent selected
      return {
        todoStates: new Map<string, Todo[]>(),
        messageBuffer: [] as StreamingMessage[],
        todoActivities: new Map<string, TodoActivities>(),
        activeTodos: new Map<string, Todo>(),
        taskAgents: new Map<string, TaskAgent>(),
        taskAgentActivities: new Map<string, TaskAgentActivity>(),
        isLiveStreaming: false,
        lastProcessedSignature: undefined,
        activeContextStack: [] as string[],
      };
    }

    let data = this.agentData.get(this.currentAgentId);
    if (!data) {
      data = {
        todoStates: new Map(),
        messageBuffer: [],
        todoActivities: new Map(),
        activeTodos: new Map(),
        taskAgents: new Map(),
        taskAgentActivities: new Map(),
        isLiveStreaming: false,
        activeContextStack: [],
      };
      this.agentData.set(this.currentAgentId, data);
    }
    return data;
  }

  /**
   * Clear data for current agent
   */
  clear(): void {
    if (this.currentAgentId) {
      const data = this.getCurrentData();
      data.todoStates.clear();
      data.messageBuffer = [];
      data.todoActivities.clear();
      data.activeTodos.clear();
      data.taskAgents.clear();
      data.taskAgentActivities.clear();
      data.isLiveStreaming = false;
      data.lastProcessedSignature = undefined;
      data.activeContextStack = [];
    }
  }

  /**
   * Clear data for specific agent (backward compatible with clearWorktree)
   */
  clearWorktree(agentId: string): void {
    this.agentData.delete(agentId);
  }

  /**
   * Get current agent ID (backward compatible with getCurrentWorktreeId)
   */
  getCurrentWorktreeId(): string | null {
    return this.currentAgentId;
  }

  /**
   * Process streaming message in real-time
   */
  onMessage(message: StreamingMessage): void {
    const data = this.getCurrentData();
    if (!data) {
      return;
    }

    data.isLiveStreaming = true;
    data.messageBuffer.push(message);

    // Process TodoWrite messages
    if (message.type === 'tool_use' && message.tool_name === 'TodoWrite') {
      this.processTodoWriteMessage(message);
    }

    // Process Task agent messages
    if (message.type === 'tool_use' && message.tool_name === 'Task') {
      this.processTaskAgentMessage(message);
    }

    // Process other tool messages for activity inference
    if (
      message.type === 'tool_use' &&
      message.tool_name !== 'TodoWrite' &&
      message.tool_name !== 'Task'
    ) {
      this.inferActivityForTool(message);
    }

    // Process tool results (both with and without parent_tool_use_id)
    if (message.type === 'tool_result') {
      this.processToolResult(message);
    }
  }

  /**
   * Load and process messages from JSONL (for session restore)
   * @param worktreeId - Not used anymore but kept for backward compatibility
   * @param messages - Array of chat messages to process
   */
  loadFromJSONL(_worktreeId: string, messages: any[]): void {
    const data = this.getCurrentData();
    if (!data) return;

    // Clear existing data for fresh load
    data.todoStates.clear();
    data.messageBuffer = [];
    data.todoActivities.clear();
    data.activeTodos.clear();
    data.taskAgents.clear();
    data.taskAgentActivities.clear();
    data.isLiveStreaming = false;
    data.activeContextStack = [];

    // Convert chat messages to streaming messages and process
    for (const msg of messages) {
      if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
        for (const toolCall of msg.toolCalls) {
          const streamingMsg: StreamingMessage = {
            id: toolCall.id || msg.id,
            type: 'tool_use',
            timestamp: msg.timestamp || new Date().toISOString(),
            tool_name: toolCall.name,
            tool_input: toolCall.input,
            parent_tool_use_id: toolCall.parent_tool_use_id || null,
          };
          this.onMessage(streamingMsg);

          // Process tool results if available
          if (toolCall.result) {
            const resultMsg: StreamingMessage = {
              id: `${toolCall.id}_result`,
              type: 'tool_result',
              timestamp: msg.timestamp || new Date().toISOString(),
              parent_tool_use_id: toolCall.id,
              toolResult: toolCall.result,
            };
            this.onMessage(resultMsg);
          }
        }
      }
    }

    // Mark as not live streaming after loading
    data.isLiveStreaming = false;
  }

  /**
   * Process TodoWrite messages to track todo states
   */
  private processTodoWriteMessage(message: StreamingMessage): void {
    const data = this.getCurrentData();
    if (!data || !message.tool_input) return;

    const input = message.tool_input as { todos?: Todo[] };
    if (!input.todos) return;

    // Generate consistent todo IDs using parent_message_id (ChatMessage ID)
    // This matches the ID generation in core.ts for latestTodos
    const parentMessageId = message.parent_message_id || message.id;
    const todosWithIds = input.todos.map((todo: any, index: number) => ({
      ...todo,
      id: todo.id || `todo-${parentMessageId}-${index}`,
    }));

    // Store todo state snapshot
    const messageId = message.id;
    data.todoStates.set(messageId, todosWithIds);

    // Check if this is a continuation of the same task set
    const incomingContents = todosWithIds.map((t) => t.content.trim().toLowerCase()).sort();
    const existingAllTodos = Array.from(data.activeTodos.values());
    const existingContents = existingAllTodos.map((t) => t.content.trim().toLowerCase()).sort();

    const contentSetsMatch =
      incomingContents.length === existingContents.length &&
      incomingContents.every((content, index) => content === existingContents[index]);

    // Check for status regression (completed → pending/in_progress) which indicates a new task
    let hasStatusRegression = false;
    if (contentSetsMatch) {
      for (const incomingTodo of todosWithIds) {
        const matchingExisting = existingAllTodos.find(
          (existing) =>
            existing.content.trim().toLowerCase() === incomingTodo.content.trim().toLowerCase()
        );
        if (
          matchingExisting &&
          matchingExisting.status === 'completed' &&
          (incomingTodo.status === 'pending' || incomingTodo.status === 'in_progress')
        ) {
          hasStatusRegression = true;
          break;
        }
      }
    }

    const isSameTaskSet = contentSetsMatch && !hasStatusRegression;

    for (const todo of todosWithIds) {
      let existingTodo = data.activeTodos.get(todo.id);

      if (!existingTodo && isSameTaskSet) {
        for (const [existingId, existing] of data.activeTodos) {
          const existingContent = existing.content.trim().toLowerCase();
          const newContent = todo.content.trim().toLowerCase();

          if (existingContent === newContent) {
            existingTodo = existing;
            todo.id = existingId;
            break;
          }
        }
      }

      // Track status changes
      if (existingTodo && existingTodo.status !== todo.status) {
        // Status changed, update activity
        this.updateTodoActivity(todo, message, 'status_change');

        // Update context stack based on status change
        if (todo.status === 'in_progress') {
          // Add to context stack if not already there
          if (!data.activeContextStack.includes(todo.id)) {
            data.activeContextStack.push(todo.id);
          }
        } else if (todo.status === 'completed' || todo.status === 'pending') {
          // Remove from context stack
          data.activeContextStack = data.activeContextStack.filter((id) => id !== todo.id);
        }
      } else if (!existingTodo) {
        // New todo
        this.updateTodoActivity(todo, message, 'created');

        // If new todo is in_progress, add to context stack
        if (todo.status === 'in_progress') {
          data.activeContextStack.push(todo.id);
        }
      }

      // Update active todo
      data.activeTodos.set(todo.id, todo);
    }

    // Check for removed todos
    const currentTodoIds = new Set(todosWithIds.map((t) => t.id));
    for (const [todoId] of data.activeTodos) {
      if (!currentTodoIds.has(todoId)) {
        data.activeTodos.delete(todoId);
        // Mark as completed if it was removed from the list
        const activity = data.todoActivities.get(todoId);
        if (activity && activity.status !== 'completed') {
          activity.status = 'completed';
          activity.lastUpdated = new Date().toISOString();
        }
      }
    }
  }

  /**
   * Process Task agent messages
   */
  private processTaskAgentMessage(message: StreamingMessage): void {
    const data = this.getCurrentData();
    if (!data || !message.tool_input) return;

    const input = message.tool_input as {
      description?: string;
      prompt?: string;
      subagent_type?: string;
    };

    // Try semantic matching first
    let parentTodoId = this.findSemanticMatch(input.description || 'Task Agent', data.activeTodos);

    // Fall back to temporal context if no semantic match found
    if (!parentTodoId && data.activeContextStack.length > 0) {
      parentTodoId = data.activeContextStack[data.activeContextStack.length - 1];
    }

    const taskAgent: TaskAgent = {
      id: message.id,
      description: input.description || 'Task Agent',
      subagent_type: input.subagent_type,
      prompt: input.prompt,
      timestamp: message.timestamp,
      status: 'active',
      ...(parentTodoId ? { parentTodoId } : {}), // Only add parentTodoId if it exists
    };

    data.taskAgents.set(taskAgent.id, taskAgent);

    // Create task agent activity
    const activity: TaskAgentActivity = {
      taskAgent,
      inferredMessages: [],
      activitySummary: `${taskAgent.subagent_type || 'Task'} agent started`,
      lastUpdated: new Date().toISOString(),
    };

    data.taskAgentActivities.set(taskAgent.id, activity);
  }

  /**
   * Infer activity for other tool uses
   */
  private inferActivityForTool(message: StreamingMessage): void {
    const data = this.getCurrentData();
    if (!data) return;

    // Find the most recent in-progress todo
    let targetTodo: Todo | null = null;
    for (const todo of data.activeTodos.values()) {
      if (todo.status === 'in_progress') {
        targetTodo = todo;
        break;
      }
    }

    if (!targetTodo) {
      // No in-progress todo, try to find any pending todo
      for (const todo of data.activeTodos.values()) {
        if (todo.status === 'pending') {
          targetTodo = todo;
          break;
        }
      }
    }

    if (targetTodo) {
      const inferredActivity: InferredActivity = {
        messageId: message.id,
        toolName: message.tool_name || 'unknown',
        toolInput: message.tool_input,
        timestamp: message.timestamp,
        confidence: 0.7, // Medium confidence for temporal inference
        reasoning: 'Temporally related to active todo',
      };

      const activity = data.todoActivities.get(targetTodo.id);
      if (activity) {
        activity.inferredMessages.push(inferredActivity);
        activity.lastUpdated = new Date().toISOString();
        this.updateActivitySummary(activity);
      }
    }

    // Check if this tool was called BY a specific agent using parent_tool_use_id
    if (message.parent_tool_use_id) {
      // Check if the parent is a task agent
      const parentAgent = data.taskAgents.get(message.parent_tool_use_id);
      if (parentAgent) {
        // This tool was called directly by this agent
        const taskActivity = data.taskAgentActivities.get(parentAgent.id);
        if (taskActivity) {
          const inferredActivity: InferredActivity = {
            messageId: message.id,
            toolName: message.tool_name || 'unknown',
            toolInput: message.tool_input,
            timestamp: message.timestamp,
            confidence: 1.0, // High confidence - we know the parent
            reasoning: 'Called by parent task agent',
          };
          taskActivity.inferredMessages.push(inferredActivity);
          taskActivity.lastUpdated = new Date().toISOString();
        }
        // IMPORTANT: Return early - this tool belongs to the agent, not to a todo
        return;
      }
    }

    // If we reach here, this is a main assistant tool (no parent_tool_use_id)
    // It should ONLY be associated with todos, never with agents
    // The todo association code above (lines 411-446) already handled this
  }

  /**
   * Extract tool_use_id from a tool_result message content
   */
  private extractToolUseId(message: StreamingMessage): string | undefined {
    // Tool results can have the tool_use_id in the content structure
    if (message.content && typeof message.content === 'object') {
      const content = message.content as any;
      if (Array.isArray(content)) {
        // Check first item for tool_use_id
        return content[0]?.tool_use_id;
      } else if (content.tool_use_id) {
        return content.tool_use_id;
      }
    }
    // Also check if tool_id exists at message level
    if (message.tool_id) {
      return message.tool_id;
    }
    return undefined;
  }

  /**
   * Process tool results to attach to activities
   */
  private processToolResult(message: StreamingMessage): void {
    const data = this.getCurrentData();
    if (!data) return;

    // Case 1: Check if this is a Task agent completion (final result)
    // These have tool_use_id matching a Task agent but no parent_tool_use_id
    if (!message.parent_tool_use_id) {
      const toolUseId = this.extractToolUseId(message);
      if (toolUseId) {
        const taskAgent = data.taskAgents.get(toolUseId);
        if (taskAgent && taskAgent.status === 'active') {
          // Mark the agent as completed
          taskAgent.status = 'completed';

          // Also update the task activity
          const taskActivity = data.taskAgentActivities.get(taskAgent.id);
          if (taskActivity) {
            taskActivity.taskAgent.status = 'completed';
            taskActivity.lastUpdated = new Date().toISOString();
            taskActivity.activitySummary = `${taskAgent.subagent_type || 'Task'} agent completed`;
          }
        }
      }
    }

    // Case 2: Tool results with parent_tool_use_id (intermediate results from agent tools)
    // These are results from tools called BY agents
    if (message.parent_tool_use_id) {
      // Check if the parent is a task agent (for future use)
      const taskAgent = data.taskAgents.get(message.parent_tool_use_id);
      if (taskAgent) {
        // This is a tool result from inside an agent
        // The agent is still running, don't mark it complete yet
      }
    }

    // Find the parent tool use in todo activities
    for (const activity of data.todoActivities.values()) {
      const parentActivity = activity.inferredMessages.find(
        (msg) => msg.messageId === message.parent_tool_use_id
      );
      if (parentActivity) {
        parentActivity.toolResult = message.toolResult;
        activity.lastUpdated = new Date().toISOString();
        this.updateActivitySummary(activity);
      }
    }

    // Check task agent activities
    for (const taskActivity of data.taskAgentActivities.values()) {
      const parentActivity = taskActivity.inferredMessages.find(
        (msg) => msg.messageId === message.parent_tool_use_id
      );
      if (parentActivity) {
        parentActivity.toolResult = message.toolResult;
        taskActivity.lastUpdated = new Date().toISOString();
      }
    }
  }

  /**
   * Update todo activity
   */
  private updateTodoActivity(todo: Todo, message: StreamingMessage, action: string): void {
    const data = this.getCurrentData();
    if (!data) return;

    let activity = data.todoActivities.get(todo.id);
    if (!activity) {
      activity = {
        todoId: todo.id,
        todoContent: todo.content,
        status: todo.status,
        inferredMessages: [],
        activitySummary: '',
        estimatedProgress: 0,
        lastUpdated: new Date().toISOString(),
      };
      data.todoActivities.set(todo.id, activity);
    }

    activity.status = todo.status;
    activity.todoContent = todo.content;
    activity.lastUpdated = new Date().toISOString();

    // Add the TodoWrite message itself as an activity
    const inferredActivity: InferredActivity = {
      messageId: message.id,
      toolName: 'TodoWrite',
      toolInput: message.tool_input,
      timestamp: message.timestamp,
      confidence: 1.0, // High confidence for direct TodoWrite
      reasoning: `Todo ${action}`,
    };
    activity.inferredMessages.push(inferredActivity);

    this.updateActivitySummary(activity);
    this.updateProgress(activity);
  }

  /**
   * Update activity summary based on inferred messages
   */
  private updateActivitySummary(activity: TodoActivities): void {
    const toolCounts = new Map<string, number>();
    for (const msg of activity.inferredMessages) {
      const count = toolCounts.get(msg.toolName) || 0;
      toolCounts.set(msg.toolName, count + 1);
    }

    const summaryParts: string[] = [];
    for (const [tool, count] of toolCounts) {
      if (tool === 'TodoWrite') continue; // Skip TodoWrite in summary
      summaryParts.push(`${tool} (${count}x)`);
    }

    activity.activitySummary =
      summaryParts.length > 0 ? summaryParts.join(', ') : 'No activities yet';
  }

  /**
   * Update estimated progress
   */
  private updateProgress(activity: TodoActivities): void {
    if (activity.status === 'completed') {
      activity.estimatedProgress = 100;
    } else if (activity.status === 'in_progress') {
      // Estimate based on number of activities
      const activityCount = activity.inferredMessages.length;
      activity.estimatedProgress = Math.min(50 + activityCount * 10, 90);
    } else {
      activity.estimatedProgress = 0;
    }
  }

  /**
   * Get all todo activities
   */
  getAllActivities(): TodoActivities[] {
    const data = this.getCurrentData();
    if (!data) return [];
    return Array.from(data.todoActivities.values());
  }

  /**
   * Get all task agent activities
   */
  getAllTaskAgentActivities(): TaskAgentActivity[] {
    const data = this.getCurrentData();
    if (!data) return [];
    return Array.from(data.taskAgentActivities.values());
  }

  /**
   * Get current todos
   */
  getCurrentTodos(): Todo[] {
    const data = this.getCurrentData();
    if (!data) return [];
    return Array.from(data.activeTodos.values());
  }

  /**
   * Get recent todos for logging
   */
  getRecentTodos(): Todo[] {
    return this.getCurrentTodos();
  }

  /**
   * Find semantic match between agent description and todos
   */
  private findSemanticMatch(agentDesc: string, todos: Map<string, Todo>): string | undefined {
    let bestMatch: { todoId: string; score: number } | undefined;

    for (const [todoId, todo] of todos) {
      const score = this.calculateMatchScore(agentDesc, todo.content);

      // Only consider matches above threshold (0.5)
      if (score > 0.5) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { todoId, score };
        }
      }
    }

    return bestMatch?.todoId;
  }

  /**
   * Calculate match score between agent description and todo content
   */
  private calculateMatchScore(agentDesc: string, todoContent: string): number {
    // Remove common prefixes from todo content
    const cleanedTodo = todoContent
      .replace(/^agent\s+\d+:\s*/i, '') // Remove "Agent 1:", "Agent 2:", etc.
      .replace(/^task\s+\d+:\s*/i, '') // Remove "Task 1:", etc.
      .trim();

    const agentLower = agentDesc.toLowerCase();
    const todoLower = cleanedTodo.toLowerCase();

    // 1. Exact substring match (highest confidence)
    if (todoLower.includes(agentLower) || agentLower.includes(todoLower)) {
      return 1.0;
    }

    // 2. Check for file name matches (very strong signal)
    const todoFiles = this.extractFileNames(todoLower);
    const agentFiles = this.extractFileNames(agentLower);

    if (todoFiles.length > 0 && agentFiles.length > 0) {
      // Check if any files match
      const fileMatch = todoFiles.some((f) => agentFiles.includes(f));
      if (fileMatch) {
        return 0.9;
      }
    }

    // 3. Token-based similarity
    const agentTokens = this.tokenize(agentLower);
    const todoTokens = this.tokenize(todoLower);

    // Calculate Jaccard similarity
    const intersection = agentTokens.filter((token) => todoTokens.includes(token));
    const union = [...new Set([...agentTokens, ...todoTokens])];

    if (union.length === 0) return 0;

    const jaccardScore = intersection.length / union.length;

    // 4. Check for key action verbs matching
    const agentActions = this.extractActions(agentLower);
    const todoActions = this.extractActions(todoLower);

    const actionMatch = agentActions.some((a) => todoActions.includes(a));
    const actionBonus = actionMatch ? 0.2 : 0;

    return Math.min(1.0, jaccardScore + actionBonus);
  }

  /**
   * Extract file names from text
   */
  private extractFileNames(text: string): string[] {
    const filePattern = /[\w-]+\.\w+/g;
    const matches = text.match(filePattern) || [];
    return matches.map((f) => f.toLowerCase());
  }

  /**
   * Extract action verbs from text
   */
  private extractActions(text: string): string[] {
    const actionPattern =
      /\b(create|update|modify|write|edit|build|make|generate|add|remove|delete)\b/gi;
    const matches = text.match(actionPattern) || [];
    return matches.map((a) => a.toLowerCase());
  }

  /**
   * Tokenize text into meaningful words
   */
  private tokenize(text: string): string[] {
    // Remove punctuation and split into words
    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);

    // Remove common stop words
    const stopWords = new Set([
      'the',
      'and',
      'or',
      'with',
      'for',
      'to',
      'from',
      'of',
      'in',
      'on',
      'at',
    ]);

    return words.filter((word) => !stopWords.has(word));
  }
}

export const todoActivityMonitor = new TodoActivityMonitor();
