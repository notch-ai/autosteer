/**
 * SDK-compliant Todo/Task types
 */

// Core SDK structure
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

// Extended structure
export interface Todo extends TodoItem {
  id: string;
}

export type Task = Todo;