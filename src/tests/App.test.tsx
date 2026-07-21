import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../app/App';

describe('App', () => {
  it('renders the application title', () => {
    render(<App />);
    expect(screen.getByText('FGATIR Rater Study')).toBeInTheDocument();
  });

  it('shows login view by default', () => {
    render(<App />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});
