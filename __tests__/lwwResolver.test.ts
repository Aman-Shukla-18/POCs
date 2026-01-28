import {
  resolveLWWConflict,
  getRecordTimestamp,
  hasConflict,
  createConflictInfo,
  resolveConflicts,
} from '../src/sync/lwwResolver';
import { ConflictInfo } from '../src/sync/types';

describe('LWW Conflict Resolver', () => {
  describe('resolveLWWConflict', () => {
    it('should return local as winner when local timestamp is newer', () => {
      const conflict: ConflictInfo = {
        collection: 'todos',
        recordId: 'test-1',
        localRecord: { id: 'test-1', title: 'Local Title', updated_at: 2000 },
        remoteRecord: { id: 'test-1', title: 'Remote Title', updated_at: 1000 },
        localUpdatedAt: 2000,
        remoteUpdatedAt: 1000,
      };

      const result = resolveLWWConflict(conflict);

      expect(result.winner).toBe('local');
      expect(result.resolvedRecord).toEqual(conflict.localRecord);
      expect(result.reason).toContain('Local timestamp');
      expect(result.reason).toContain('2000');
      expect(result.reason).toContain('1000');
    });

    it('should return remote as winner when remote timestamp is newer', () => {
      const conflict: ConflictInfo = {
        collection: 'todos',
        recordId: 'test-2',
        localRecord: { id: 'test-2', title: 'Local Title', updated_at: 1000 },
        remoteRecord: { id: 'test-2', title: 'Remote Title', updated_at: 2000 },
        localUpdatedAt: 1000,
        remoteUpdatedAt: 2000,
      };

      const result = resolveLWWConflict(conflict);

      expect(result.winner).toBe('remote');
      expect(result.resolvedRecord).toEqual(conflict.remoteRecord);
      expect(result.reason).toContain('Remote timestamp');
    });

    it('should return remote as winner when timestamps are equal (server authority)', () => {
      const conflict: ConflictInfo = {
        collection: 'todos',
        recordId: 'test-3',
        localRecord: { id: 'test-3', title: 'Local Title', updated_at: 1000 },
        remoteRecord: { id: 'test-3', title: 'Remote Title', updated_at: 1000 },
        localUpdatedAt: 1000,
        remoteUpdatedAt: 1000,
      };

      const result = resolveLWWConflict(conflict);

      expect(result.winner).toBe('remote');
      expect(result.resolvedRecord).toEqual(conflict.remoteRecord);
      expect(result.reason).toContain('Timestamps equal');
      expect(result.reason).toContain('server authority');
    });
  });

  describe('getRecordTimestamp', () => {
    it('should extract updated_at field (snake_case)', () => {
      const record = { id: '1', updated_at: 12345 };
      expect(getRecordTimestamp(record)).toBe(12345);
    });

    it('should extract updatedAt field (camelCase)', () => {
      const record = { id: '1', updatedAt: 67890 };
      expect(getRecordTimestamp(record)).toBe(67890);
    });

    it('should prefer updated_at over updatedAt', () => {
      const record = { id: '1', updated_at: 12345, updatedAt: 67890 };
      expect(getRecordTimestamp(record)).toBe(12345);
    });

    it('should return 0 for missing timestamp', () => {
      const record = { id: '1', title: 'Test' };
      expect(getRecordTimestamp(record)).toBe(0);
    });

    it('should return 0 for non-number timestamp', () => {
      const record = { id: '1', updated_at: 'invalid' };
      expect(getRecordTimestamp(record)).toBe(0);
    });
  });

  describe('hasConflict', () => {
    it('should return true when both records modified after base timestamp', () => {
      const local = { id: '1', updated_at: 2000 };
      const remote = { id: '1', updated_at: 2500 };
      const baseTimestamp = 1000;

      expect(hasConflict(local, remote, baseTimestamp)).toBe(true);
    });

    it('should return false when only local modified', () => {
      const local = { id: '1', updated_at: 2000 };
      const remote = { id: '1', updated_at: 500 };
      const baseTimestamp = 1000;

      expect(hasConflict(local, remote, baseTimestamp)).toBe(false);
    });

    it('should return false when only remote modified', () => {
      const local = { id: '1', updated_at: 500 };
      const remote = { id: '1', updated_at: 2000 };
      const baseTimestamp = 1000;

      expect(hasConflict(local, remote, baseTimestamp)).toBe(false);
    });

    it('should return false when local record is undefined', () => {
      const remote = { id: '1', updated_at: 2000 };
      expect(hasConflict(undefined, remote, 1000)).toBe(false);
    });

    it('should return false when remote record is undefined', () => {
      const local = { id: '1', updated_at: 2000 };
      expect(hasConflict(local, undefined, 1000)).toBe(false);
    });
  });

  describe('createConflictInfo', () => {
    it('should create conflict info with correct fields', () => {
      const local = { id: 'test-1', title: 'Local', updated_at: 1000 };
      const remote = { id: 'test-1', title: 'Remote', updated_at: 2000 };

      const info = createConflictInfo('todos', local, remote);

      expect(info.collection).toBe('todos');
      expect(info.recordId).toBe('test-1');
      expect(info.localRecord).toEqual(local);
      expect(info.remoteRecord).toEqual(remote);
      expect(info.localUpdatedAt).toBe(1000);
      expect(info.remoteUpdatedAt).toBe(2000);
    });
  });

  describe('resolveConflicts', () => {
    it('should resolve multiple conflicts correctly', () => {
      const conflicts: ConflictInfo[] = [
        {
          collection: 'todos',
          recordId: '1',
          localRecord: { id: '1', updated_at: 2000 },
          remoteRecord: { id: '1', updated_at: 1000 },
          localUpdatedAt: 2000,
          remoteUpdatedAt: 1000,
        },
        {
          collection: 'todos',
          recordId: '2',
          localRecord: { id: '2', updated_at: 1000 },
          remoteRecord: { id: '2', updated_at: 2000 },
          localUpdatedAt: 1000,
          remoteUpdatedAt: 2000,
        },
      ];

      const results = resolveConflicts(conflicts);

      expect(results.size).toBe(2);
      expect(results.get('1')?.winner).toBe('local');
      expect(results.get('2')?.winner).toBe('remote');
    });

    it('should return empty map for empty conflicts array', () => {
      const results = resolveConflicts([]);
      expect(results.size).toBe(0);
    });
  });
});
