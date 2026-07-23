/**
 * ViewerToolbar.tsx
 *
 * Toolbar component for the DICOM viewer with controls for:
 * - Reset (W/L, zoom, pan)
 * - Zoom in/out
 * - Slice navigation (slider, first/last buttons)
 * - MPR plane selector (Axial, Sagittal, Coronal)
 * - Current slice display
 * - Active tool indicator
 */

import { useCallback } from 'react';
import { getRenderingEngine, utilities } from '@cornerstonejs/core';

export type OrientationPlane = 'sagittal' | 'axial' | 'coronal';

export interface ViewerToolbarProps {
  currentSlice: number;
  totalSlices: number;
  windowCenter: number;
  windowWidth: number;
  renderingEngineId: string;
  viewportId: string;
  /** Optional paired viewport ID for synchronized dual-viewport mode */
  pairedViewportId?: string;
  initialWindowCenter?: number;
  initialWindowWidth?: number;
  /** Current orientation plane for MPR */
  orientation?: OrientationPlane;
  /** Callback when orientation plane is changed */
  onOrientationChange?: (plane: OrientationPlane) => void;
}

export function ViewerToolbar({
  currentSlice,
  totalSlices,
  windowCenter,
  windowWidth,
  renderingEngineId,
  viewportId,
  pairedViewportId,
  initialWindowCenter = 21,
  initialWindowWidth = 54,
  orientation = 'sagittal',
  onOrientationChange,
}: ViewerToolbarProps) {
  /** Get the primary viewport */
  const getViewport = useCallback(() => {
    const engine = getRenderingEngine(renderingEngineId);
    if (!engine) return null;
    return engine.getViewport(viewportId);
  }, [renderingEngineId, viewportId]);

  /** Get the paired viewport (if in dual mode) */
  const getPairedViewport = useCallback(() => {
    if (!pairedViewportId) return null;
    const engine = getRenderingEngine(renderingEngineId);
    if (!engine) return null;
    return engine.getViewport(pairedViewportId);
  }, [renderingEngineId, pairedViewportId]);

  const handleReset = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const voiRange = {
      lower: initialWindowCenter - initialWindowWidth / 2,
      upper: initialWindowCenter + initialWindowWidth / 2,
    };

    // Reset window/level
    (viewport as any).setProperties({ voiRange });
    // Reset camera (zoom, pan)
    viewport.resetCamera();
    viewport.render();

    // Apply to paired viewport as well
    const paired = getPairedViewport();
    if (paired) {
      (paired as any).setProperties({ voiRange });
      paired.resetCamera();
      paired.render();
    }
  }, [getViewport, getPairedViewport, initialWindowCenter, initialWindowWidth]);

  const handleZoomIn = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const camera = viewport.getCamera();
    const zoom = (camera.parallelScale ?? 1) * 0.8;
    viewport.setCamera({ parallelScale: zoom });
    viewport.render();

    // Sync zoom to paired viewport
    const paired = getPairedViewport();
    if (paired) {
      paired.setCamera({ parallelScale: zoom });
      paired.render();
    }
  }, [getViewport, getPairedViewport]);

  const handleZoomOut = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const camera = viewport.getCamera();
    const zoom = (camera.parallelScale ?? 1) * 1.25;
    viewport.setCamera({ parallelScale: zoom });
    viewport.render();

    // Sync zoom to paired viewport
    const paired = getPairedViewport();
    if (paired) {
      paired.setCamera({ parallelScale: zoom });
      paired.render();
    }
  }, [getViewport, getPairedViewport]);

  /** Jump to a specific slice index (0-based) via scroll delta */
  const jumpToSlice = useCallback(
    (targetIndex: number) => {
      const viewport = getViewport();
      if (!viewport) return;

      // For volume viewports, use getSliceIndex; for stack viewports, use getCurrentImageIdIndex
      let currentIndex: number;
      if ('getSliceIndex' in viewport) {
        currentIndex = (viewport as any).getSliceIndex();
      } else if ('getCurrentImageIdIndex' in viewport) {
        currentIndex = (viewport as any).getCurrentImageIdIndex();
      } else {
        return;
      }

      const delta = targetIndex - currentIndex;
      if (delta === 0) return;

      utilities.scroll(viewport as any, { delta });

      const paired = getPairedViewport();
      if (paired) {
        utilities.scroll(paired as any, { delta });
      }
    },
    [getViewport, getPairedViewport],
  );

  const handleSliceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSlice = parseInt(e.target.value, 10);
      const targetIndex = newSlice - 1; // slider is 1-based, index is 0-based
      jumpToSlice(targetIndex);
    },
    [jumpToSlice],
  );

  const handleFirstSlice = useCallback(() => {
    jumpToSlice(0);
  }, [jumpToSlice]);

  const handleLastSlice = useCallback(() => {
    jumpToSlice(totalSlices - 1);
  }, [jumpToSlice, totalSlices]);

  return (
    <div className="viewer-toolbar" style={toolbarStyle}>
      {/* Reset button */}
      <div className="toolbar-group" style={groupStyle}>
        <button
          onClick={handleReset}
          title="Reset window/level, zoom, and pan"
          style={buttonStyle}
        >
          ↺ Reset
        </button>
      </div>

      {/* Zoom controls */}
      <div className="toolbar-group" style={groupStyle}>
        <button onClick={handleZoomIn} title="Zoom in" style={buttonStyle}>
          🔍+
        </button>
        <button onClick={handleZoomOut} title="Zoom out" style={buttonStyle}>
          🔍−
        </button>
      </div>

      {/* MPR Plane selector */}
      <div className="toolbar-group" style={groupStyle}>
        <button
          onClick={() => onOrientationChange?.('sagittal')}
          title="Sagittal plane"
          style={orientation === 'sagittal' ? activeButtonStyle : buttonStyle}
        >
          Sag
        </button>
        <button
          onClick={() => onOrientationChange?.('axial')}
          title="Axial plane"
          style={orientation === 'axial' ? activeButtonStyle : buttonStyle}
        >
          Ax
        </button>
        <button
          onClick={() => onOrientationChange?.('coronal')}
          title="Coronal plane"
          style={orientation === 'coronal' ? activeButtonStyle : buttonStyle}
        >
          Cor
        </button>
      </div>

      {/* Slice navigation */}
      <div className="toolbar-group" style={{ ...groupStyle, flex: 1 }}>
        <button onClick={handleFirstSlice} title="First slice" style={buttonStyle}>
          ⏮
        </button>
        <input
          type="range"
          min={1}
          max={totalSlices || 1}
          value={currentSlice}
          onChange={handleSliceChange}
          title={`Slice ${currentSlice}/${totalSlices}`}
          style={{ flex: 1, margin: '0 8px' }}
        />
        <button onClick={handleLastSlice} title="Last slice" style={buttonStyle}>
          ⏭
        </button>
        <span style={sliceInfoStyle}>
          {currentSlice}/{totalSlices}
        </span>
      </div>

      {/* Window info */}
      <div className="toolbar-group" style={groupStyle}>
        <span style={infoStyle} title="Window Width / Window Center">
          WW:{windowWidth} WC:{windowCenter}
        </span>
      </div>

      {/* Active tool indicator */}
      <div className="toolbar-group" style={groupStyle}>
        <span style={{ ...infoStyle, fontSize: '10px' }} title="Mouse bindings">
          L:W/L | R:Pan | M:Zoom | Scroll:Slice
        </span>
      </div>
    </div>
  );
}

// --- Styles ---

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  backgroundColor: '#1a1a2e',
  borderBottom: '1px solid #333',
  color: '#e0e0e0',
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  flexWrap: 'wrap',
};

const groupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const buttonStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #444',
  borderRadius: 4,
  backgroundColor: '#2a2a3e',
  color: '#e0e0e0',
  cursor: 'pointer',
  fontSize: '12px',
  whiteSpace: 'nowrap',
};

const activeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#4c3fad',
  borderColor: '#6c63ff',
  color: '#fff',
  fontWeight: 600,
};

const sliceInfoStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '12px',
  minWidth: 60,
  textAlign: 'center',
};

const infoStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#aaa',
};

export default ViewerToolbar;
