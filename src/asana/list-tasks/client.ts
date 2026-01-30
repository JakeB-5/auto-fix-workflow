/**
 * @module asana/list-tasks/client
 * @description Asana API client initialization
 */

import Asana from 'asana';
import type { AsanaConfig } from '../../common/types/index.js';

/** Singleton Asana client instance */
let clientInstance: Asana.Client | null = null;

/**
 * Get or create Asana client instance
 *
 * @param config - Asana configuration
 * @returns Asana client instance
 */
export function getAsanaClient(config: AsanaConfig): Asana.Client {
  if (!clientInstance) {
    clientInstance = Asana.Client.create().useAccessToken(config.token);
  }
  return clientInstance;
}

/**
 * Reset client instance (for testing)
 */
export function resetClient(): void {
  clientInstance = null;
}

/**
 * Create a new client without caching (for isolated operations)
 *
 * @param token - Asana access token
 * @returns New Asana client instance
 */
export function createClient(token: string): Asana.Client {
  return Asana.Client.create().useAccessToken(token);
}
