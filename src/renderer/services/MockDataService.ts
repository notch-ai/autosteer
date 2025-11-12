/**
 * Stub implementation to maintain build compatibility until full cleanup
 */

import { Resource } from '@/entities';

export class MockDataService {
  static getResources(_resourceIds: string[]): Resource[] {
    return [];
  }
}
