import { forwardRef, HTMLAttributes } from 'react';

export const Root = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="scroll-area" {...props}>
      {children}
    </div>
  )
);
Root.displayName = 'ScrollArea';

export const Viewport = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="scroll-area-viewport" {...props}>
      {children}
    </div>
  )
);
Viewport.displayName = 'ScrollAreaViewport';

export const ScrollAreaScrollbar = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <div ref={ref} data-testid="scroll-area-scrollbar" {...props} />
);
ScrollAreaScrollbar.displayName = 'ScrollAreaScrollbar';

export const ScrollAreaThumb = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <div ref={ref} data-testid="scroll-area-thumb" {...props} />
);
ScrollAreaThumb.displayName = 'ScrollAreaThumb';

export const ScrollAreaCorner = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <div ref={ref} data-testid="scroll-area-corner" {...props} />
);
ScrollAreaCorner.displayName = 'ScrollAreaCorner';

// Additional named exports needed by ScrollAreaPrimitive
export const Corner = ScrollAreaCorner;

// Main exports
export const ScrollArea = Root;
export const ScrollAreaViewport = Viewport;

// Default export for namespace import
const ScrollAreaPrimitive = {
  Root,
  Viewport,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  Corner: ScrollAreaCorner,
};

export default ScrollAreaPrimitive;
