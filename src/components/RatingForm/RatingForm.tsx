/**
 * RatingForm Component
 *
 * Side panel that renders rating questions from configuration.
 * Supports Likert scales, text fields, and form validation.
 * Dark theme, keyboard navigable, with save-and-next functionality.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { RatingQuestion, RatingResponse, LikertQuestion, BooleanQuestion, TextQuestion } from '@/types';
import { RATING_QUESTIONS, validateResponses } from '@/config/ratingQuestions';

export interface RatingFormProps {
  /** Current assignment display label (e.g., "Image set 1") */
  displayLabel: string;
  /** Called when the form is submitted */
  onSubmit: (responses: RatingResponse[]) => void;
  /** Whether the form is in a saving state */
  isSaving: boolean;
  /** Pre-filled responses (for resume behavior) */
  initialResponses?: RatingResponse[];
  /** Called whenever responses change (for auto-save) */
  onResponsesChange?: (responses: RatingResponse[]) => void;
  /** Whether the submission was just successful (for feedback) */
  showSuccess?: boolean;
}

export function RatingForm({
  displayLabel,
  onSubmit,
  isSaving,
  initialResponses = [],
  onResponsesChange,
  showSuccess = false,
}: RatingFormProps) {
  // Track serialized initial responses to detect resets from parent
  const initialKey = initialResponses.map((r) => `${r.questionId}:${r.value}`).join('|');
  const [trackedKey, setTrackedKey] = useState(initialKey);

  const [responses, setResponses] = useState<Map<string, number | string | boolean | null>>(
    () => {
      const map = new Map<string, number | string | boolean | null>();
      for (const r of initialResponses) {
        map.set(r.questionId, r.value);
      }
      return map;
    },
  );

  const formRef = useRef<HTMLDivElement>(null);

  // Reset responses when parent passes different initialResponses
  if (trackedKey !== initialKey) {
    setTrackedKey(initialKey);
    const map = new Map<string, number | string | boolean | null>();
    for (const r of initialResponses) {
      map.set(r.questionId, r.value);
    }
    setResponses(map);
  }

  const setResponse = useCallback(
    (questionId: string, value: number | string | boolean | null) => {
      setResponses((prev) => {
        const next = new Map(prev);
        next.set(questionId, value);

        // Notify parent of change
        if (onResponsesChange) {
          const responseArray: RatingResponse[] = [];
          next.forEach((v, qId) => {
            responseArray.push({ questionId: qId, value: v });
          });
          onResponsesChange(responseArray);
        }

        return next;
      });
    },
    [onResponsesChange],
  );

  const buildResponseArray = useCallback((): RatingResponse[] => {
    const result: RatingResponse[] = [];
    responses.forEach((value, questionId) => {
      result.push({ questionId, value });
    });
    return result;
  }, [responses]);

  const { valid } = validateResponses(buildResponseArray());

  const handleSubmit = useCallback(() => {
    if (!valid || isSaving) return;
    onSubmit(buildResponseArray());
  }, [valid, isSaving, onSubmit, buildResponseArray]);

  // Keyboard shortcut: Enter to submit when valid
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.ctrlKey && valid && !isSaving) {
        handleSubmit();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, valid, isSaving]);

  return (
    <div ref={formRef} style={panelStyle} role="form" aria-label="Rating form">
      <div style={headerStyle}>
        <h2 style={panelTitleStyle}>{displayLabel}</h2>
        {showSuccess && (
          <div style={successBadgeStyle} role="status">
            ✓ Saved
          </div>
        )}
      </div>

      <div style={questionsContainerStyle}>
        {RATING_QUESTIONS.map((question) => (
          <QuestionRenderer
            key={question.id}
            question={question}
            value={responses.get(question.id) ?? null}
            onChange={(value) => setResponse(question.id, value)}
          />
        ))}
      </div>

      <div style={footerStyle}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!valid || isSaving}
          style={{
            ...submitButtonStyle,
            ...(!valid || isSaving ? submitButtonDisabledStyle : {}),
          }}
          aria-label="Save and continue to next image set"
        >
          {isSaving ? 'Saving...' : 'Save & Next'}
        </button>
        {!valid && (
          <p style={validationHintStyle}>
            Answer all required questions to continue
          </p>
        )}
        <p style={shortcutHintStyle}>Ctrl+Enter to submit</p>
      </div>
    </div>
  );
}

// --- Question Renderer ---

interface QuestionRendererProps {
  question: RatingQuestion;
  value: number | string | boolean | null;
  onChange: (value: number | string | boolean | null) => void;
}

function QuestionRenderer({ question, value, onChange }: QuestionRendererProps) {
  switch (question.type) {
    case 'likert':
      return (
        <LikertQuestionRenderer
          question={question}
          value={value as number | null}
          onChange={onChange}
        />
      );
    case 'text':
      return (
        <TextQuestionRenderer
          question={question}
          value={value as string | null}
          onChange={onChange}
        />
      );
    case 'boolean':
      return (
        <BooleanQuestionRenderer
          question={question}
          value={value as boolean | null}
          onChange={onChange}
        />
      );
    case 'categorical':
      // Placeholder for future question type
      return null;
    default:
      return null;
  }
}

// --- Likert Question ---

interface LikertRendererProps {
  question: LikertQuestion;
  value: number | null;
  onChange: (value: number | null) => void;
}

function LikertQuestionRenderer({ question, value, onChange }: LikertRendererProps) {
  const options: number[] = [];
  for (let i = question.min; i <= question.max; i++) {
    options.push(i);
  }

  return (
    <fieldset style={questionFieldsetStyle} aria-required={question.required}>
      <legend style={questionLegendStyle}>
        {question.label}
        {question.required && <span style={requiredMarkerStyle}> *</span>}
      </legend>
      {question.helpText && (
        <p style={helpTextStyle}>{question.helpText}</p>
      )}
      <div style={likertContainerStyle}>
        <span style={endpointLabelStyle}>{question.minLabel}</span>
        <div style={likertOptionsStyle}>
          {options.map((opt) => (
            <label key={opt} style={likertOptionStyle}>
              <input
                type="radio"
                name={question.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                style={radioInputStyle}
                tabIndex={0}
              />
              <span
                style={{
                  ...radioButtonStyle,
                  ...(value === opt ? radioButtonActiveStyle : {}),
                }}
                aria-label={`${question.label}: ${opt}`}
              >
                {opt}
              </span>
            </label>
          ))}
        </div>
        <span style={endpointLabelStyle}>{question.maxLabel}</span>
      </div>
    </fieldset>
  );
}

// --- Boolean Question ---

interface BooleanRendererProps {
  question: BooleanQuestion;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}

function BooleanQuestionRenderer({ question, value, onChange }: BooleanRendererProps) {
  return (
    <fieldset style={questionFieldsetStyle}>
      <legend style={questionLegendStyle}>
        {question.label}
        {question.required && <span style={requiredMarkerStyle}> *</span>}
      </legend>
      {question.helpText && (
        <p style={helpTextStyle}>{question.helpText}</p>
      )}
      <div style={booleanContainerStyle}>
        <button
          type="button"
          onClick={() => onChange(value === true ? null : true)}
          style={{
            ...booleanButtonStyle,
            ...(value === true ? booleanButtonActiveStyle : {}),
          }}
          aria-pressed={value === true}
          tabIndex={0}
        >
          {question.trueLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(value === false ? null : false)}
          style={{
            ...booleanButtonStyle,
            ...(value === false ? booleanButtonNegativeStyle : {}),
          }}
          aria-pressed={value === false}
          tabIndex={0}
        >
          {question.falseLabel}
        </button>
      </div>
    </fieldset>
  );
}

// --- Text Question ---

interface TextRendererProps {
  question: TextQuestion;
  value: string | null;
  onChange: (value: string | null) => void;
}

function TextQuestionRenderer({ question, value, onChange }: TextRendererProps) {
  return (
    <fieldset style={questionFieldsetStyle}>
      <legend style={questionLegendStyle}>
        {question.label}
        {question.required && <span style={requiredMarkerStyle}> *</span>}
      </legend>
      {question.helpText && (
        <p style={helpTextStyle}>{question.helpText}</p>
      )}
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={question.placeholder}
        maxLength={question.maxLength}
        style={textareaStyle}
        rows={3}
        tabIndex={0}
      />
    </fieldset>
  );
}

// --- Styles ---

const panelStyle: React.CSSProperties = {
  width: 320,
  height: '100%',
  backgroundColor: '#1a1a2e',
  borderLeft: '1px solid #2a2a4a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '16px 16px 8px',
  borderBottom: '1px solid #2a2a4a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#e0e0e0',
  margin: 0,
};

const successBadgeStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#4caf50',
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 4,
  backgroundColor: 'rgba(76, 175, 80, 0.15)',
};

const questionsContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '12px 16px',
};

const footerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderTop: '1px solid #2a2a4a',
  flexShrink: 0,
};

const submitButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#6c63ff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'background-color 0.2s, opacity 0.2s',
};

const submitButtonDisabledStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
  backgroundColor: '#4a4a6a',
};

const validationHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#ff9800',
  marginTop: 8,
  textAlign: 'center',
};

const shortcutHintStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#666',
  marginTop: 4,
  textAlign: 'center',
};

const questionFieldsetStyle: React.CSSProperties = {
  border: 'none',
  padding: 0,
  margin: '0 0 16px 0',
};

const questionLegendStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#e0e0e0',
  marginBottom: 4,
  display: 'block',
};

const requiredMarkerStyle: React.CSSProperties = {
  color: '#ff6b6b',
};

const helpTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#888',
  margin: '0 0 8px 0',
};

const likertContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const endpointLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#888',
  whiteSpace: 'nowrap',
  minWidth: 50,
  textAlign: 'center',
};

const likertOptionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  flex: 1,
  justifyContent: 'center',
};

const likertOptionStyle: React.CSSProperties = {
  display: 'inline-flex',
  cursor: 'pointer',
};

const radioInputStyle: React.CSSProperties = {
  position: 'absolute',
  opacity: 0,
  width: 0,
  height: 0,
};

const radioButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '2px solid #3a3a5a',
  backgroundColor: '#0d0d1a',
  color: '#aaa',
  fontSize: 13,
  fontWeight: 500,
  transition: 'all 0.15s',
  userSelect: 'none',
};

const radioButtonActiveStyle: React.CSSProperties = {
  borderColor: '#6c63ff',
  backgroundColor: '#6c63ff',
  color: '#ffffff',
};

const booleanContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const booleanButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 500,
  color: '#aaa',
  backgroundColor: '#0d0d1a',
  border: '2px solid #3a3a5a',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const booleanButtonActiveStyle: React.CSSProperties = {
  borderColor: '#4caf50',
  backgroundColor: 'rgba(76, 175, 80, 0.15)',
  color: '#4caf50',
};

const booleanButtonNegativeStyle: React.CSSProperties = {
  borderColor: '#ff6b6b',
  backgroundColor: 'rgba(255, 107, 107, 0.15)',
  color: '#ff6b6b',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 12,
  color: '#e0e0e0',
  backgroundColor: '#0d0d1a',
  border: '1px solid #3a3a5a',
  borderRadius: 4,
  resize: 'vertical',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};
