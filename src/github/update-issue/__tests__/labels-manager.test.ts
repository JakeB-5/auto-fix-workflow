/**
 * @module github/update-issue/__tests__/labels-manager
 * @description Unit tests for GitHub issue labels management utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addLabels, removeLabels, syncLabels } from '../labels-manager.js';

// Create mock functions
const mockAddLabels = vi.fn();
const mockRemoveLabel = vi.fn();
const mockSetLabels = vi.fn();

// Mock Octokit
vi.mock('@octokit/rest', () => {
  return {
    Octokit: vi.fn().mockImplementation(function () {
      return {
        rest: {
          issues: {
            addLabels: mockAddLabels,
            removeLabel: mockRemoveLabel,
            setLabels: mockSetLabels,
          },
        },
      };
    }),
  };
});

const { Octokit } = await import('@octokit/rest');

describe('labels-manager', () => {
  let octokit: InstanceType<typeof Octokit>;

  beforeEach(() => {
    vi.clearAllMocks();
    octokit = new Octokit({ auth: 'test-token' });
  });

  describe('addLabels', () => {
    it('should add labels to an issue', async () => {
      mockAddLabels.mockResolvedValueOnce({
        data: [
          { name: 'bug' },
          { name: 'priority:high' },
        ],
      });

      const result = await addLabels(
        octokit,
        'owner',
        'repo',
        123,
        ['bug', 'priority:high']
      );

      expect(mockAddLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        labels: ['bug', 'priority:high'],
      });

      expect(result).toEqual(['bug', 'priority:high']);
    });

    it('should return empty array for no labels', async () => {
      const result = await addLabels(
        octokit,
        'owner',
        'repo',
        123,
        []
      );

      expect(mockAddLabels).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle string labels in response', async () => {
      mockAddLabels.mockResolvedValueOnce({
        data: ['bug', 'feature'],
      });

      const result = await addLabels(
        octokit,
        'owner',
        'repo',
        456,
        ['bug', 'feature']
      );

      expect(result).toEqual(['bug', 'feature']);
    });

    it('should handle mixed label formats in response', async () => {
      mockAddLabels.mockResolvedValueOnce({
        data: [
          'string-label',
          { name: 'object-label' },
          { name: 'another-label' },
        ],
      });

      const result = await addLabels(
        octokit,
        'owner',
        'repo',
        789,
        ['string-label', 'object-label', 'another-label']
      );

      expect(result).toEqual(['string-label', 'object-label', 'another-label']);
    });

    it('should handle labels without name property', async () => {
      mockAddLabels.mockResolvedValueOnce({
        data: [
          { name: 'valid' },
          { id: 123 }, // No name property
          { name: null }, // Null name
        ],
      });

      const result = await addLabels(
        octokit,
        'owner',
        'repo',
        100,
        ['valid']
      );

      expect(result).toEqual(['valid', '', '']);
    });

    it('should handle single label', async () => {
      mockAddLabels.mockResolvedValueOnce({
        data: [{ name: 'bug' }],
      });

      const result = await addLabels(
        octokit,
        'owner',
        'repo',
        200,
        ['bug']
      );

      expect(result).toEqual(['bug']);
    });

    it('should handle API error', async () => {
      mockAddLabels.mockRejectedValueOnce(new Error('API Error'));

      await expect(
        addLabels(octokit, 'owner', 'repo', 300, ['bug'])
      ).rejects.toThrow('API Error');
    });

    it('should preserve readonly array input', async () => {
      const labels: readonly string[] = ['bug', 'feature'];
      mockAddLabels.mockResolvedValueOnce({
        data: [{ name: 'bug' }, { name: 'feature' }],
      });

      const result = await addLabels(
        octokit,
        'owner',
        'repo',
        400,
        labels
      );

      expect(result).toEqual(['bug', 'feature']);
    });
  });

  describe('removeLabels', () => {
    it('should remove labels from an issue', async () => {
      mockRemoveLabel.mockResolvedValue({ data: {} });

      await removeLabels(
        octokit,
        'owner',
        'repo',
        123,
        ['bug', 'priority:low']
      );

      expect(mockRemoveLabel).toHaveBeenCalledTimes(2);
      expect(mockRemoveLabel).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        name: 'bug',
      });
      expect(mockRemoveLabel).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        name: 'priority:low',
      });
    });

    it('should not call API for empty labels array', async () => {
      await removeLabels(octokit, 'owner', 'repo', 123, []);

      expect(mockRemoveLabel).not.toHaveBeenCalled();
    });

    it('should ignore 404 errors when label does not exist', async () => {
      mockRemoveLabel
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ data: {} });

      await removeLabels(
        octokit,
        'owner',
        'repo',
        456,
        ['exists', 'not-exists', 'also-exists']
      );

      expect(mockRemoveLabel).toHaveBeenCalledTimes(3);
      // Should not throw
    });

    it('should throw on non-404 errors', async () => {
      mockRemoveLabel.mockRejectedValueOnce({ status: 500 });

      await expect(
        removeLabels(octokit, 'owner', 'repo', 789, ['bug'])
      ).rejects.toEqual({ status: 500 });
    });

    it('should handle single label removal', async () => {
      mockRemoveLabel.mockResolvedValueOnce({ data: {} });

      await removeLabels(octokit, 'owner', 'repo', 100, ['bug']);

      expect(mockRemoveLabel).toHaveBeenCalledTimes(1);
      expect(mockRemoveLabel).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 100,
        name: 'bug',
      });
    });

    it('should handle multiple 404 errors', async () => {
      mockRemoveLabel
        .mockRejectedValueOnce({ status: 404 })
        .mockRejectedValueOnce({ status: 404 })
        .mockRejectedValueOnce({ status: 404 });

      await removeLabels(
        octokit,
        'owner',
        'repo',
        200,
        ['label1', 'label2', 'label3']
      );

      expect(mockRemoveLabel).toHaveBeenCalledTimes(3);
    });

    it('should preserve readonly array input', async () => {
      const labels: readonly string[] = ['bug', 'feature'];
      mockRemoveLabel.mockResolvedValue({ data: {} });

      await removeLabels(octokit, 'owner', 'repo', 300, labels);

      expect(mockRemoveLabel).toHaveBeenCalledTimes(2);
    });

    it('should handle error without status property', async () => {
      mockRemoveLabel.mockRejectedValueOnce(new Error('Generic error'));

      await expect(
        removeLabels(octokit, 'owner', 'repo', 400, ['bug'])
      ).rejects.toThrow('Generic error');
    });

    it('should handle error with status as string', async () => {
      const error = new Error('Bad error');
      (error as any).status = 'not-a-number';

      mockRemoveLabel.mockRejectedValueOnce(error);

      await expect(
        removeLabels(octokit, 'owner', 'repo', 500, ['bug'])
      ).rejects.toThrow('Bad error');
    });
  });

  describe('syncLabels', () => {
    it('should sync labels on an issue', async () => {
      mockSetLabels.mockResolvedValueOnce({
        data: [
          { name: 'bug' },
          { name: 'feature' },
        ],
      });

      const result = await syncLabels(
        octokit,
        'owner',
        'repo',
        123,
        ['bug', 'feature']
      );

      expect(mockSetLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        labels: ['bug', 'feature'],
      });

      expect(result).toEqual(['bug', 'feature']);
    });

    it('should sync with empty labels array', async () => {
      mockSetLabels.mockResolvedValueOnce({
        data: [],
      });

      const result = await syncLabels(
        octokit,
        'owner',
        'repo',
        456,
        []
      );

      expect(mockSetLabels).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 456,
        labels: [],
      });

      expect(result).toEqual([]);
    });

    it('should handle string labels in response', async () => {
      mockSetLabels.mockResolvedValueOnce({
        data: ['bug', 'feature', 'enhancement'],
      });

      const result = await syncLabels(
        octokit,
        'owner',
        'repo',
        789,
        ['bug', 'feature', 'enhancement']
      );

      expect(result).toEqual(['bug', 'feature', 'enhancement']);
    });

    it('should handle mixed label formats in response', async () => {
      mockSetLabels.mockResolvedValueOnce({
        data: [
          'string-label',
          { name: 'object-label' },
          { name: 'another' },
        ],
      });

      const result = await syncLabels(
        octokit,
        'owner',
        'repo',
        100,
        ['string-label', 'object-label', 'another']
      );

      expect(result).toEqual(['string-label', 'object-label', 'another']);
    });

    it('should handle labels without name property', async () => {
      mockSetLabels.mockResolvedValueOnce({
        data: [
          { name: 'valid' },
          { id: 123 }, // No name
          { name: undefined }, // Undefined name
        ],
      });

      const result = await syncLabels(
        octokit,
        'owner',
        'repo',
        200,
        ['valid']
      );

      expect(result).toEqual(['valid', '', '']);
    });

    it('should handle single label', async () => {
      mockSetLabels.mockResolvedValueOnce({
        data: [{ name: 'bug' }],
      });

      const result = await syncLabels(
        octokit,
        'owner',
        'repo',
        300,
        ['bug']
      );

      expect(result).toEqual(['bug']);
    });

    it('should handle API error', async () => {
      mockSetLabels.mockRejectedValueOnce(new Error('API Error'));

      await expect(
        syncLabels(octokit, 'owner', 'repo', 400, ['bug'])
      ).rejects.toThrow('API Error');
    });

    it('should preserve readonly array input', async () => {
      const labels: readonly string[] = ['bug', 'feature'];
      mockSetLabels.mockResolvedValueOnce({
        data: [{ name: 'bug' }, { name: 'feature' }],
      });

      const result = await syncLabels(
        octokit,
        'owner',
        'repo',
        500,
        labels
      );

      expect(result).toEqual(['bug', 'feature']);
    });

    it('should handle large number of labels', async () => {
      const labels = Array.from({ length: 50 }, (_, i) => `label-${i}`);
      mockSetLabels.mockResolvedValueOnce({
        data: labels.map((name) => ({ name })),
      });

      const result = await syncLabels(
        octokit,
        'owner',
        'repo',
        600,
        labels
      );

      expect(result).toEqual(labels);
    });
  });
});
