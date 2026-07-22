/**
 * DicomViewport.tsx
 *
 * Cornerstone3D stack viewport component for displaying DICOM images.
 * Handles initialization, rendering, overlay display, and cleanup.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { RenderingEngine, Enums, type Types } from '@cornerstonejs/core';
import { init as initTools } from '@cornerstonejs/tools';
import {
  registerTools,
  createViewerToolGroup,
} from '@/cornerstone/configureTools';

export interface DicomViewportProps {
  imageIds: string[];
  initialWindowCenter?: number;
  initialWindowWidth?: number;
  onSliceChange?: (currentSlice: number, totalSlices: number) => void;
  onVoiChange?: (windowCenter: number, windowWidth: number) => void;
}

interface ViewportState {
  status: 'loading' | 'ready' | 'error' | 'empty';
  error?: string;
  currentSlice: number;
  totalSlices: number;
  windowCenter: number;
  windowWidth: number;
}

const RENDERING_ENGINE_ID = 'fgatir-rendering-engine';
const VIEWPORT_ID = 'fgatir-stack-viewport';

export function DicomViewport({
  imageIds,
  initialWindowCenter,
  initialWindowWidth,
  onSliceChange,
  onVoiChange,
}: DicomViewportProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const viewportRef = useRef<Types.IStackViewport | null>(null);

  const initialStatus = imageIds.length === 0 ? 'empty' : 'loading';

  const [state, setState] = useState<ViewportState>({
    status: initialStatus,
    currentSlice: 1,
    totalSlices: 0,
    windowCenter: initialWindowCenter ?? 0,
    windowWidth: initialWindowWidth ?? 0,
  });

  // Initialize viewport
  useEffect(() => {
    if (imageIds.length === 0) return;
    if (!elementRef.current) return;

    let destroyed = false;
    const element = elementRef.current;

    async function setup() {
      try {
        // Initialize tools (idempotent)
        initTools();
        registerTools();

        // Create or get rendering engine
        let renderingEngine = renderingEngineRef.current;
        if (!renderingEngine) {
          renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
          renderingEngineRef.current = renderingEngine;
        }

        if (destroyed) return;

        // Enable the element for cornerstone
        const viewportInput: Types.PublicViewportInput = {
          viewportId: VIEWPORT_ID,
          type: Enums.ViewportType.STACK,
          element,
          defaultOptions: {
            background: [0, 0, 0] as Types.Point3,
          },
        };

        renderingEngine.enableElement(viewportInput);

        if (destroyed) return;

        // Get the viewport
        const viewport = renderingEngine.getViewport(
          VIEWPORT_ID,
        ) as Types.IStackViewport;
        viewportRef.current = viewport;

        // Create tool group for this viewport
        createViewerToolGroup(VIEWPORT_ID, RENDERING_ENGINE_ID);

        // Set the stack
        await viewport.setStack(imageIds, 0);

        if (destroyed) return;

        // Set initial window/level if provided
        if (initialWindowCenter !== undefined && initialWindowWidth !== undefined) {
          viewport.setProperties({
            voiRange: {
              lower: initialWindowCenter - initialWindowWidth / 2,
              upper: initialWindowCenter + initialWindowWidth / 2,
            },
          });
        }

        // Render
        viewport.render();

        setState({
          status: 'ready',
          currentSlice: 1,
          totalSlices: imageIds.length,
          windowCenter: initialWindowCenter ?? 0,
          windowWidth: initialWindowWidth ?? 0,
        });
      } catch (error) {
        if (destroyed) return;
        const message =
          error instanceof Error ? error.message : String(error);
        console.error('[DicomViewport] Setup failed:', message);
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: message,
        }));
      }
    }

    setup();

    // Event listeners for VOI and slice changes
    const handleVoiModified = () => {
      if (destroyed || !viewportRef.current) return;
      const properties = viewportRef.current.getProperties();
      const voiRange = properties.voiRange;
      if (voiRange) {
        const wc = (voiRange.lower + voiRange.upper) / 2;
        const ww = voiRange.upper - voiRange.lower;
        setState((prev) => ({
          ...prev,
          windowCenter: Math.round(wc),
          windowWidth: Math.round(ww),
        }));
        onVoiChange?.(Math.round(wc), Math.round(ww));
      }
    };

    const handleStackScroll = () => {
      if (destroyed || !viewportRef.current) return;
      const currentIndex = viewportRef.current.getCurrentImageIdIndex();
      const newSlice = currentIndex + 1;
      setState((prev) => ({
        ...prev,
        currentSlice: newSlice,
      }));
      onSliceChange?.(newSlice, imageIds.length);
    };

    element.addEventListener(
      Enums.Events.VOI_MODIFIED,
      handleVoiModified,
    );
    element.addEventListener(
      Enums.Events.STACK_VIEWPORT_SCROLL,
      handleStackScroll,
    );

    return () => {
      destroyed = true;

      element.removeEventListener(
        Enums.Events.VOI_MODIFIED,
        handleVoiModified,
      );
      element.removeEventListener(
        Enums.Events.STACK_VIEWPORT_SCROLL,
        handleStackScroll,
      );

      // Cleanup rendering engine
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }
      viewportRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIds]);

  // Prevent browser context menu on viewport
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Public methods via state
  const currentSlice = state.currentSlice;
  const totalSlices = state.totalSlices;

  return (
    <div className="dicom-viewport-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Viewport element */}
      <div
        ref={elementRef}
        className="dicom-viewport"
        onContextMenu={handleContextMenu}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          position: 'relative',
        }}
      />

      {/* Loading state */}
      {state.status === 'loading' && (
        <div className="viewport-overlay viewport-loading" style={overlayStyle}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div className="spinner" style={spinnerStyle} />
            <p>Loading DICOM series...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {state.status === 'error' && (
        <div className="viewport-overlay viewport-error" style={overlayStyle}>
          <div style={{ textAlign: 'center', color: '#ff6b6b' }}>
            <p>⚠ Error loading images</p>
            <p style={{ fontSize: '0.8em', color: '#ccc' }}>{state.error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {state.status === 'empty' && (
        <div className="viewport-overlay viewport-empty" style={overlayStyle}>
          <div style={{ textAlign: 'center', color: '#aaa' }}>
            <p>No images to display</p>
          </div>
        </div>
      )}

      {/* Overlays (shown when ready) */}
      {state.status === 'ready' && (
        <>
          {/* Slice info - top left */}
          <div
            className="viewport-info-topleft"
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              color: '#fff',
              fontSize: '12px',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            Slice: {currentSlice} / {totalSlices}
          </div>

          {/* Window info - bottom right */}
          <div
            className="viewport-info-bottomright"
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              color: '#fff',
              fontSize: '12px',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            WW: {state.windowWidth} WC: {state.windowCenter}
          </div>
        </>
      )}
    </div>
  );
}

// --- Styles ---

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  zIndex: 10,
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid rgba(255,255,255,0.3)',
  borderTop: '3px solid #fff',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
  margin: '0 auto 12px',
};

export default DicomViewport;
