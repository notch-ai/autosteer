import { forwardRef, HTMLAttributes, InputHTMLAttributes } from 'react';

const CommandRoot = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} {...props} data-testid="command">
      {children}
    </div>
  )
);
CommandRoot.displayName = 'Command';

const CommandInputComponent = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => <input ref={ref} {...props} />
);
CommandInputComponent.displayName = 'CommandInput';

const CommandListComponent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="command-list" {...props}>
      {children}
    </div>
  )
);
CommandListComponent.displayName = 'CommandList';

const CommandEmptyComponent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="command-empty" {...props}>
      {children}
    </div>
  )
);
CommandEmptyComponent.displayName = 'CommandEmpty';

const CommandGroupComponent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="command-group" {...props}>
      {children}
    </div>
  )
);
CommandGroupComponent.displayName = 'CommandGroup';

const CommandItemComponent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} {...props} data-testid="command-item">
      {children}
    </div>
  )
);
CommandItemComponent.displayName = 'CommandItem';

const CommandSeparatorComponent = forwardRef<HTMLHRElement, HTMLAttributes<HTMLHRElement>>(
  (props, ref) => <hr ref={ref} data-testid="command-separator" {...props} />
);
CommandSeparatorComponent.displayName = 'CommandSeparator';

// Export as both named and with Input property for compatibility
export const Command = Object.assign(CommandRoot, {
  Input: CommandInputComponent,
  List: CommandListComponent,
  Empty: CommandEmptyComponent,
  Group: CommandGroupComponent,
  Item: CommandItemComponent,
  Separator: CommandSeparatorComponent,
});

export const CommandInput = CommandInputComponent;
export const CommandList = CommandListComponent;
export const CommandEmpty = CommandEmptyComponent;
export const CommandGroup = CommandGroupComponent;
export const CommandItem = CommandItemComponent;
export const CommandSeparator = CommandSeparatorComponent;
