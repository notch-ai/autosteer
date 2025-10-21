import { SessionBlock } from '@/entities/SessionBlock';
import { LoadedUsageEntry } from '@/entities/LoadedUsageEntry';
import { TokenCounts } from '@/entities/TokenCounts';

describe('SessionBlock', () => {
  const mockDate = new Date('2024-01-01T00:00:00Z');
  const mockEndDate = new Date('2024-01-01T06:00:00Z');

  const createMockEntry = (overrides?: Partial<LoadedUsageEntry>): LoadedUsageEntry => {
    const baseData = {
      timestamp: new Date('2024-01-01T01:00:00Z'),
      model: 'gpt-4',
      usage: new TokenCounts({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationInputTokens: 10,
        cacheReadInputTokens: 5,
      }),
      costUSD: 0.25 as number | null,
    };

    // Apply overrides
    const finalData = { ...baseData };
    if (overrides) {
      if (overrides.timestamp !== undefined) finalData.timestamp = overrides.timestamp;
      if (overrides.model !== undefined) finalData.model = overrides.model;
      if (overrides.usage !== undefined) finalData.usage = overrides.usage;
      if (overrides.costUSD !== undefined) finalData.costUSD = overrides.costUSD;
    }

    return new LoadedUsageEntry({
      ...finalData,
      ...(overrides?.usageLimitResetTime && { usageLimitResetTime: overrides.usageLimitResetTime }),
    });
  };

  describe('constructor', () => {
    it('should create a SessionBlock with required properties', () => {
      const block = new SessionBlock({
        id: 'block-1',
        startTime: mockDate,
        endTime: mockEndDate,
        isActive: false,
      });

      expect(block.id).toBe('block-1');
      expect(block.startTime).toBe(mockDate);
      expect(block.endTime).toBe(mockEndDate);
      expect(block.isActive).toBe(false);
      expect(block.entries).toEqual([]);
      expect(block.tokenCounts.inputTokens).toBe(0);
      expect(block.costUSD).toBe(0);
      expect(block.models).toEqual([]);
    });

    it('should create a SessionBlock with all optional properties', () => {
      const actualEnd = new Date('2024-01-01T05:00:00Z');
      const resetTime = new Date('2024-01-01T12:00:00Z');
      const tokenCounts = new TokenCounts({
        inputTokens: 200,
        outputTokens: 100,
        cacheCreationInputTokens: 20,
        cacheReadInputTokens: 10,
      });

      const block = new SessionBlock({
        id: 'block-1',
        sessionId: 'session-123',
        startTime: mockDate,
        endTime: mockEndDate,
        actualEndTime: actualEnd,
        isActive: true,
        isGap: true,
        entries: [createMockEntry()],
        tokenCounts,
        costUSD: 1.5,
        models: ['gpt-4', 'claude-3'],
        usageLimitResetTime: resetTime,
      });

      expect(block.sessionId).toBe('session-123');
      expect(block.actualEndTime).toBe(actualEnd);
      expect(block.isGap).toBe(true);
      expect(block.entries).toHaveLength(1);
      expect(block.tokenCounts).toBe(tokenCounts);
      expect(block.costUSD).toBe(1.5);
      expect(block.models).toEqual(['gpt-4', 'claude-3']);
      expect(block.usageLimitResetTime).toBe(resetTime);
    });

    it('should handle undefined optional properties', () => {
      const block = new SessionBlock({
        id: 'block-1',
        startTime: mockDate,
        endTime: mockEndDate,
        isActive: false,
      });

      expect(block.sessionId).toBeUndefined();
      expect(block.actualEndTime).toBeUndefined();
      expect(block.isGap).toBeUndefined();
      expect(block.usageLimitResetTime).toBeUndefined();
    });
  });

  describe('addEntry', () => {
    let block: SessionBlock;

    beforeEach(() => {
      block = new SessionBlock({
        id: 'block-1',
        startTime: mockDate,
        endTime: mockEndDate,
        isActive: false,
      });
    });

    it('should add an entry and update token counts', () => {
      const entry = createMockEntry();
      block.addEntry(entry);

      expect(block.entries).toHaveLength(1);
      expect(block.entries[0]).toBe(entry);
      expect(block.tokenCounts.inputTokens).toBe(100);
      expect(block.tokenCounts.outputTokens).toBe(50);
      expect(block.tokenCounts.cacheCreationInputTokens).toBe(10);
      expect(block.tokenCounts.cacheReadInputTokens).toBe(5);
    });

    it('should update cost when entry has costUSD', () => {
      const entry = createMockEntry({ costUSD: 0.5 });
      block.addEntry(entry);

      expect(block.costUSD).toBe(0.5);
    });

    it('should not update cost when entry has null costUSD', () => {
      const entry = createMockEntry({ costUSD: null });
      block.addEntry(entry);

      expect(block.costUSD).toBe(0);
    });

    it('should add new model to models array', () => {
      const entry = createMockEntry({ model: 'claude-3' });
      block.addEntry(entry);

      expect(block.models).toEqual(['claude-3']);
    });

    it('should not duplicate models', () => {
      const entry1 = createMockEntry({ model: 'gpt-4' });
      const entry2 = createMockEntry({ model: 'gpt-4' });

      block.addEntry(entry1);
      block.addEntry(entry2);

      expect(block.models).toEqual(['gpt-4']);
    });

    it('should update actualEndTime to latest entry timestamp', () => {
      const entry1 = createMockEntry({ timestamp: new Date('2024-01-01T02:00:00Z') });
      const entry2 = createMockEntry({ timestamp: new Date('2024-01-01T03:00:00Z') });

      block.addEntry(entry1);
      expect(block.actualEndTime).toEqual(new Date('2024-01-01T02:00:00Z'));

      block.addEntry(entry2);
      expect(block.actualEndTime).toEqual(new Date('2024-01-01T03:00:00Z'));
    });

    it('should not update actualEndTime if entry is older', () => {
      const entry1 = createMockEntry({ timestamp: new Date('2024-01-01T03:00:00Z') });
      const entry2 = createMockEntry({ timestamp: new Date('2024-01-01T02:00:00Z') });

      block.addEntry(entry1);
      block.addEntry(entry2);

      expect(block.actualEndTime).toEqual(new Date('2024-01-01T03:00:00Z'));
    });

    it('should update usageLimitResetTime to latest', () => {
      const resetTime1 = new Date('2024-01-01T10:00:00Z');
      const resetTime2 = new Date('2024-01-01T12:00:00Z');

      const entry1 = createMockEntry({ usageLimitResetTime: resetTime1 });
      const entry2 = createMockEntry({ usageLimitResetTime: resetTime2 });

      block.addEntry(entry1);
      expect(block.usageLimitResetTime).toEqual(resetTime1);

      block.addEntry(entry2);
      expect(block.usageLimitResetTime).toEqual(resetTime2);
    });

    it('should not update usageLimitResetTime if entry has older time', () => {
      const resetTime1 = new Date('2024-01-01T12:00:00Z');
      const resetTime2 = new Date('2024-01-01T10:00:00Z');

      const entry1 = createMockEntry({ usageLimitResetTime: resetTime1 });
      const entry2 = createMockEntry({ usageLimitResetTime: resetTime2 });

      block.addEntry(entry1);
      block.addEntry(entry2);

      expect(block.usageLimitResetTime).toEqual(resetTime1);
    });

    it('should handle entry without usageLimitResetTime', () => {
      const entry = createMockEntry();
      block.addEntry(entry);

      expect(block.usageLimitResetTime).toBeUndefined();
    });

    it('should accumulate multiple entries correctly', () => {
      const entry1 = createMockEntry({
        model: 'gpt-4',
        costUSD: 0.25,
        usage: new TokenCounts({
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationInputTokens: 10,
          cacheReadInputTokens: 5,
        }),
      });

      const entry2 = createMockEntry({
        model: 'claude-3',
        costUSD: 0.35,
        usage: new TokenCounts({
          inputTokens: 200,
          outputTokens: 100,
          cacheCreationInputTokens: 20,
          cacheReadInputTokens: 10,
        }),
      });

      block.addEntry(entry1);
      block.addEntry(entry2);

      expect(block.entries).toHaveLength(2);
      expect(block.tokenCounts.inputTokens).toBe(300);
      expect(block.tokenCounts.outputTokens).toBe(150);
      expect(block.tokenCounts.cacheCreationInputTokens).toBe(30);
      expect(block.tokenCounts.cacheReadInputTokens).toBe(15);
      expect(block.costUSD).toBe(0.6);
      expect(block.models).toEqual(['gpt-4', 'claude-3']);
    });
  });

  describe('getDuration', () => {
    it('should calculate duration using actualEndTime when available', () => {
      const block = new SessionBlock({
        id: 'block-1',
        startTime: mockDate,
        endTime: mockEndDate,
        actualEndTime: new Date('2024-01-01T04:00:00Z'),
        isActive: false,
      });

      const duration = block.getDuration();
      expect(duration).toBe(4 * 60 * 60 * 1000); // 4 hours in milliseconds
    });

    it('should calculate duration using endTime when actualEndTime is not available', () => {
      const block = new SessionBlock({
        id: 'block-1',
        startTime: mockDate,
        endTime: mockEndDate,
        isActive: false,
      });

      const duration = block.getDuration();
      expect(duration).toBe(6 * 60 * 60 * 1000); // 6 hours in milliseconds
    });
  });

  describe('getTotalTokens', () => {
    it('should return sum of all token types', () => {
      const block = new SessionBlock({
        id: 'block-1',
        startTime: mockDate,
        endTime: mockEndDate,
        isActive: false,
        tokenCounts: new TokenCounts({
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationInputTokens: 10,
          cacheReadInputTokens: 5,
        }),
      });

      expect(block.getTotalTokens()).toBe(165);
    });

    it('should return 0 for empty token counts', () => {
      const block = new SessionBlock({
        id: 'block-1',
        startTime: mockDate,
        endTime: mockEndDate,
        isActive: false,
      });

      expect(block.getTotalTokens()).toBe(0);
    });
  });
});
