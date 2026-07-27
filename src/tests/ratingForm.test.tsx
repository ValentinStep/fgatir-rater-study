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

  /** All required responses answered — 7 boolean + 3 Likert */
  const allRequiredResponses = [
    { questionId: 'viz_mamillothalamic_tract', value: true },
    { questionId: 'viz_stn', value: false },
    { questionId: 'viz_dentato_rubro_thalamic', value: true },
    { questionId: 'viz_red_nuclei', value: true },
    { questionId: 'viz_medial_lemniscus', value: false },
    { questionId: 'viz_mlf', value: true },
    { questionId: 'viz_olives', value: false },
    { questionId: 'thalamic_nuclei_delineation', value: 4 },
    { questionId: 'brainstem_structure_clarity', value: 3 },
    { questionId: 'diagnostic_confidence_posterior_fossa', value: 5 },
  ];

  it('renders the display label', () => {
    render(<RatingForm {...defaultProps} />);
    expect(screen.getByText('Image set 1')).toBeInTheDocument();
  });

  it('renders all rating questions', () => {
    render(<RatingForm {...defaultProps} />);
    // Boolean questions
    expect(screen.getByText('Mamillo-thalamic tract')).toBeInTheDocument();
    expect(screen.getByText('Subthalamic nucleus (STN)')).toBeInTheDocument();
    expect(screen.getByText('Dentato-rubro-thalamic tract')).toBeInTheDocument();
    expect(screen.getByText('Red nuclei')).toBeInTheDocument();
    expect(screen.getByText('Medial lemniscus')).toBeInTheDocument();
    expect(screen.getByText('MLF (Medial longitudinal fasciculus)')).toBeInTheDocument();
    expect(screen.getByText('Olives')).toBeInTheDocument();
    // Likert questions
    expect(screen.getByText('Thalamic nuclei delineation')).toBeInTheDocument();
    expect(screen.getByText('Brainstem internal structure clarity')).toBeInTheDocument();
    expect(screen.getByText('Overall diagnostic confidence for posterior fossa')).toBeInTheDocument();
    // Text
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
    render(<RatingForm {...defaultProps} initialResponses={allRequiredResponses} />);
    const button = screen.getByRole('button', { name: /save and continue/i });
    expect(button).not.toBeDisabled();
  });

  it('calls onSubmit with responses when submit button clicked', () => {
    const onSubmit = vi.fn();

    render(
      <RatingForm {...defaultProps} onSubmit={onSubmit} initialResponses={allRequiredResponses} />,
    );

    const button = screen.getByRole('button', { name: /save and continue/i });
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ questionId: 'viz_mamillothalamic_tract', value: true }),
        expect.objectContaining({ questionId: 'thalamic_nuclei_delineation', value: 4 }),
      ]),
    );
  });

  it('shows "Saving..." text when isSaving is true', () => {
    render(<RatingForm {...defaultProps} isSaving={true} initialResponses={allRequiredResponses} />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows success badge when showSuccess is true', () => {
    render(<RatingForm {...defaultProps} showSuccess={true} />);
    expect(screen.getByText('✓ Saved')).toBeInTheDocument();
  });

  it('renders Yes/No buttons for boolean questions', () => {
    render(<RatingForm {...defaultProps} />);
    // 7 boolean questions × 2 buttons (Yes + No) = 14 buttons (plus submit = 15 total)
    const yesButtons = screen.getAllByText('Yes');
    const noButtons = screen.getAllByText('No');
    expect(yesButtons.length).toBe(7);
    expect(noButtons.length).toBe(7);
  });

  it('renders likert scale options (1-5) for each likert question', () => {
    render(<RatingForm {...defaultProps} />);
    // Each likert question has radio inputs labeled 1-5
    const radios = screen.getAllByRole('radio');
    // 3 likert questions × 5 options = 15 radio buttons
    expect(radios.length).toBe(15);
  });

  it('renders endpoint labels for likert questions', () => {
    render(<RatingForm {...defaultProps} />);
    expect(screen.getAllByText('Very poor').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Excellent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Not confident')).toBeInTheDocument();
    expect(screen.getByText('Very confident')).toBeInTheDocument();
  });

  it('calls onResponsesChange when a response is updated', () => {
    const onResponsesChange = vi.fn();
    render(
      <RatingForm {...defaultProps} onResponsesChange={onResponsesChange} />,
    );

    // Click a Yes button for the first boolean question
    const yesButtons = screen.getAllByText('Yes');
    fireEvent.click(yesButtons[0]!);
    expect(onResponsesChange).toHaveBeenCalled();
  });
});
