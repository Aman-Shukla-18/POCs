import { SyncTransport } from './transport';
import {
  PullChangesParams,
  PullChangesResponse,
  PushChangesParams,
  PushChangesResponse,
} from './types';
import { logger, nowMs } from '../shared/utils';

const TAG = 'HttpTransport';

// Default to localhost for iOS simulator
// For Android emulator, use 10.0.2.2 instead of localhost
const DEFAULT_BASE_URL = 'http://localhost:3000';

/**
 * HTTP-based SyncTransport implementation
 * 
 * This transport makes actual HTTP calls to the backend API
 * for sync operations.
 */
export class HttpTransport implements SyncTransport {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  }

  /**
   * Set the auth token (user ID) for API calls
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
    logger.info(TAG, `Auth token ${token ? 'set' : 'cleared'}`);
  }

  /**
   * Get the current auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }

  async pullChanges(params: PullChangesParams): Promise<PullChangesResponse> {
    const startTime = nowMs();

    if (!this.authToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    logger.info(TAG, 'GET /api/sync/pull', {
      lastPulledAt: params.lastPulledAt,
      schemaVersion: params.schemaVersion,
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/sync/pull`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: PullChangesResponse = await response.json();
      
      const elapsed = nowMs() - startTime;
      logger.info(TAG, `Pull completed in ${elapsed}ms`, {
        timestamp: data.timestamp,
        categories: {
          created: data.changes.categories?.created?.length || 0,
          updated: data.changes.categories?.updated?.length || 0,
          deleted: data.changes.categories?.deleted?.length || 0,
        },
        todos: {
          created: data.changes.todos?.created?.length || 0,
          updated: data.changes.todos?.updated?.length || 0,
          deleted: data.changes.todos?.deleted?.length || 0,
        },
      });

      return data;
    } catch (error) {
      logger.error(TAG, 'Pull failed:', error);
      throw error;
    }
  }

  async pushChanges(params: PushChangesParams): Promise<PushChangesResponse> {
    const startTime = nowMs();

    if (!this.authToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    logger.info(TAG, 'POST /api/sync/push', {
      lastPulledAt: params.lastPulledAt,
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/sync/push`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: PushChangesResponse = await response.json();
      
      const elapsed = nowMs() - startTime;
      logger.info(TAG, `Push completed in ${elapsed}ms`, { ok: data.ok });

      return data;
    } catch (error) {
      logger.error(TAG, 'Push failed:', error);
      throw error;
    }
  }
}

// Default singleton instance
export const httpTransport = new HttpTransport();
