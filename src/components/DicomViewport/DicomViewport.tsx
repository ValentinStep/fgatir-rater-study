/**
 * DicomViewport.tsx
 *
 * Cornerstone3D volume viewport component for displaying DICOM images.
 * Uses Volume viewport with MPR support for multi-planar reconstruction.
 * Handles initialization, rendering, overlay display, and cleanup.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  RenderingEngine,
  Enums,
  volumeLoader,
  cache,
  type Types,
} from '@cornerstonejs/core';
import {
  init as initTools,
  ToolGroupManager,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  StackScrollTool,
  Enums as ToolEnums,
  addTool,
} from '@cornerstonejs/tools';

export type OrientationPlane = 'sagittal' | 'axial' | 'coronal';

export interface DicomViewportProps {
  imageIds: string[];
  initialWindowCenter?: number;
  initialWindowWidth?: number;
  /** Current orientation plane for MPR */
  orientation?: OrientationPlane;
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
const VOLUME_ID = 'cornerstoneStreamingImageVolume:fgatir-seq-volume';
const TOOL_GROUP_ID = 'fgatir-seq-tool-group';

let toolsRegistered = false;

function registerViewportTools(): void {
  if (toolsRegistered) return;
  try { addTool(WindowLevelTool); } catch { /* already registered */ }
  try { addTool(PanTool); } catch { /* already registered */ }
  try { addTool(ZoomTool); } catch { /* already registered */ }
  try { addTool(StackScrollTool); } catch { /* already registered */ }
  toolsRegistered = true;
}

function orientationToAxis(plane: OrientationPlane): Enums.OrientationAxis {
  switch (plane) {
    case 'axial': return Enums.OrientationAxis.AXIAL;
    case 'coronal': return Enums.OrientationAxis.CORONAL;
    case 'sagittal': return Enums.OrientationAxis.SAGITTAL;
  }
}

export function DicomViewport({
  imageIds,
  initialWindowCenter,
  initialWindowWidth,
  orientation = 'sagittal',
  onSliceChange,
  onVoiChange,
}: DicomViewportProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const viewportRef = useRef<Types.IVolumeViewport | null>(null);
  const setupCompleteRef = useRef(false);

  const initialStatus = imageIds.length === 0 ? 'empty' : 'loading';

  const [state, setState] = useState<ViewportState>({
    status: initialStatus,
    currentSlice: 1,
    totalSlices: 0,
    windowCenter: initialWindowCenter ?? 0,
    windowWidth: initialWindowWidth ?? 0,
  });

  // Initialize viewport with Volume rendering
  useEffect(() => {
    if (imageIds.length === 0) return;
    if (!elementRef.current) return;

    let destroyed = false;
    const element = elementRef.current;

    async function setup() {
      try {
        // Initialize tools (idempotent)
        initTools();
        registerViewportTools();

        // Clean up previous rendering engine
        let renderingEngine = renderingEngineRef.current;
        if (renderingEngine) {
          renderingEngine.destroy();
        }

        // Remove old volume from cache
        try { cache.removeVolumeLoadObject(VOLUME_ID); } catch { /* ok */ }

        renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
        renderingEngineRef.current = renderingEngine;

        if (destroyed) return;

        // Create viewport as ORTHOGRAPHIC (volume) type
        const viewportInput: Types.PublicViewportInput = {
          viewportId: VIEWPORT_ID,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          element,
          defaultOptions: {
            background: [0, 0, 0] as Types.Point3,
            orientation: orientationToAxis(orientation),
          },
        };

        renderingEngine.setViewports([viewportInput]);

        if (destroyed) return;

        // Get viewport reference
        const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IVolumeViewport;
        viewportRef.current = viewport;

        // Create tool group
        const existingGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
        if (existingGroup) {
          ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
        }

        const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID)!;
        toolGroup.addTool(WindowLevelTool.toolName);
        toolGroup.addTool(PanTool.toolName);
        toolGroup.addTool(ZoomTool.toolName);
        toolGroup.addTool(StackScrollTool.toolName);

        // Set tool modes
        toolGroup.setToolActive(WindowLevelTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
        });
        toolGroup.setToolActive(PanTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }],
        });
        toolGroup.setToolActive(ZoomTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }],
        });
        toolGroup.setToolActive(StackScrollTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Wheel }],
        });

        // Associate viewport with tool group
        toolGroup.addViewport(VIEWPORT_ID, RENDERING_ENGINE_ID);

        // Create volume from image IDs
        const volume = await volumeLoader.createAndCacheVolumeFromImages(
          VOLUME_ID,
          imageIds,
        );

        if (destroyed) return;

        // Load volume (fetches pixel data)
        await volume.load();

        if (destroyed) return;

        // Set volume on viewport
        await viewport.setVolumes([{ volumeId: VOLUME_ID }]);

        if (destroyed) return;

        // Set initial window/level if provided
        if (initialWindowCenter !== undefined && initialWindowWidth !== undefined) {
          const voiRange = {
            lower: initialWindowCenter - initialWindowWidth / 2,
            upper: initialWindowCenter + initialWindowWidth / 2,
          };
          viewport.setProperties({ voiRange });
        }

        // Force render
        viewport.render();
        renderingEngine.render();

        // Determine initial slice count
        const numSlices = viewport.getNumberOfSlices();

        setupCompleteRef.current = true;

        setState({
          status: 'ready',
          currentSlice: Math.ceil(numSlices / 2),
          totalSlices: numSlices,
          windowCenter: initialWindowCenter ?? 0,
          windowWidth: initialWindowWidth ?? 0,
        });
      } catch (error) {
        if (destroyed) return;
        const message = error instanceof Error ? error.message : String(error);
        console.error('[DicomViewport] Setup failed:', message, error);
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
      const voiRange = properties?.voiRange;
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

    const handleVolumeScroll = () => {
      if (destroyed || !viewportRef.current) return;
      const currentIndex = viewportRef.current.getSliceIndex();
      const numSlices = viewportRef.current.getNumberOfSlices();
      const newSlice = currentIndex + 1;
      setState((prev) => ({
        ...prev,
        currentSlice: newSlice,
        totalSlices: numSlices,
      }));
      onSliceChange?.(newSlice, numSlices);
    };

    element.addEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified);
    element.addEventListener(Enums.Events.VOLUME_NEW_IMAGE, handleVolumeScroll);

    return () => {
      destroyed = true;
      setupCompleteRef.current = false;

      element.removeEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified);
      element.removeEventListener(Enums.Events.VOLUME_NEW_IMAGE, handleVolumeScroll);

      // Cleanup tool group
      const tg = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
      if (tg) ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);

      // Cleanup volume from cache
      try { cache.removeVolumeLoadObject(VOLUME_ID); } catch { /* ok */ }

      // Cleanup rendering engine
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }
      viewportRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIds]);

  // Handle orientation changes
  useEffect(() => {
    if (!setupCompleteRef.current) return;
    const vp = viewportRef.current;
    if (!vp) return;

    const axis = orientationToAxis(orientation);
    vp.setOrientation(axis);

    // Update slice count for new orientation
    setTimeout(() => {
      if (!viewportRef.current) return;
      const numSlices = viewportRef.current.getNumberOfSlices();
      const currentIndex = viewportRef.current.getSliceIndex();
      setState((prev) => ({
        ...prev,
        currentSlice: currentIndex + 1,
        totalSlices: numSlices,
      }));
      onSliceChange?.(currentIndex + 1, numSlices);
    }, 100);
  }, [orientation, onSliceChange]);

  // Prevent browser context menu on viewport
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

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
            <p>Loading volume data...</p>
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
            Slice: {state.currentSlice} / {state.totalSlices}
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
