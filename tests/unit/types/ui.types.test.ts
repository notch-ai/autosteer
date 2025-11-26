import { SessionTab } from '@/types/ui.types';

describe('MaximizeTab Type', () => {
  it('should accept maximize tab type in SessionTab interface', () => {
    const maximizeTab: SessionTab = {
      id: 'maximize-session-1',
      agentId: 'agent-1',
      agentName: 'Test Session',
      agentType: 'assistant',
      isActive: true,
      sessionId: 'session-1',
      sessionName: 'Swift River',
      lastAccessed: new Date(),
      tabType: 'maximize',
    };

    expect(maximizeTab.tabType).toBe('maximize');
    expect(maximizeTab.agentId).toBe('agent-1');
  });

  it('should allow undefined tabType for backward compatibility', () => {
    const regularTab: SessionTab = {
      id: 'session-1',
      agentId: 'agent-1',
      agentName: 'Test',
      agentType: 'assistant',
      isActive: true,
      sessionId: 'session-1',
      lastAccessed: new Date(),
    };

    expect(regularTab.tabType).toBeUndefined();
  });
});
