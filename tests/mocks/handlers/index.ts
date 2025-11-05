import { agentHandlers } from './agent.handlers';
import { serviceHandlers } from './service.handlers';

export const handlers = [...agentHandlers, ...serviceHandlers];
