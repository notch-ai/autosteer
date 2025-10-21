/**
 * Chat Feature Types
 * Type definitions for chat-related components and functionality
 */

import React from 'react';

export interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose?: () => void;
  position?: { top: number; left: number };
  trigger?: React.ReactNode;
  className?: string;
}

export interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (command: string) => void;
}

export interface TextFormattingMenuProps {
  isVisible: boolean;
  position: { top: number; left: number };
  onFormat: (format: string) => void;
  onClose: () => void;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}

// Hook types
export interface UseRichTextEditorOptions {
  initialValue?: string;
  onChange?: (value: string) => void;
  autoFocus?: boolean;
}

export interface UseRichTextEditorReturn {
  value: string;
  setValue: (value: string) => void;
  editor: unknown; // TipTap editor instance
  isEmpty: boolean;
  isFocused: boolean;
}

// Chat-related utility types
export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'assistant';
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}
