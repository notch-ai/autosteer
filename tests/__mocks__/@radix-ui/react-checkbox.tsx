import { forwardRef, ReactNode, ButtonHTMLAttributes, MouseEvent } from 'react';

interface CheckboxProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Root = forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ children, checked, onCheckedChange, onClick, ...props }, ref) => {
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      // Call the original onClick if provided
      if (onClick) {
        onClick(e);
      }
      // Call onCheckedChange with the opposite of current checked state
      if (onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    return (
      <button ref={ref} role="checkbox" aria-checked={checked} onClick={handleClick} {...props}>
        {children}
      </button>
    );
  }
);
Root.displayName = 'Checkbox';

export const Indicator = ({ children }: { children?: ReactNode }) => <>{children}</>;

export const Checkbox = Root;
export const CheckboxIndicator = Indicator;
