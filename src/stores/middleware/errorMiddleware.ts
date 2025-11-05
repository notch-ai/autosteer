/**
 * Error Middleware for Zustand Stores
 * Automatically catches and handles errors in store actions
 */

import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { globalErrorHandler } from '@/renderer/services/GlobalErrorHandler';

type ErrorMiddleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  config: StateCreator<T, Mps, Mcs>
) => StateCreator<T, Mps, Mcs>;

export const errorMiddleware: ErrorMiddleware = (config) => (set, get, api) => {
  const wrappedSet = ((...args: any[]) => {
    try {
      return (set as any)(...args);
    } catch (error) {
      globalErrorHandler.handle(error as Error, {
        subsystem: 'store',
        operation: 'state update',
        state: get(),
      });
      throw error;
    }
  }) as typeof set;

  return config(wrappedSet, get, api);
};
