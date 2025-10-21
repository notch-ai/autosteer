import { Agent, Resource } from '@/entities';

export interface SelectionState {
  selectedAgentId: string | null;
  selectedResourceId: string | null;
  selectedAgent: Agent | null;
  selectedResources: Resource[];
}

type SelectionListener = (state: SelectionState) => void;

export class SelectionService {
  private static instance: SelectionService;
  private state: SelectionState = {
    selectedAgentId: null,
    selectedResourceId: null,
    selectedAgent: null,
    selectedResources: [],
  };
  private listeners: SelectionListener[] = [];

  private constructor() {}

  static getInstance(): SelectionService {
    if (!SelectionService.instance) {
      SelectionService.instance = new SelectionService();
    }
    return SelectionService.instance;
  }

  getState(): SelectionState {
    return { ...this.state };
  }

  selectAgent(agent: Agent | null, resources: Resource[] = []): void {
    this.state = {
      selectedAgentId: agent?.id || null,
      selectedResourceId: null,
      selectedAgent: agent,
      selectedResources: resources,
    };
    this.notifyListeners();
  }

  selectResource(resourceId: string | null): void {
    this.state.selectedResourceId = resourceId;
    this.notifyListeners();
  }

  clearSelection(): void {
    this.state = {
      selectedAgentId: null,
      selectedResourceId: null,
      selectedAgent: null,
      selectedResources: [],
    };
    this.notifyListeners();
  }

  subscribe(listener: SelectionListener): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getState()));
  }
}
