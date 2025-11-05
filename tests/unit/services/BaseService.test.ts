/**
 * BaseService Test Suite
 * Tests the base service class including error wrapping and execution modes
 */

import { BaseService } from '@/renderer/services/BaseService';
import { globalErrorHandler } from '@/renderer/services/GlobalErrorHandler';

// Mock GlobalErrorHandler
jest.mock('@/renderer/services/GlobalErrorHandler', () => ({
  globalErrorHandler: {
    handle: jest.fn(),
  },
}));

// Test implementation of BaseService
class TestService extends BaseService {
  constructor() {
    super('test-service');
  }

  async successfulOperation(): Promise<string> {
    return this.execute(async () => {
      return 'success';
    }, 'successfulOperation');
  }

  async failingOperation(): Promise<string> {
    return this.execute(async () => {
      throw new Error('Test error');
    }, 'failingOperation');
  }

  syncSuccessfulOperation(): string {
    return this.executeSync(() => {
      return 'sync success';
    }, 'syncSuccessfulOperation');
  }

  syncFailingOperation(): string {
    return this.executeSync(() => {
      throw new Error('Sync test error');
    }, 'syncFailingOperation');
  }
}

describe('BaseService', () => {
  let service: TestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestService();
  });

  describe('execute (async)', () => {
    it('should return result on successful operation', async () => {
      const result = await service.successfulOperation();
      expect(result).toBe('success');
      expect(globalErrorHandler.handle).not.toHaveBeenCalled();
    });

    it('should handle errors and call globalErrorHandler', async () => {
      await expect(service.failingOperation()).rejects.toThrow('Test error');

      expect(globalErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' }),
        expect.objectContaining({
          subsystem: 'service',
          operation: 'failingOperation',
        })
      );
    });
  });

  describe('executeSync', () => {
    it('should return result on successful sync operation', () => {
      const result = service.syncSuccessfulOperation();
      expect(result).toBe('sync success');
      expect(globalErrorHandler.handle).not.toHaveBeenCalled();
    });

    it('should handle errors in sync operations', () => {
      expect(() => service.syncFailingOperation()).toThrow('Sync test error');

      expect(globalErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Sync test error' }),
        expect.objectContaining({
          subsystem: 'service',
          operation: 'syncFailingOperation',
        })
      );
    });
  });
});