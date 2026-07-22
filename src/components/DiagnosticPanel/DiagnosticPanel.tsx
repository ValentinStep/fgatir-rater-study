/**
 * DiagnosticPanel.tsx
 *
 * Diagnostic panel showing Cornerstone initialization status,
 * manifest info, viewport state, and system capabilities.
 * Only visible in dev mode.
 * Redacts: paths containing user directories, any PHI fields.
 */

import { useState, useEffect, useCallback } from 'react';
import { isCornerstoneInitialized, getRenderBackend } from '@cornerstonejs/core';
import { getInitError } from '@/cornerstone/initCornerstone';
import type { StudyManifest, SeriesEntry } from '@/services/imageSource';

export interface DiagnosticPanelProps {
  manifest: StudyManifest | null;
  manifestError: string | null;
  currentSeriesId: string | null;
  currentSlice: number;
  totalSlices: number;
  windowCenter: number;
  windowWidth: number;
}

interface DiagnosticReport {
  cornerstoneInit: boolean;
  initError: string | null;
  renderBackend: string;
  webglAvailable: boolean;
  manifestLoaded: boolean;
  manifestError: string | null;
  manifestVersion: string | null;
  caseCount: number;
  currentSeries: SeriesEntry | null;
  currentSlice: number;
  totalSlices: number;
  windowCenter: number;
  windowWidth: number;
  userAgent: string;
  timestamp: string;
}

export function DiagnosticPanel({
  manifest,
  manifestError,
  currentSeriesId,
  currentSlice,
  totalSlices,
  windowCenter,
  windowWidth,
}: DiagnosticPanelProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only show in development mode
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    // Listen for keyboard shortcut to toggle (Ctrl+Shift+D)
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const buildReport = useCallback((): DiagnosticReport => {
    // Find current series info
    let currentSeries: SeriesEntry | null = null;
    if (manifest && currentSeriesId) {
      for (const caseEntry of manifest.cases) {
        const found = caseEntry.series.find(
          (s) => s.seriesId === currentSeriesId,
        );
        if (found) {
          currentSeries = found;
          break;
        }
      }
    }

    // Check WebGL availability
    let webglAvailable = false;
    try {
      const canvas = document.createElement('canvas');
      webglAvailable = !!(
        canvas.getContext('webgl2') || canvas.getContext('webgl')
      );
    } catch {
      // WebGL not available
    }

    let renderBackend = 'unknown';
    try {
      renderBackend = String(getRenderBackend());
    } catch {
      // May fail if not initialized
    }

    return {
      cornerstoneInit: isCornerstoneInitialized(),
      initError: getInitError()?.message ?? null,
      renderBackend,
      webglAvailable,
      manifestLoaded: manifest !== null,
      manifestError: manifestError ? redactPaths(manifestError) : null,
      manifestVersion: manifest?.version ?? null,
      caseCount: manifest?.cases.length ?? 0,
      currentSeries,
      currentSlice,
      totalSlices,
      windowCenter,
      windowWidth,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
  }, [
    manifest,
    manifestError,
    currentSeriesId,
    currentSlice,
    totalSlices,
    windowCenter,
    windowWidth,
  ]);

  const handleCopy = useCallback(() => {
    const report = buildReport();
    const text = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [buildReport]);

  if (!isDev || !visible) {
    return null;
  }

  const report = buildReport();

  return (
    <div className="diagnostic-panel" style={panelStyle}>
      <div style={headerStyle}>
        <h3 style={{ margin: 0, fontSize: 14 }}>🔧 Diagnostics</h3>
        <button onClick={() => setVisible(false)} style={closeButtonStyle}>
          ✕
        </button>
      </div>

      <div style={contentStyle}>
        <DiagRow label="Cornerstone Init" value={report.cornerstoneInit ? '✓ Ready' : '✗ Not initialized'} />
        {report.initError && (
          <DiagRow label="Init Error" value={report.initError} error />
        )}
        <DiagRow label="Render Backend" value={report.renderBackend} />
        <DiagRow label="WebGL" value={report.webglAvailable ? '✓ Available' : '✗ Not available'} />
        <DiagRow label="Manifest" value={report.manifestLoaded ? '✓ Loaded' : '✗ Not loaded'} />
        {report.manifestError && (
          <DiagRow label="Manifest Error" value={report.manifestError} error />
        )}
        <DiagRow label="Manifest Version" value={report.manifestVersion ?? 'N/A'} />
        <DiagRow label="Cases" value={String(report.caseCount)} />

        {report.currentSeries && (
          <>
            <div style={sectionDivider} />
            <DiagRow label="Series ID" value={report.currentSeries.seriesId} />
            <DiagRow label="Dimensions" value={`${report.currentSeries.rows}×${report.currentSeries.columns}`} />
            <DiagRow label="Bits" value={`${report.currentSeries.bitsStored}/${report.currentSeries.bitsAllocated}`} />
            <DiagRow label="Transfer Syntax" value={report.currentSeries.transferSyntaxUID} />
          </>
        )}

        <div style={sectionDivider} />
        <DiagRow label="Current Slice" value={`${report.currentSlice}/${report.totalSlices}`} />
        <DiagRow label="Window" value={`WW:${report.windowWidth} WC:${report.windowCenter}`} />
      </div>

      <div style={footerStyle}>
        <button onClick={handleCopy} style={copyButtonStyle}>
          {copied ? '✓ Copied!' : '📋 Copy diagnostic report'}
        </button>
      </div>
    </div>
  );
}

// --- Helper components ---

function DiagRow({
  label,
  value,
  error = false,
}: {
  label: string;
  value: string;
  error?: boolean;
}) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}:</span>
      <span style={{ ...valueStyle, color: error ? '#ff6b6b' : '#e0e0e0' }}>
        {value}
      </span>
    </div>
  );
}

// --- Utilities ---

function redactPaths(str: string): string {
  // Redact paths containing user directories
  return str.replace(/\/Users\/[^/\s]+/g, '/Users/[REDACTED]');
}

// --- Styles ---

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  width: 380,
  maxHeight: '60vh',
  backgroundColor: '#1a1a2e',
  border: '1px solid #444',
  borderRadius: 8,
  boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  fontSize: 12,
  fontFamily: 'monospace',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  borderBottom: '1px solid #333',
  color: '#e0e0e0',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#aaa',
  cursor: 'pointer',
  fontSize: 14,
};

const contentStyle: React.CSSProperties = {
  padding: '8px 12px',
  overflowY: 'auto',
  flex: 1,
};

const footerStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderTop: '1px solid #333',
};

const copyButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 12px',
  border: '1px solid #444',
  borderRadius: 4,
  backgroundColor: '#2a2a3e',
  color: '#e0e0e0',
  cursor: 'pointer',
  fontSize: 11,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '2px 0',
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  color: '#888',
  flexShrink: 0,
};

const valueStyle: React.CSSProperties = {
  color: '#e0e0e0',
  textAlign: 'right',
  wordBreak: 'break-all',
};

const sectionDivider: React.CSSProperties = {
  borderTop: '1px solid #333',
  margin: '6px 0',
};

export default DiagnosticPanel;
