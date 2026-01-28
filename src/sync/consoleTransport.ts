import { SyncTransport } from './transport';
import {
  PullChangesParams,
  PullChangesResponse,
  PushChangesParams,
  PushChangesResponse,
  SyncChanges,
} from './types';
import { logger, nowMs } from '../shared/utils';

const TAG = 'ConsoleTransport';

/**
 * Console-based SyncTransport implementation for POC
 * 
 * This transport logs all sync operations to the console,
 * simulating what would happen with a real backend.
 * 
 * Replace this with HttpTransport for production use.
 */
export class ConsoleTransport implements SyncTransport {
  private simulateNetworkDelay: boolean;
  private delayMs: number;

  constructor(options?: { simulateDelay?: boolean; delayMs?: number }) {
    this.simulateNetworkDelay = options?.simulateDelay ?? true;
    this.delayMs = options?.delayMs ?? 500;
  }

  private async delay(): Promise<void> {
    if (this.simulateNetworkDelay) {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), this.delayMs));
    }
  }

  private formatChanges(changes: SyncChanges): string {
    const summary: string[] = [];
    for (const [table, tableChanges] of Object.entries(changes)) {
      const parts: string[] = [];
      if (tableChanges.created.length > 0) {
        parts.push(`${tableChanges.created.length} created`);
      }
      if (tableChanges.updated.length > 0) {
        parts.push(`${tableChanges.updated.length} updated`);
      }
      if (tableChanges.deleted.length > 0) {
        parts.push(`${tableChanges.deleted.length} deleted`);
      }
      if (parts.length > 0) {
        summary.push(`${table}: ${parts.join(', ')}`);
      }
    }
    return summary.join(' | ') || 'no changes';
  }

  async pullChanges(params: PullChangesParams): Promise<PullChangesResponse> {
    const startTime = nowMs();

    console.log('\n┌──────────────────────────────────────────────────────────┐');
    console.log('│                    GET /sync/pull                        │');
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log('│ Request:                                                 │');
    console.log(`│   lastPulledAt: ${params.lastPulledAt ?? 'null (first sync)'}`);
    console.log(`│   schemaVersion: ${params.schemaVersion}`);
    console.log('└──────────────────────────────────────────────────────────┘\n');

    logger.info(TAG, 'GET /sync/pull', {
      lastPulledAt: params.lastPulledAt,
      schemaVersion: params.schemaVersion,
    });

    await this.delay();

    // In a real implementation, this would fetch from the server
    // For POC, we return empty changes (no remote changes)
    const response: PullChangesResponse = {
      changes: {
        categories: { created: [], updated: [], deleted: [] },
        todos: { created: [], updated: [], deleted: [] },
      },
      timestamp: nowMs(),
    };

    const elapsed = nowMs() - startTime;
    console.log('\n┌──────────────────────────────────────────────────────────┐');
    console.log('│                    RESPONSE 200 OK                       │');
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log(`│ Server timestamp: ${response.timestamp}`);
    console.log(`│ Changes: ${this.formatChanges(response.changes)}`);
    console.log(`│ Duration: ${elapsed}ms`);
    console.log('└──────────────────────────────────────────────────────────┘\n');

    logger.debug(TAG, 'Pull response received', { elapsed, timestamp: response.timestamp });

    return response;
  }

  async pushChanges(params: PushChangesParams): Promise<PushChangesResponse> {
    const startTime = nowMs();
    const changesSummary = this.formatChanges(params.changes);

    console.log('\n┌──────────────────────────────────────────────────────────┐');
    console.log('│                   POST /sync/push                        │');
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log('│ Request:                                                 │');
    console.log(`│   lastPulledAt: ${params.lastPulledAt}`);
    console.log(`│   Changes: ${changesSummary}`);
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log('│ Change Details:                                          │');

    // Log individual changes by operation type
    for (const [table, tableChanges] of Object.entries(params.changes)) {
      if (tableChanges.created.length > 0) {
        console.log(`│                                                          │`);
        console.log(`│ [POST] ${table} (create):                                │`);
        tableChanges.created.forEach((record) => {
          console.log(`│   - ${JSON.stringify(record).slice(0, 50)}...`);
        });
      }
      if (tableChanges.updated.length > 0) {
        console.log(`│                                                          │`);
        console.log(`│ [PUT] ${table} (update):                                 │`);
        tableChanges.updated.forEach((record) => {
          console.log(`│   - ${JSON.stringify(record).slice(0, 50)}...`);
        });
      }
      if (tableChanges.deleted.length > 0) {
        console.log(`│                                                          │`);
        console.log(`│ [DELETE] ${table}:                                       │`);
        tableChanges.deleted.forEach((id) => {
          console.log(`│   - id: ${id}`);
        });
      }
    }
    console.log('└──────────────────────────────────────────────────────────┘\n');

    logger.info(TAG, 'POST /sync/push', {
      lastPulledAt: params.lastPulledAt,
      changes: changesSummary,
    });

    await this.delay();

    // In a real implementation, server would:
    // 1. Validate lastPulledAt to detect conflicts
    // 2. Apply changes to remote database
    // 3. Return success or conflict errors
    const response: PushChangesResponse = {
      ok: true,
    };

    const elapsed = nowMs() - startTime;
    console.log('\n┌──────────────────────────────────────────────────────────┐');
    console.log('│                    RESPONSE 200 OK                       │');
    console.log('├──────────────────────────────────────────────────────────┤');
    console.log(`│ Success: ${response.ok}`);
    console.log(`│ Duration: ${elapsed}ms`);
    console.log('└──────────────────────────────────────────────────────────┘\n');

    logger.debug(TAG, 'Push response received', { elapsed, ok: response.ok });

    return response;
  }
}

// Default singleton instance
export const consoleTransport = new ConsoleTransport();
