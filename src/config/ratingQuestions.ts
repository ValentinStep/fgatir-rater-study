/**
 * Rating questions configuration.
 * Defines all questions presented to raters for each image series.
 *
 * Structure-specific questions for thalamic/brainstem evaluation:
 * - 7 boolean "improved visualization" questions for anatomical structures
 * - 3 Likert (1–5) scale questions
 * - 1 free-text comments field
 */

import type { RatingQuestion } from '@/types';

export const RATING_QUESTIONS: RatingQuestion[] = [
  // --- Boolean: improved visualization per structure ---
  {
    id: 'viz_mamillothalamic_tract',
    type: 'boolean',
    label: 'Mamillo-thalamic tract',
    helpText: 'Is the visualization of the mamillo-thalamic tract improved?',
    required: true,
    order: 1,
    trueLabel: 'Yes',
    falseLabel: 'No',
  },
  {
    id: 'viz_stn',
    type: 'boolean',
    label: 'Subthalamic nucleus (STN)',
    helpText: 'Is the visualization of the STN improved?',
    required: true,
    order: 2,
    trueLabel: 'Yes',
    falseLabel: 'No',
  },
  {
    id: 'viz_dentato_rubro_thalamic',
    type: 'boolean',
    label: 'Dentato-rubro-thalamic tract',
    helpText: 'Is the visualization of the dentato-rubro-thalamic tract improved?',
    required: true,
    order: 3,
    trueLabel: 'Yes',
    falseLabel: 'No',
  },
  {
    id: 'viz_red_nuclei',
    type: 'boolean',
    label: 'Red nuclei',
    helpText: 'Is the visualization of the red nuclei improved?',
    required: true,
    order: 4,
    trueLabel: 'Yes',
    falseLabel: 'No',
  },
  {
    id: 'viz_medial_lemniscus',
    type: 'boolean',
    label: 'Medial lemniscus',
    helpText: 'Is the visualization of the medial lemniscus improved?',
    required: true,
    order: 5,
    trueLabel: 'Yes',
    falseLabel: 'No',
  },
  {
    id: 'viz_mlf',
    type: 'boolean',
    label: 'MLF (Medial longitudinal fasciculus)',
    helpText: 'Is the visualization of the MLF improved?',
    required: true,
    order: 6,
    trueLabel: 'Yes',
    falseLabel: 'No',
  },
  {
    id: 'viz_olives',
    type: 'boolean',
    label: 'Olives',
    helpText: 'Is the visualization of the olives improved?',
    required: true,
    order: 7,
    trueLabel: 'Yes',
    falseLabel: 'No',
  },

  // --- Likert: overall assessments ---
  {
    id: 'thalamic_nuclei_delineation',
    type: 'likert',
    label: 'Thalamic nuclei delineation',
    helpText: 'Rate the delineation of thalamic nuclei.',
    required: true,
    order: 8,
    min: 1,
    max: 5,
    minLabel: 'Very poor',
    maxLabel: 'Excellent',
  },
  {
    id: 'brainstem_structure_clarity',
    type: 'likert',
    label: 'Brainstem internal structure clarity',
    helpText: 'Rate the clarity of internal brainstem structures.',
    required: true,
    order: 9,
    min: 1,
    max: 5,
    minLabel: 'Very poor',
    maxLabel: 'Excellent',
  },
  {
    id: 'diagnostic_confidence_posterior_fossa',
    type: 'likert',
    label: 'Overall diagnostic confidence for posterior fossa',
    helpText: 'Rate your overall diagnostic confidence for posterior fossa assessment.',
    required: true,
    order: 10,
    min: 1,
    max: 5,
    minLabel: 'Not confident',
    maxLabel: 'Very confident',
  },

  // --- Free-text ---
  {
    id: 'comments',
    type: 'text',
    label: 'Comments',
    helpText: 'Optional free-text comments about this image series.',
    required: false,
    order: 11,
    maxLength: 1000,
    placeholder: 'Enter any additional observations (optional)',
  },
];

/** Get all required question IDs */
export function getRequiredQuestionIds(): string[] {
  return RATING_QUESTIONS.filter((q) => q.required).map((q) => q.id);
}

/** Validate that a set of responses satisfies all required questions */
export function validateResponses(
  responses: { questionId: string; value: number | string | boolean | null }[],
): { valid: boolean; missingIds: string[] } {
  const requiredIds = getRequiredQuestionIds();
  const answeredIds = new Set(
    responses
      .filter((r) => r.value !== null && r.value !== '')
      .map((r) => r.questionId),
  );

  const missingIds = requiredIds.filter((id) => !answeredIds.has(id));
  return { valid: missingIds.length === 0, missingIds };
}
