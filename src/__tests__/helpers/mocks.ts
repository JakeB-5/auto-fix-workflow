/**
 * @module __tests__/helpers/mocks
 * @description Common mock implementations for external dependencies
 */

import { vi } from 'vitest';

/**
 * Creates a mock Octokit client for GitHub API
 */
export function createMockOctokit() {
  return {
    issues: {
      listForRepo: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pulls: {
      create: vi.fn(),
      list: vi.fn(),
      get: vi.fn(),
    },
    repos: {
      get: vi.fn(),
    },
  };
}

/**
 * Creates a mock Asana client
 */
export function createMockAsanaClient() {
  return {
    tasks: {
      getTasksForProject: vi.fn(),
      getTasksForSection: vi.fn(),
      getTask: vi.fn(),
      updateTask: vi.fn(),
    },
    projects: {
      getSectionsForProject: vi.fn(),
    },
    sections: {
      getTasksForSection: vi.fn(),
    },
  };
}

/**
 * Creates a mock SimpleGit instance
 */
export function createMockGit() {
  return {
    worktreeAdd: vi.fn(),
    worktreeRemove: vi.fn(),
    worktreeList: vi.fn(),
    status: vi.fn(),
    branch: vi.fn(),
    checkout: vi.fn(),
    add: vi.fn(),
    commit: vi.fn(),
    push: vi.fn(),
    raw: vi.fn(),
  };
}

/**
 * Mock setup for GitHub API
 */
export function setupGitHubMocks() {
  const mockOctokit = createMockOctokit();

  vi.mock('@octokit/rest', () => ({
    Octokit: vi.fn(() => mockOctokit),
  }));

  return mockOctokit;
}

/**
 * Mock setup for Asana API
 */
export function setupAsanaMocks() {
  const mockClient = createMockAsanaClient();

  vi.mock('asana', () => ({
    default: {
      Client: {
        create: vi.fn(() => mockClient),
      },
    },
  }));

  return mockClient;
}

/**
 * Mock setup for Git (simple-git)
 */
export function setupGitMocks() {
  const mockGit = createMockGit();

  vi.mock('simple-git', () => ({
    default: vi.fn(() => mockGit),
    simpleGit: vi.fn(() => mockGit),
  }));

  return mockGit;
}

/**
 * Mock setup for file system operations
 */
export function setupFsMocks() {
  const mockFs = {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      rm: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };

  vi.mock('node:fs/promises', () => mockFs.promises);
  vi.mock('node:fs', () => mockFs);

  return mockFs;
}

/**
 * Mock setup for child_process
 */
export function setupChildProcessMocks() {
  const mockExec = vi.fn();
  const mockSpawn = vi.fn();

  vi.mock('child_process', () => ({
    exec: mockExec,
    spawn: mockSpawn,
    execSync: vi.fn(),
  }));

  return { exec: mockExec, spawn: mockSpawn };
}

/**
 * Creates a standard test environment with common mocks
 */
export function setupTestEnvironment() {
  const originalEnv = { ...process.env };

  // Set test environment variables
  process.env['GITHUB_TOKEN'] = 'test-github-token';
  process.env['ASANA_TOKEN'] = 'test-asana-token';

  return {
    originalEnv,
    cleanup: () => {
      process.env = { ...originalEnv };
    },
  };
}

/**
 * Resets all mocks to clean state
 */
export function resetAllMocks() {
  vi.clearAllMocks();
  vi.resetAllMocks();
}
