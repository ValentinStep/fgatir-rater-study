/**
 * Tests for rating questions configuration.
 * Validates structure, IDs, required fields, and validation logic.
 */

import { describe, it, expect } from 'vitest';
import { RATING_QUESTIONS, getRequiredQuestionIds, validateResponses } from '@/config/ratingQuestions';

describe('Rating Questions Configuration', () => {
  it('has at least 5 rating questions', () => {
    expect(RATING_QUESTIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('all questions have unique IDs', () => {
    const ids = RATING_QUESTIONS.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all questions have required fields', () => {
    for (const question of RATING_QUESTIONS) {
      expect(question.id).toBeTruthy();
      expect(question.label).toBeTruthy();
      expect(question.type).toBeTruthy();
      expect(typeof question.required).toBe('boolean');
      expect(typeof question.order).toBe('number');
    }
  });

  it('all likert questions have valid min/max and endpoint labels', () => {
    const likertQuestions = RATING_QUESTIONS.filter((q) => q.type === 'likert');
    expect(likertQuestions.length).toBeGreaterThan(0);

    for (const q of likertQuestions) {
      if (q.type === 'likert') {
        expect(q.min).toBeLessThan(q.max);
        expect(q.minLabel).toBeTruthy();
        expect(q.maxLabel).toBeTruthy();
      }
    }
  });

  it('questions are sorted by order', () => {
    for (let i = 1; i < RATING_QUESTIONS.length; i++) {
      const prev = RATING_QUESTIONS[i - 1];
      const curr = RATING_QUESTIONS[i];
      expect(prev!.order).toBeLessThanOrEqual(curr!.order);
    }
  });

  it('has at least one optional text question', () => {
    const textQuestions = RATING_QUESTIONS.filter(
      (q) => q.type === 'text' && !q.required,
    );
    expect(textQuestions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('getRequiredQuestionIds', () => {
  it('returns only required question IDs', () => {
    const requiredIds = getRequiredQuestionIds();
    const requiredQuestions = RATING_QUESTIONS.filter((q) => q.required);
    expect(requiredIds.length).toBe(requiredQuestions.length);

    for (const id of requiredIds) {
      const question = RATING_QUESTIONS.find((q) => q.id === id);
      expect(question?.required).toBe(true);
    }
  });
});

describe('validateResponses', () => {
  it('returns valid=true when all required questions are answered', () => {
    const requiredIds = getRequiredQuestionIds();
    const responses = requiredIds.map((id) => ({
      questionId: id,
      value: 3 as number | string | boolean | null,
    }));
    const result = validateResponses(responses);
    expect(result.valid).toBe(true);
    expect(result.missingIds).toHaveLength(0);
  });

  it('returns valid=false when required questions are missing', () => {
    const result = validateResponses([]);
    expect(result.valid).toBe(false);
    expect(result.missingIds.length).toBeGreaterThan(0);
  });

  it('returns valid=false when a required response has null value', () => {
    const requiredIds = getRequiredQuestionIds();
    const responses = requiredIds.map((id, i) => ({
      questionId: id,
      value: i === 0 ? null : (3 as number | string | boolean | null),
    }));
    const result = validateResponses(responses);
    expect(result.valid).toBe(false);
    expect(result.missingIds).toContain(requiredIds[0]);
  });

  it('ignores optional questions in validation', () => {
    const requiredIds = getRequiredQuestionIds();
    // Only answer required questions (skip optional)
    const responses = requiredIds.map((id) => ({
      questionId: id,
      value: 4 as number | string | boolean | null,
    }));
    const result = validateResponses(responses);
    expect(result.valid).toBe(true);
  });
});
