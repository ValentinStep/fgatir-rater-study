/**
 * ProgressHeader Component
 *
 * Top bar showing study progress, current series label,
 * and unsaved changes warning.
 */

export interface ProgressHeaderProps {
  /** Study display name */
  studyTitle: string;
  /** Current item index (1-based) */
  currentItem: number;
  /** Total number of items */
  totalItems: number;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether the study is complete */
  isComplete: boolean;
}

export function ProgressHeader({
  studyTitle,
  currentItem,
  totalItems,
  hasUnsavedChanges,
  isComplete,
}: ProgressHeaderProps) {
  const progressFraction = isComplete
    ? 1
    : totalItems > 0
      ? (currentItem - 1) / totalItems
      : 0;
  const progressPercent = Math.round(progressFraction * 100);

  return (
    <header style={headerStyle} role="banner" aria-label="Study progress">
      <div style={leftSectionStyle}>
        <h1 style={titleStyle}>{studyTitle}</h1>
      </div>

      <div style={centerSectionStyle}>
        {isComplete ? (
          <span style={completeTextStyle}>Study complete</span>
        ) : (
          <span style={progressTextStyle}>
            Image set {currentItem} of {totalItems}
          </span>
        )}
        {hasUnsavedChanges && !isComplete && (
          <span style={warningStyle} title="Unsaved changes" aria-label="Unsaved changes warning">
            ⚠
          </span>
        )}
      </div>

      <div style={rightSectionStyle}>
        <div style={progressBarContainerStyle}>
          <div
            style={{
              ...progressBarFillStyle,
              width: `${progressPercent}%`,
            }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPercent}% complete`}
          />
        </div>
        <span style={fractionStyle}>
          {isComplete
            ? `${totalItems}/${totalItems}`
            : `${currentItem - 1}/${totalItems}`}
        </span>
      </div>
    </header>
  );
}

// --- Styles ---

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  backgroundColor: '#12122a',
  borderBottom: '1px solid #2a2a4a',
  flexShrink: 0,
  height: 44,
  boxSizing: 'border-box',
};

const leftSectionStyle: React.CSSProperties = {
  flex: 1,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#e0e0e0',
  margin: 0,
  whiteSpace: 'nowrap',
};

const centerSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flex: 1,
  justifyContent: 'center',
};

const progressTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#ccc',
  fontWeight: 500,
};

const completeTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#4caf50',
  fontWeight: 600,
};

const warningStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#ff9800',
  cursor: 'default',
};

const rightSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flex: 1,
  justifyContent: 'flex-end',
};

const progressBarContainerStyle: React.CSSProperties = {
  width: 80,
  height: 6,
  backgroundColor: '#2a2a4a',
  borderRadius: 3,
  overflow: 'hidden',
};

const progressBarFillStyle: React.CSSProperties = {
  height: '100%',
  backgroundColor: '#6c63ff',
  borderRadius: 3,
  transition: 'width 0.3s ease',
};

const fractionStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#888',
  minWidth: 35,
  textAlign: 'right',
};
