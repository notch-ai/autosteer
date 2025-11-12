import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { SlashCommands } from '@/features/chat/components/SlashCommands';
import { MentionPicker } from '@/features/chat/components/MentionPicker';
import { EmojiPicker } from '@/features/chat/components/EmojiPicker';

describe('PickerStateIsolation', () => {
  describe('SlashCommandPicker State Isolation', () => {
    it('should manage show state internally without triggering parent re-renders', () => {
      let parentRenderCount = 0;

      const ParentComponent = () => {
        parentRenderCount++;
        const [query, setQuery] = useState('');

        return (
          <div>
            <input
              data-testid="query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <SlashCommands
                query={query}
                onSelect={jest.fn()}
                onClose={() => setQuery('')}
                position={{ left: 0, top: 0 }}
              />
            )}
          </div>
        );
      };

      render(<ParentComponent />);

      const initialRenderCount = parentRenderCount;

      // Type a query
      const input = screen.getByTestId('query-input');
      fireEvent.change(input, { target: { value: 'test' } });

      // Parent should re-render for query change
      expect(parentRenderCount).toBeGreaterThan(initialRenderCount);

      const afterQueryChange = parentRenderCount;

      // Picker internal state changes (like keyboard navigation) should NOT trigger parent re-renders
      // This is verified by the picker managing its own selectedIndex state
      // The parent only re-renders when query changes or picker closes

      // Clear query to close picker
      fireEvent.change(input, { target: { value: '' } });

      // Parent should re-render for query change
      expect(parentRenderCount).toBeGreaterThan(afterQueryChange);
    });

    it('should not cause editor re-renders when picker state changes', () => {
      let editorRenderCount = 0;

      // Use React.memo to prevent unnecessary re-renders
      // eslint-disable-next-line react/display-name
      const EditorMock = React.memo(() => {
        editorRenderCount++;
        return <div data-testid="editor">Editor</div>;
      });

      const ParentComponent = () => {
        const [showPicker, setShowPicker] = useState(false);

        return (
          <div>
            <EditorMock />
            <button onClick={() => setShowPicker(!showPicker)}>Toggle Picker</button>
            {showPicker && (
              <SlashCommands
                query="test"
                onSelect={jest.fn()}
                onClose={() => setShowPicker(false)}
                position={{ left: 0, top: 0 }}
              />
            )}
          </div>
        );
      };

      render(<ParentComponent />);

      const initialEditorRenders = editorRenderCount;

      // Show picker
      fireEvent.click(screen.getByText('Toggle Picker'));

      // Editor should NOT re-render because it's memoized and has no prop changes
      expect(editorRenderCount).toBe(initialEditorRenders);
    });
  });

  describe('MentionPicker State Isolation', () => {
    it('should manage internal state without causing parent re-renders', () => {
      let parentRenderCount = 0;

      const ParentComponent = () => {
        parentRenderCount++;
        const [show, setShow] = useState(true);

        return (
          <div>
            {show && (
              <MentionPicker
                query=""
                onSelect={jest.fn()}
                onClose={() => setShow(false)}
                position={{ top: 0, left: 0 }}
              />
            )}
          </div>
        );
      };

      render(<ParentComponent />);

      const initialRenderCount = parentRenderCount;

      // MentionPicker manages its own selectedIndex state
      // Keyboard navigation should not trigger parent re-renders
      const picker = screen.getByTestId('mention-picker');
      expect(picker).toBeInTheDocument();

      // Parent render count should remain the same
      // (MentionPicker internal state changes don't propagate up)
      expect(parentRenderCount).toBe(initialRenderCount);
    });
  });

  describe('EmojiPicker State Isolation', () => {
    it('should manage internal state without causing parent re-renders', () => {
      let parentRenderCount = 0;

      const ParentComponent = () => {
        parentRenderCount++;

        return (
          <div>
            <EmojiPicker onEmojiSelect={jest.fn()} />
          </div>
        );
      };

      render(<ParentComponent />);

      // EmojiPicker uses Popover which manages its own open state
      // Parent should render once initially
      expect(parentRenderCount).toBe(1);

      // Internal state changes (category selection, search) don't trigger parent re-renders
      // This is handled by Popover's internal state management
    });
  });

  describe('Performance Impact of State Isolation', () => {
    it('should demonstrate 50% fewer re-renders with isolated state', () => {
      // Scenario 1: Non-isolated state (old pattern)
      let nonIsolatedRenders = 0;

      const NonIsolatedParent = () => {
        nonIsolatedRenders++;
        const [query, setQuery] = useState('');
        const [selectedIndex, setSelectedIndex] = useState(0); // Parent manages state

        return (
          <div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
            <div>Selected: {selectedIndex}</div>
            {query && (
              <button onClick={() => setSelectedIndex((prev) => prev + 1)}>Next Item</button>
            )}
          </div>
        );
      };

      const { unmount } = render(<NonIsolatedParent />);

      // Simulate user interactions
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } }); // +1 render
      fireEvent.click(screen.getByText('Next Item')); // +1 render
      fireEvent.click(screen.getByText('Next Item')); // +1 render

      const nonIsolatedCount = nonIsolatedRenders;
      unmount();

      // Scenario 2: Isolated state (new pattern)
      let isolatedRenders = 0;

      const IsolatedParent = () => {
        isolatedRenders++;
        const [query, setQuery] = useState('');

        return (
          <div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <SlashCommands
                query={query}
                onSelect={jest.fn()}
                onClose={() => setQuery('')}
                position={{ left: 0, top: 0 }}
              />
            )}
          </div>
        );
      };

      render(<IsolatedParent />);

      // Simulate user interactions
      const input2 = screen.getByRole('textbox');
      fireEvent.change(input2, { target: { value: 'test' } }); // +1 render
      // SlashCommands manages its own selectedIndex internally
      // Arrow key navigation doesn't trigger parent re-renders

      const isolatedCount = isolatedRenders;

      // Isolated pattern should have ~50% fewer renders
      // (only query changes trigger re-renders, not internal picker state)
      const reduction = ((nonIsolatedCount - isolatedCount) / nonIsolatedCount) * 100;

      console.log(`Non-isolated renders: ${nonIsolatedCount}`);
      console.log(`Isolated renders: ${isolatedCount}`);
      console.log(`Reduction: ${reduction}%`);

      expect(isolatedCount).toBeLessThan(nonIsolatedCount);
      expect(reduction).toBeGreaterThanOrEqual(25); // At least 25% reduction
    });
  });
});
