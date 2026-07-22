/**
 * ViewerToolbar.tsx
 *
 * Toolbar component for the DICOM viewer with controls for:
 * - Reset (W/L, zoom, pan)
 * - Zoom in/out
 * - Slice navigation (slider, first/last buttons)
 * - Current slice display
 * - Active tool indicator
 * - Keyboard shortcuts display
 */

import { useCallback } from 'react';
import { getRenderingEngine, type Types } from '@cornerstonejs/core';

export interface ViewerToolbarProps {
  currentSlice: number;
  totalSlices: number;
  windowCenter: number;
  windowWidth: number;
  renderingEngineId: string;
  viewportId: string;
  initialWindowCenter?: number;
  initialWindowWidth?: number;
}

export function ViewerToolbar({
  currentSlice,
  totalSlices,
  windowCenter,
  windowWidth,
  renderingEngineId,
  viewportId,
  initialWindowCenter = 21,
  initialWindowWidth = 54,
}: ViewerToolbarProps) {
  const getViewport = useCallback((): Types.IStackViewport | null => {
    const engine = getRenderingEngine(renderingEngineId);
    if (!engine) return null;
    return engine.getViewport(viewportId) as Types.IStackViewport;
  }, [renderingEngineId, viewportId]);

  const handleReset = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;

    // Reset window/level
    viewport.setProperties({
      voiRange: {
        lower: initialWindowCenter - initialWindowWidth / 2,
        upper: initialWindowCenter + initialWindowWidth / 2,
      },
    });

    // Reset camera (zoom, pan)
    viewport.resetCamera();
    viewport.render();
  }, [getViewport, initialWindowCenter, initialWindowWidth]);

  const handleZoomIn = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const camera = viewport.getCamera();
    const zoom = (camera.parallelScale ?? 1) * 0.8;
    viewport.setCamera({ parallelScale: zoom });
    viewport.render();
  }, [getViewport]);

  const handleZoomOut = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const camera = viewport.getCamera();
    const zoom = (camera.parallelScale ?? 1) * 1.25;
    viewport.setCamera({ parallelScale: zoom });
    viewport.render();
  }, [getViewport]);

  const handleSliceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const viewport = getViewport();
      if (!viewport) return;
      const newIndex = parseInt(e.target.value, 10) - 1;
      viewport.setImageIdIndex(newIndex);
    },
    [getViewport],
  );

  const handleFirstSlice = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;
    viewport.setImageIdIndex(0);
  }, [getViewport]);

  const handleLastSlice = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;
    viewport.setImageIdIndex(totalSlices - 1);
  }, [getViewport, totalSlices]);

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
