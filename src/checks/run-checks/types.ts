/**
 * @module checks/run-checks/types
 * @description Type definitions for check runner
 */

import type { CheckType, SingleCheckResult } from '../../common/types/index.js';

/**
 * Check runner interface
 */
export interface CheckRunner {
  /**
   * Run a single check
   * @param check - Check type to run
   * @returns Check result
   */
  run(check: CheckType): Promise<SingleCheckResult>;
}
