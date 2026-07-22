/**
 * Tests for RatingForm component.
 * Tests rendering, disabled submit state, and completed submit state.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RatingForm } from '@/components/RatingForm/RatingForm';

describe('RatingForm', () => {
  const defaultProps = {
    displayLabel: 'Image set 1',
    onSubmit: vi.fn(),
    isSaving: false,
    initialResponses: [],
  };

  it('renders the display label', () => {
    render(<RatingForm {...defaultProps} />);
    expect(screen.getByText('Image set 1')).toBeInTheDocument();
  });

  it('renders all rating questions', () => {
    render(<RatingForm {...defaultProps} />);
    expect(screen.getByText('Overall image quality')).toBeInTheDocument();
    expect(screen.getByText('Perceived image noise')).toBeInTheDocument();
    expect(screen.getByText('Anatomic sharpness')).toBeInTheDocument();
    expect(screen.getByText('Artifacts')).toBeInTheDocument();
    expect(screen.getByText('Diagnostic confidence')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('renders Save & Next button', () => {
    render(<RatingForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /save and continue/i })).toBeInTheDocument();
  });

  it('disables submit button when not all required questions are answered', () => {
    render(<RatingForm {...defaultProps} />);
    const button = screen.getByRole('button', { name: /save and continue/i });
    expect(button).toBeDisabled();
  });

  it('shows validation hint when form is incomplete', () => {
    render(<RatingForm {...defaultProps} />);
    expect(
      screen.getByText('Answer all required questions to continue'),
    ).toBeInTheDocument();
  });

  it('enables submit button when all required questions are answered', () => {
    const initialResponses = [
      { questionId: 'overall_quality', value: 4 },
      { questionId: 'perceived_noise', value: 3 },
      { questionId: 'anatomic_sharpness', value: 5 },
      { questionId: 'artifacts', value: 4 },
      { questionId: 'diagnostic_confidence', value: 3 },
    ];

    render(<RatingForm {...defaultProps} initialResponses={initialResponses} />);
    const button = screen.getByRole('button', { name: /save and continue/i });
    expect(button).not.toBeDisabled();
  });

  it('calls onSubmit with responses when submit button clicked', () => {
    const onSubmit = vi.fn();
    const initialResponses = [
      { questionId: 'overall_quality', value: 4 },
      { questionId: 'perceived_noise', value: 3 },
      { questionId: 'anatomic_sharpness', value: 5 },
      { questionId: 'artifacts', value: 4 },
      { questionId: 'diagnostic_confidence', value: 3 },
    ];

    render(
      <RatingForm {...defaultProps} onSubmit={onSubmit} initialResponses={initialResponses} />,
    );

    const button = screen.getByRole('button', { name: /save and continue/i });
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ questionId: 'overall_quality', value: 4 }),
      ]),
    );
  });

  it('shows "Saving..." text when isSaving is true', () => {
    const initialResponses = [
      { questionId: 'overall_quality', value: 4 },
      { questionId: 'perceived_noise', value: 3 },
      { questionId: 'anatomic_sharpness', value: 5 },
      { questionId: 'artifacts', value: 4 },
      { questionId: 'diagnostic_confidence', value: 3 },
    ];

    render(<RatingForm {...defaultProps} isSaving={true} initialResponses={initialResponses} />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows success badge when showSuccess is true', () => {
    render(<RatingForm {...defaultProps} showSuccess={true} />);
    expect(screen.getByText('✓ Saved')).toBeInTheDocument();
  });

  it('renders likert scale options (1-5) for each likert question', () => {
    render(<RatingForm {...defaultProps} />);
    // Each likert question has radio inputs labeled 1-5
    const radios = screen.getAllByRole('radio');
    // 5 likert questions * 5 options = 25 radio buttons
    expect(radios.length).toBe(25);
  });

  it('renders endpoint labels for likert questions', () => {
    render(<RatingForm {...defaultProps} />);
    expect(screen.getByText('Very poor')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('calls onResponsesChange when a response is updated', () => {
    const onResponsesChange = vi.fn();
    render(
      <RatingForm {...defaultProps} onResponsesChange={onResponsesChange} />,
    );

    const radios = screen.getAllByRole('radio');
    // Click the first radio button (first question, value 1)
    fireEvent.click(radios[0]!);
    expect(onResponsesChange).toHaveBeenCalled();
  });
});
