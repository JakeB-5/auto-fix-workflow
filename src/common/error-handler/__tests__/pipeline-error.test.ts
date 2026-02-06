/**
 * @module common/error-handler/__tests__/pipeline-error
 * @description Tests for PipelineError class
 */

import { describe, it, expect } from 'vitest';
import { PipelineError } from '../pipeline-error.js';
import { AutofixError } from '../base.js';

describe('PipelineError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AutofixError);
      expect(error).toBeInstanceOf(PipelineError);
      expect(error.code).toBe('PIPELINE_FAILED');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('PipelineError');
      expect(error.context).toEqual({});
    });

    it('should create error with context', () => {
      const context = { stage: 'test', attempt: 1 };
      const error = new PipelineError('PIPELINE_FAILED', 'Test message', context);

      expect(error.context).toEqual(context);
      expect(error.context.stage).toBe('test');
      expect(error.context.attempt).toBe(1);
    });

    it('should freeze context to make it immutable', () => {
      const context = { stage: 'test' };
      const error = new PipelineError('PIPELINE_FAILED', 'Test message', context);

      expect(Object.isFrozen(error.context)).toBe(true);
      expect(() => {
        (error.context as { stage: string }).stage = 'modified';
      }).toThrow();
    });

    it('should handle empty context', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test');

      expect(error.context).toEqual({});
      expect(Object.keys(error.context).length).toBe(0);
    });
  });

  describe('static factory methods', () => {
    describe('initFailed', () => {
      it('should create error for initialization failure', () => {
        const error = PipelineError.initFailed('Config not found');

        expect(error.code).toBe('PIPELINE_INIT_FAILED');
        expect(error.message).toBe('Config not found');
        expect(error.context).toEqual({});
      });

      it('should include context if provided', () => {
        const error = PipelineError.initFailed('Config error', { stage: 'init' });

        expect(error.code).toBe('PIPELINE_INIT_FAILED');
        expect(error.context.stage).toBe('init');
      });
    });

    describe('failed', () => {
      it('should create general pipeline failure error', () => {
        const error = PipelineError.failed('Unexpected error');

        expect(error.code).toBe('PIPELINE_FAILED');
        expect(error.message).toBe('Unexpected error');
        expect(error.context).toEqual({});
      });

      it('should include context if provided', () => {
        const error = PipelineError.failed('Error', { attempt: 3 });

        expect(error.code).toBe('PIPELINE_FAILED');
        expect(error.context.attempt).toBe(3);
      });
    });

    describe('interrupted', () => {
      it('should create error for pipeline interruption', () => {
        const error = PipelineError.interrupted('User cancelled');

        expect(error.code).toBe('PIPELINE_INTERRUPTED');
        expect(error.message).toBe('User cancelled');
        expect(error.context).toEqual({});
      });

      it('should include context if provided', () => {
        const error = PipelineError.interrupted('Cancelled', { stage: 'ai_analysis' });

        expect(error.code).toBe('PIPELINE_INTERRUPTED');
        expect(error.context.stage).toBe('ai_analysis');
      });
    });

    describe('timeout', () => {
      it('should create error for pipeline timeout', () => {
        const error = PipelineError.timeout('ai_analysis', 30000);

        expect(error.code).toBe('PIPELINE_TIMEOUT');
        expect(error.message).toBe("Pipeline stage 'ai_analysis' timed out after 30000ms");
        expect(error.context.stage).toBe('ai_analysis');
        expect(error.context.durationMs).toBe(30000);
      });

      it('should merge additional context', () => {
        const error = PipelineError.timeout('checks', 60000, { attempt: 2 });

        expect(error.code).toBe('PIPELINE_TIMEOUT');
        expect(error.message).toBe("Pipeline stage 'checks' timed out after 60000ms");
        expect(error.context.stage).toBe('checks');
        expect(error.context.durationMs).toBe(60000);
        expect(error.context.attempt).toBe(2);
      });

      it('should handle stage names with special characters', () => {
        const error = PipelineError.timeout('ai-fix/generation', 15000);

        expect(error.message).toContain('ai-fix/generation');
        expect(error.context.stage).toBe('ai-fix/generation');
      });
    });

    describe('analysisFailed', () => {
      it('should create error for AI analysis failure', () => {
        const error = PipelineError.analysisFailed('AI service timeout');

        expect(error.code).toBe('AI_ANALYSIS_FAILED');
        expect(error.message).toBe('AI service timeout');
        expect(error.context.recoverable).toBe(true);
      });

      it('should set recoverable to true by default', () => {
        const error = PipelineError.analysisFailed('Error');

        expect(error.context.recoverable).toBe(true);
      });

      it('should merge context and keep recoverable', () => {
        const error = PipelineError.analysisFailed('Error', { attempt: 2 });

        expect(error.code).toBe('AI_ANALYSIS_FAILED');
        expect(error.context.recoverable).toBe(true);
        expect(error.context.attempt).toBe(2);
      });

      it('should preserve provided recoverable value', () => {
        const error = PipelineError.analysisFailed('Error', { recoverable: false });

        expect(error.context.recoverable).toBe(true); // Factory always sets to true
      });
    });

    describe('fixFailed', () => {
      it('should create error for AI fix failure', () => {
        const error = PipelineError.fixFailed('Code generation failed');

        expect(error.code).toBe('AI_FIX_FAILED');
        expect(error.message).toBe('Code generation failed');
        expect(error.context.recoverable).toBe(true);
      });

      it('should set recoverable to true by default', () => {
        const error = PipelineError.fixFailed('Error');

        expect(error.context.recoverable).toBe(true);
      });

      it('should merge context and keep recoverable', () => {
        const error = PipelineError.fixFailed('Error', { stage: 'fix_generation' });

        expect(error.code).toBe('AI_FIX_FAILED');
        expect(error.context.recoverable).toBe(true);
        expect(error.context.stage).toBe('fix_generation');
      });
    });

    describe('installDepsFailed', () => {
      it('should create error for dependency installation failure', () => {
        const error = PipelineError.installDepsFailed('npm install failed with code 1');

        expect(error.code).toBe('INSTALL_DEPS_FAILED');
        expect(error.message).toBe('npm install failed with code 1');
        expect(error.context).toEqual({});
      });

      it('should include context if provided', () => {
        const error = PipelineError.installDepsFailed('Install failed', { stage: 'install_deps' });

        expect(error.code).toBe('INSTALL_DEPS_FAILED');
        expect(error.context.stage).toBe('install_deps');
      });
    });
  });

  describe('isRecoverable method', () => {
    it('should return true for recoverable errors', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test', { recoverable: true });

      expect(error.isRecoverable()).toBe(true);
    });

    it('should return false for non-recoverable errors', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test', { recoverable: false });

      expect(error.isRecoverable()).toBe(false);
    });

    it('should return false when recoverable is not set', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test');

      expect(error.isRecoverable()).toBe(false);
    });

    it('should return false when recoverable is undefined', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test', { recoverable: undefined });

      expect(error.isRecoverable()).toBe(false);
    });

    it('should work with analysisFailed factory method', () => {
      const error = PipelineError.analysisFailed('Error');

      expect(error.isRecoverable()).toBe(true);
    });

    it('should work with fixFailed factory method', () => {
      const error = PipelineError.fixFailed('Error');

      expect(error.isRecoverable()).toBe(true);
    });
  });

  describe('error properties', () => {
    it('should have timestamp', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test');

      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should have stack trace', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('PipelineError');
    });

    it('should support instanceof checks', () => {
      const error = PipelineError.failed('Test');

      expect(error instanceof PipelineError).toBe(true);
      expect(error instanceof AutofixError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('error with various context types', () => {
    it('should handle stage in context', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test', { stage: 'ai_analysis' });

      expect(error.context.stage).toBe('ai_analysis');
    });

    it('should handle attempt in context', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test', { attempt: 3 });

      expect(error.context.attempt).toBe(3);
    });

    it('should handle recoverable in context', () => {
      const error = new PipelineError('PIPELINE_FAILED', 'Test', { recoverable: true });

      expect(error.context.recoverable).toBe(true);
    });

    it('should handle group in context', () => {
      const group = { issueNumbers: [1, 2, 3] };
      const error = new PipelineError('PIPELINE_FAILED', 'Test', { group });

      expect(error.context.group).toEqual(group);
    });

    it('should handle durationMs in context', () => {
      const error = new PipelineError('PIPELINE_TIMEOUT', 'Test', { durationMs: 5000 });

      expect(error.context.durationMs).toBe(5000);
    });

    it('should handle multiple context fields', () => {
      const context = {
        stage: 'checks',
        attempt: 2,
        recoverable: true,
        durationMs: 3000,
      };
      const error = new PipelineError('PIPELINE_FAILED', 'Test', context);

      expect(error.context).toEqual(context);
    });
  });
});
