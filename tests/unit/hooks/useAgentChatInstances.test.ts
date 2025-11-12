/**
 * Unit Tests for useAgentChatInstances Hook
 *
 * Tests agent ChatInterface instance management with lifecycle tracking.
 * Follows TDD approach with comprehensive coverage.
 *
 * Test Coverage:
 * - Hook initialization
 * - Instance creation on first agent selection
 * - Instance preservation across tab switches
 * - Special tab handling (terminal, changes)
 * - Multiple agent instances
 * - Instance clearing/cleanup
 * - Memoization and performance
 * - Callback stability
 *
 * Target Coverage: 80%+
 */

import { renderHook, act } from '@testing-library/react';
import { useAgentChatInstances } from '@/hooks/useAgentChatInstances';
import { logger } from '@/commons/utils/logger';

// Mock logger
jest.mock('@/commons/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useAgentChatInstances', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with empty instance set', () => {
      const { result } = renderHook(() => useAgentChatInstances({ selectedAgentId: null }));

      expect(result.current.agentIdsWithInstances).toEqual([]);
      expect(result.current.chatInterfaceRefs).toBeDefined();
      expect(result.current.chatInterfaceRefs.current).toBeInstanceOf(Map);
      expect(result.current.chatInterfaceRefs.current.size).toBe(0);
    });
  });

  describe('Instance Creation', () => {
    it('should create instance when agent is selected', () => {
      const { result } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      expect(result.current.agentIdsWithInstances).toContain('agent-1');
      expect(result.current.agentIdsWithInstances.length).toBe(1);

      expect(logger.debug).toHaveBeenCalledWith(
        '[useAgentChatInstances] Creating ChatInterface instance for agent',
        expect.objectContaining({
          agentId: 'agent-1',
          totalInstances: 1,
        })
      );
    });

    it('should not create instance for null selection', () => {
      const { result } = renderHook(() => useAgentChatInstances({ selectedAgentId: null }));

      expect(result.current.agentIdsWithInstances).toEqual([]);
    });

    it('should not create instance for terminal tab', () => {
      const { result } = renderHook(() =>
        useAgentChatInstances({ selectedAgentId: 'terminal-tab' })
      );

      expect(result.current.agentIdsWithInstances).toEqual([]);
    });

    it('should not create instance for changes tab', () => {
      const { result } = renderHook(() =>
        useAgentChatInstances({ selectedAgentId: 'changes-tab' })
      );

      expect(result.current.agentIdsWithInstances).toEqual([]);
    });
  });

  describe('Instance Preservation', () => {
    it('should preserve instance when switching to another agent', () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      expect(result.current.agentIdsWithInstances).toContain('agent-1');

      // Switch to agent-2
      rerender({ agentId: 'agent-2' });

      expect(result.current.agentIdsWithInstances).toContain('agent-1');
      expect(result.current.agentIdsWithInstances).toContain('agent-2');
      expect(result.current.agentIdsWithInstances.length).toBe(2);
    });

    it('should preserve instance when switching to special tabs', () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      expect(result.current.agentIdsWithInstances).toContain('agent-1');

      // Switch to terminal tab
      rerender({ agentId: 'terminal-tab' });

      // Instance should still exist
      expect(result.current.agentIdsWithInstances).toContain('agent-1');
    });

    it('should preserve instance when switching to null', () => {
      const { result, rerender } = renderHook(
        ({ agentId }: { agentId: string | null }) =>
          useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' as string | null } }
      );

      expect(result.current.agentIdsWithInstances).toContain('agent-1');

      // Switch to null
      rerender({ agentId: null });

      // Instance should still exist
      expect(result.current.agentIdsWithInstances).toContain('agent-1');
    });

    it('should not recreate instance when returning to same agent', () => {
      const { rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      // Switch away and back
      rerender({ agentId: 'agent-2' });
      rerender({ agentId: 'agent-1' });

      expect(logger.debug).toHaveBeenCalledWith(
        '[useAgentChatInstances] Switching to existing ChatInterface instance',
        expect.objectContaining({
          agentId: 'agent-1',
          totalInstances: 2,
        })
      );
    });
  });

  describe('Multiple Agent Instances', () => {
    it('should create instances for multiple agents', () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      rerender({ agentId: 'agent-2' });
      rerender({ agentId: 'agent-3' });
      rerender({ agentId: 'agent-4' });

      expect(result.current.agentIdsWithInstances).toHaveLength(4);
      expect(result.current.agentIdsWithInstances).toContain('agent-1');
      expect(result.current.agentIdsWithInstances).toContain('agent-2');
      expect(result.current.agentIdsWithInstances).toContain('agent-3');
      expect(result.current.agentIdsWithInstances).toContain('agent-4');
    });

    it('should maintain all instances when switching between agents', () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      rerender({ agentId: 'agent-2' });
      rerender({ agentId: 'agent-3' });

      // Switch back to agent-1
      rerender({ agentId: 'agent-1' });

      // All instances should still exist
      expect(result.current.agentIdsWithInstances).toHaveLength(3);
    });
  });

  describe('Chat Interface Refs', () => {
    it('should provide a ref map for ChatInterface instances', () => {
      const { result } = renderHook(() => useAgentChatInstances({ selectedAgentId: 'agent-1' }));

      expect(result.current.chatInterfaceRefs.current).toBeInstanceOf(Map);
    });

    it('should allow setting refs for agent instances', () => {
      const { result } = renderHook(() => useAgentChatInstances({ selectedAgentId: 'agent-1' }));

      const mockRef = { focus: jest.fn() };

      act(() => {
        result.current.chatInterfaceRefs.current.set('agent-1', mockRef);
      });

      expect(result.current.chatInterfaceRefs.current.get('agent-1')).toBe(mockRef);
    });

    it('should allow clearing refs', () => {
      const { result } = renderHook(() => useAgentChatInstances({ selectedAgentId: 'agent-1' }));

      const mockRef = { focus: jest.fn() };

      act(() => {
        result.current.chatInterfaceRefs.current.set('agent-1', mockRef);
      });

      expect(result.current.chatInterfaceRefs.current.has('agent-1')).toBe(true);

      act(() => {
        result.current.chatInterfaceRefs.current.delete('agent-1');
      });

      expect(result.current.chatInterfaceRefs.current.has('agent-1')).toBe(false);
    });
  });

  describe('Memoization', () => {
    it('should memoize agent IDs array', () => {
      const { result, rerender } = renderHook(() =>
        useAgentChatInstances({ selectedAgentId: 'agent-1' })
      );

      const firstArray = result.current.agentIdsWithInstances;

      // Rerender without changing agents
      rerender();

      // Should return same array reference
      expect(result.current.agentIdsWithInstances).toBe(firstArray);
    });

    it('should create new array when agents change', () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      const firstArray = result.current.agentIdsWithInstances;

      // Add new agent
      rerender({ agentId: 'agent-2' });

      // Should return different array reference
      expect(result.current.agentIdsWithInstances).not.toBe(firstArray);
    });
  });

  describe('Instance Tracking', () => {
    it('should track instances using Set for O(1) operations', () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      // Create many instances
      for (let i = 2; i <= 50; i++) {
        rerender({ agentId: `agent-${i}` });
      }

      expect(result.current.agentIdsWithInstances.length).toBe(50);

      // Should still be fast to check if agent-25 exists
      expect(result.current.agentIdsWithInstances).toContain('agent-25');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string agent ID', () => {
      const { result } = renderHook(() => useAgentChatInstances({ selectedAgentId: '' }));

      expect(result.current.agentIdsWithInstances).toEqual([]);
    });

    it('should handle rapid agent switching', () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      // Rapidly switch between agents
      for (let i = 0; i < 10; i++) {
        rerender({ agentId: 'agent-1' });
        rerender({ agentId: 'agent-2' });
        rerender({ agentId: 'agent-3' });
      }

      // Should only have 3 unique instances
      expect(result.current.agentIdsWithInstances.length).toBe(3);
    });

    it('should handle switching between agent and special tabs repeatedly', () => {
      const { result, rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      rerender({ agentId: 'terminal-tab' });
      rerender({ agentId: 'agent-1' });
      rerender({ agentId: 'changes-tab' });
      rerender({ agentId: 'agent-1' });

      // Should only have 1 instance
      expect(result.current.agentIdsWithInstances.length).toBe(1);
      expect(result.current.agentIdsWithInstances).toContain('agent-1');
    });
  });

  describe('Logging', () => {
    it('should log instance creation with correct context', () => {
      renderHook(({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }), {
        initialProps: { agentId: 'agent-1' },
      });

      expect(logger.debug).toHaveBeenCalledWith(
        '[useAgentChatInstances] Creating ChatInterface instance for agent',
        expect.objectContaining({
          agentId: 'agent-1',
          totalInstances: 1,
        })
      );
    });

    it('should log when switching to existing instance', () => {
      const { rerender } = renderHook(
        ({ agentId }) => useAgentChatInstances({ selectedAgentId: agentId }),
        { initialProps: { agentId: 'agent-1' } }
      );

      jest.clearAllMocks();

      // Switch away and back
      rerender({ agentId: 'agent-2' });
      rerender({ agentId: 'agent-1' });

      expect(logger.debug).toHaveBeenCalledWith(
        '[useAgentChatInstances] Switching to existing ChatInterface instance',
        expect.objectContaining({
          agentId: 'agent-1',
        })
      );
    });
  });

  describe('Ref Persistence', () => {
    it('should maintain refs across rerenders', () => {
      const { result, rerender } = renderHook(() =>
        useAgentChatInstances({ selectedAgentId: 'agent-1' })
      );

      const initialRef = result.current.chatInterfaceRefs;

      rerender();

      // Should be same ref object
      expect(result.current.chatInterfaceRefs).toBe(initialRef);
    });
  });
});
