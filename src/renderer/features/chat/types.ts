export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    tokens?: number;
    model?: string;
    cost?: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  metadata?: {
    totalTokens?: number;
    totalCost?: number;
    model?: string;
  };
}

export interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  recentEmojis?: string[];
  maxRecent?: number;
}

export interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCommandSelect: (command: string) => void;
  commands?: Array<{
    id: string;
    name: string;
    description?: string;
    shortcut?: string;
  }>;
}

export interface TextFormattingMenuProps {
  onFormat: (format: string) => void;
  selectedText?: string;
  position?: { x: number; y: number };
}

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  onSubmit?: () => void;
  disabled?: boolean;
}

export interface UseRichTextEditorOptions {
  maxLength?: number;
  autoFocus?: boolean;
  onSubmit?: () => void;
  onChange?: (value: string) => void;
}
