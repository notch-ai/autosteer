# Feature Components

This directory contains Feature components that preserve legacy APIs while using modern UI components internally. These components maintain 100% backward compatibility while providing the benefits of the new shadcn/ui component system.

## Purpose

Feature components serve as a bridge during the migration from legacy components to the new UI system. They:

1. **Preserve Legacy APIs**: Maintain exact compatibility with existing component interfaces
2. **Use Modern UI**: Internally leverage shadcn/ui components for improved accessibility and styling
3. **Enable Gradual Migration**: Allow teams to migrate at their own pace
4. **Maintain Functionality**: All existing features and behaviors are preserved

## Available Components

### Core Components
- **Button**: Primary interaction component with variants and sizes
- **Input**: Text input with icons, states, and variants (includes Textarea, Select)
- **FormButton**: Specialized button for forms with loading states

### Layout & Display
- **Modal**: Dialog system with legacy modal API
- **Skeleton**: Loading placeholders with multiple variants
- **DropdownSelector**: Dropdown selection with icon support

### Feedback
- **Toast**: Notification system using modern sonner internally
- **ConfirmDialog**: Confirmation dialogs with variant support

## Usage

### Import from Feature Components
```typescript
// Recommended for new code
import { Button, Input, Modal } from '@/components/feature';

// Individual imports also work
import { Button } from '@/components/feature/Button';
```

### Exact API Compatibility
```typescript
// Legacy usage continues to work exactly the same
<Button variant="primary" size="md" onClick={handleClick}>
  Click me
</Button>

<Input 
  variant="default" 
  size="md" 
  state="error" 
  leftIcon={<SearchIcon />}
  placeholder="Search..."
/>

<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Confirm Action"
  primaryAction={{ label: "Confirm", onClick: handleConfirm }}
  secondaryAction={{ label: "Cancel", onClick: handleClose }}
>
  Are you sure you want to proceed?
</Modal>
```

## Migration Benefits

1. **Zero Breaking Changes**: All existing code continues to work
2. **Improved Accessibility**: Benefits from radix-ui primitives
3. **Better Performance**: Optimized React patterns and rendering
4. **Consistent Design**: Shared design tokens and styling
5. **Enhanced Features**: Additional capabilities from modern components

## Testing

API compatibility is tested in `__tests__/api-compatibility.test.tsx` to ensure:
- All legacy props are accepted
- Type compatibility is maintained
- Rendering works with all variants and configurations

## Migration Strategy

1. **Phase 1**: Use feature components for new development
2. **Phase 2**: Gradually update imports in existing code
3. **Phase 3**: Deprecate legacy components after full adoption

See `MIGRATION_TABLE.md` for detailed component mapping and migration status.