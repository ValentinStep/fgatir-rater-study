/**
 * RaterLogin Component
 *
 * Simple login screen shown before the study begins.
 * Collects rater initials/ID (no password required).
 * Persists last-used ID in localStorage for convenience.
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'fgatir_rater_id';

export interface RaterLoginProps {
  studyDisplayName: string;
  onLogin: (raterId: string) => void;
}

export function RaterLogin({ studyDisplayName, onLogin }: RaterLoginProps) {
  const [raterId, setRaterId] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  });
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = raterId.trim();
      if (!trimmed) {
        setError('Please enter your rater ID or initials.');
        return;
      }
      if (trimmed.length < 2) {
        setError('ID must be at least 2 characters.');
        return;
      }
      localStorage.setItem(STORAGE_KEY, trimmed);
      onLogin(trimmed);
    },
    [raterId, onLogin],
  );

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>{studyDisplayName}</h1>
        <p style={subtitleStyle}>Image Quality Assessment Study</p>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label htmlFor="rater-id" style={labelStyle}>
            Rater ID / Initials
          </label>
          <input
            id="rater-id"
            type="text"
            value={raterId}
            onChange={(e) => {
              setRaterId(e.target.value);
              setError('');
            }}
            placeholder="e.g., TS, VS, rater-01"
            style={inputStyle}
            autoFocus
            autoComplete="off"
          />
          {error && <p style={errorStyle}>{error}</p>}

          <button type="submit" style={buttonStyle}>
            Start Study
          </button>
        </form>

        <p style={hintStyle}>
          Your ID is used to track your progress and identify your ratings.
          You can resume later by entering the same ID.
        </p>
      </div>
    </div>
  );
}

// --- Styles ---

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0d0d1a',
};

const cardStyle: React.CSSProperties = {
  maxWidth: 400,
  width: '90%',
  padding: '40px 36px',
  backgroundColor: '#1a1a2e',
  borderRadius: 12,
  border: '1px solid #2a2a4a',
  textAlign: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#e0e0e0',
  marginBottom: 4,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#888',
  marginBottom: 32,
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#ccc',
  textAlign: 'left',
};

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 14,
  color: '#e0e0e0',
  backgroundColor: '#0d0d1a',
  border: '2px solid #3a3a5a',
  borderRadius: 6,
  outline: 'none',
  textAlign: 'center',
  letterSpacing: '0.5px',
};

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#ff6b6b',
  margin: 0,
};

const buttonStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '12px 24px',
  fontSize: 14,
  fontWeight: 600,
  color: '#ffffff',
  backgroundColor: '#6c63ff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'background-color 0.15s',
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#666',
  marginTop: 24,
  lineHeight: 1.5,
};
