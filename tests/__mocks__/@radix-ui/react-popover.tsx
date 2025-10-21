import {
  forwardRef,
  ReactNode,
  ButtonHTMLAttributes,
  HTMLAttributes,
  isValidElement,
  cloneElement,
  ReactElement,
} from 'react';

export const Root = ({ children }: { children: ReactNode }) => <>{children}</>;

interface TriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  children?: ReactNode;
}

export const Trigger = forwardRef<HTMLButtonElement, TriggerProps>(
  ({ children, asChild, ...props }, ref) => {
    // If asChild is true, render the child directly with props
    if (asChild && isValidElement(children)) {
      return cloneElement(children as ReactElement<any>, { ref, ...props });
    }
    // Otherwise render as a button
    return (
      <button ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
Trigger.displayName = 'PopoverTrigger';

export const Portal = ({ children }: { children: ReactNode }) => <>{children}</>;

export const Content = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { sideOffset?: number; align?: string; side?: string }
>(({ children, sideOffset, align, side, ...props }, ref) => (
  <div ref={ref} data-testid="popover-content" {...props}>
    {children}
  </div>
));
Content.displayName = 'PopoverContent';

export const Popover = Root;
export const PopoverTrigger = Trigger;
export const PopoverContent = Content;
export const PopoverPortal = Portal;

// Default export for namespace import
const PopoverPrimitive = {
  Root,
  Trigger,
  Content,
  Portal,
};

export default PopoverPrimitive;
