# Sonner Toast Component Usage

The Sonner component has been added to the UI components library with AutoSteer theming support. It provides a modern, accessible toast notification system.

## Setup

To use Sonner in your app, add the `<Toaster />` component to your root layout:

```tsx
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <>
      {/* Your app content */}
      <Toaster />
    </>
  );
}
```

## Basic Usage

Import the `toast` function from the sonner component:

```tsx
import { toast } from '@/components/ui/sonner';

// Show different toast types
toast('Default notification');
toast.success('Operation completed successfully!');
toast.error('Something went wrong');
toast.warning('Please check your input');
toast.info('Here is some information');
```

## Advanced Usage

### Toast with Description
```tsx
toast('Event Created', {
  description: 'Monday, January 3rd at 6:00pm',
});
```

### Toast with Action Buttons
```tsx
toast('File uploaded', {
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo clicked'),
  },
});
```

### Promise Toast
```tsx
const myPromise = fetch('/api/data');

toast.promise(myPromise, {
  loading: 'Loading...',
  success: 'Data loaded successfully',
  error: 'Error loading data',
});
```

### Loading Toast
```tsx
const toastId = toast.loading('Processing...');

// Later update it
toast.success('Process completed!', {
  id: toastId,
});
```

## Theming

The Sonner component automatically adapts to the current theme (day/night) using the AutoSteer color system:

- **Night Theme**: Dark backgrounds with cyan accents
- **Day Theme**: Light backgrounds with adjusted contrast

## Migration from react-toastify

To migrate from the existing `react-toastify` to Sonner:

1. Replace `ToastProvider` with `Toaster` component
2. Replace `toast` imports from 'react-toastify' with imports from '@/components/ui/sonner'
3. Update toast calls (the API is very similar)

### Before (react-toastify):
```tsx
import { toast } from 'react-toastify';
toast.success('Success!');
```

### After (Sonner):
```tsx
import { toast } from '@/components/ui/sonner';
toast.success('Success!');
```

## Storybook

View all toast variations and test them in both themes:
```bash
npm run storybook
# Navigate to UI/Sonner
```

## Features

- ✅ Accessible (ARIA compliant)
- ✅ Stackable toasts
- ✅ Promise support
- ✅ Custom styling
- ✅ AutoSteer theme integration
- ✅ Day/Night mode support
- ✅ TypeScript support
- ✅ Customizable positions
- ✅ Rich content support