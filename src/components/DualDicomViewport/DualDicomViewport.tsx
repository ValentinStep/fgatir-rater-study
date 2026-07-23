/**
 * DualDicomViewport.tsx
 *
 * Side-by-side dual viewport component for paired comparison viewing.
 * Creates TWO Cornerstone stack viewports with synchronized scrolling and W/L.
 * Uses a shared RenderingEngine and @cornerstonejs/tools synchronizers.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { RenderingEngine, Enums, type Types } from '@cornerstonejs/core';
import {
  init as initTools,
  synchronizers as syncModule,
  SynchronizerManager,
  ToolGroupManager,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  StackScrollTool,
  Enums as ToolEnums,
  addTool,
} from '@cornerstonejs/tools';

export interface DualDicomViewportProps {
  /** Image IDs for the left viewport ("Image A") */
  leftImageIds: string[];
  /** Image IDs for the right viewport ("Image B") */
  rightImageIds: string[];
  /** Initial window center for both viewports */
  initialWindowCenter?: number;
  /** Initial window width for both viewports */
  initialWindowWidth?: number;
  /** Callback when slice changes (from either viewport) */
  onSliceChange?: (currentSlice: number, totalSlices: number) => void;
  /** Callback when VOI changes (from either viewport) */
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

const RENDERING_ENGINE_ID = 'fgatir-dual-rendering-engine';
const LEFT_VIEWPORT_ID = 'fgatir-left-viewport';
const RIGHT_VIEWPORT_ID = 'fgatir-right-viewport';
const SLICE_SYNC_ID = 'fgatir-slice-sync';
const VOI_SYNC_ID = 'fgatir-voi-sync';
const DUAL_TOOL_GROUP_ID = 'fgatir-dual-tool-group';

let toolsRegisteredForDual = false;

function registerDualTools(): void {
  if (toolsRegisteredForDual) return;
  try {
    addTool(WindowLevelTool);
  } catch { /* already registered */ }
  try {
    addTool(PanTool);
  } catch { /* already registered */ }
  try {
    addTool(ZoomTool);
  } catch { /* already registered */ }
  try {
    addTool(StackScrollTool);
  } catch { /* already registered */ }
  toolsRegisteredForDual = true;
}

export function DualDicomViewport({
  leftImageIds,
  rightImageIds,
  initialWindowCenter,
  initialWindowWidth,
  onSliceChange,
  onVoiChange,
}: DualDicomViewportProps) {
  const leftElementRef = useRef<HTMLDivElement>(null);
  const rightElementRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const leftViewportRef = useRef<Types.IStackViewport | null>(null);
  const rightViewportRef = useRef<Types.IStackViewport | null>(null);

  const isEmpty = leftImageIds.length === 0 && rightImageIds.length === 0;
  const initialStatus = isEmpty ? 'empty' : 'loading';

  const [state, setState] = useState<ViewportState>({
    status: initialStatus,
    currentSlice: 1,
    totalSlices: 0,
    windowCenter: initialWindowCenter ?? 0,
    windowWidth: initialWindowWidth ?? 0,
  });

  // Initialize both viewports
  useEffect(() => {
    if (leftImageIds.length === 0 || rightImageIds.length === 0) return;
    if (!leftElementRef.current || !rightElementRef.current) return;

    let destroyed = false;
    const leftElement = leftElementRef.current;
    const rightElement = rightElementRef.current;

    async function setup() {
      try {
        // Initialize tools (idempotent)
        initTools();
        registerDualTools();

        // Create rendering engine (shared between both viewports)
        let renderingEngine = renderingEngineRef.current;
        if (renderingEngine) {
          renderingEngine.destroy();
        }
        renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
        renderingEngineRef.current = renderingEngine;

        if (destroyed) return;

        // Enable both viewports via setViewports (batch approach)
        const viewportInputs: Types.PublicViewportInput[] = [
          {
            viewportId: LEFT_VIEWPORT_ID,
            type: Enums.ViewportType.STACK,
            element: leftElement,
            defaultOptions: {
              background: [0, 0, 0] as Types.Point3,
            },
          },
          {
            viewportId: RIGHT_VIEWPORT_ID,
            type: Enums.ViewportType.STACK,
            element: rightElement,
            defaultOptions: {
              background: [0, 0, 0] as Types.Point3,
            },
          },
        ];

        renderingEngine.setViewports(viewportInputs);

        if (destroyed) return;

        // Get viewport references
        const leftViewport = renderingEngine.getViewport(
          LEFT_VIEWPORT_ID,
        ) as Types.IStackViewport;
        const rightViewport = renderingEngine.getViewport(
          RIGHT_VIEWPORT_ID,
        ) as Types.IStackViewport;
        leftViewportRef.current = leftViewport;
        rightViewportRef.current = rightViewport;

        // Create tool group for both viewports
        const existingGroup = ToolGroupManager.getToolGroup(DUAL_TOOL_GROUP_ID);
        if (existingGroup) {
          ToolGroupManager.destroyToolGroup(DUAL_TOOL_GROUP_ID);
        }

        const toolGroup = ToolGroupManager.createToolGroup(DUAL_TOOL_GROUP_ID)!;
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

        // Associate both viewports with the tool group
        toolGroup.addViewport(LEFT_VIEWPORT_ID, RENDERING_ENGINE_ID);
        toolGroup.addViewport(RIGHT_VIEWPORT_ID, RENDERING_ENGINE_ID);

        // Set the stacks sequentially - each setStack resolves when metadata is ready
        await leftViewport.setStack(leftImageIds, 0);

        if (destroyed) return;

        await rightViewport.setStack(rightImageIds, 0);

        if (destroyed) return;

        // Set initial window/level if provided
        if (initialWindowCenter !== undefined && initialWindowWidth !== undefined) {
          const voiRange = {
            lower: initialWindowCenter - initialWindowWidth / 2,
            upper: initialWindowCenter + initialWindowWidth / 2,
          };
          leftViewport.setProperties({ voiRange });
          rightViewport.setProperties({ voiRange });
        }

        // Force render on both viewports individually then together
        leftViewport.render();
        rightViewport.render();
        renderingEngine.render();

        // Set up synchronizers for linked scrolling and W/L
        // Clean up existing synchronizers
        const existingSliceSync = SynchronizerManager.getSynchronizer(SLICE_SYNC_ID);
        if (existingSliceSync) {
          SynchronizerManager.destroySynchronizer(SLICE_SYNC_ID);
        }
        const existingVoiSync = SynchronizerManager.getSynchronizer(VOI_SYNC_ID);
        if (existingVoiSync) {
          SynchronizerManager.destroySynchronizer(VOI_SYNC_ID);
        }

        // Create image slice synchronizer (linked scrolling)
        const sliceSync = syncModule.createImageSliceSynchronizer(SLICE_SYNC_ID);
        sliceSync.add({
          renderingEngineId: RENDERING_ENGINE_ID,
          viewportId: LEFT_VIEWPORT_ID,
        });
        sliceSync.add({
          renderingEngineId: RENDERING_ENGINE_ID,
          viewportId: RIGHT_VIEWPORT_ID,
        });

        // Create VOI synchronizer (linked window/level)
        const voiSync = syncModule.createVOISynchronizer(VOI_SYNC_ID, {
          syncInvertState: true,
          syncColormap: true,
        });
        voiSync.add({
          renderingEngineId: RENDERING_ENGINE_ID,
          viewportId: LEFT_VIEWPORT_ID,
        });
        voiSync.add({
          renderingEngineId: RENDERING_ENGINE_ID,
          viewportId: RIGHT_VIEWPORT_ID,
        });

        setState({
          status: 'ready',
          currentSlice: 1,
          totalSlices: leftImageIds.length,
          windowCenter: initialWindowCenter ?? 0,
          windowWidth: initialWindowWidth ?? 0,
        });
      } catch (error) {
        if (destroyed) return;
        const message = error instanceof Error ? error.message : String(error);
        console.error('[DualDicomViewport] Setup failed:', message);
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: message,
        }));
      }
    }

    setup();

    // Event listeners for VOI and slice changes (listen on left element as source of truth)
    const handleVoiModified = () => {
      if (destroyed || !leftViewportRef.current) return;
      const properties = leftViewportRef.current.getProperties();
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
      if (destroyed || !leftViewportRef.current) return;
      const currentIndex = leftViewportRef.current.getCurrentImageIdIndex();
      const newSlice = currentIndex + 1;
      setState((prev) => ({
        ...prev,
        currentSlice: newSlice,
      }));
      onSliceChange?.(newSlice, leftImageIds.length);
    };

    // Listen on both elements for VOI changes
    leftElement.addEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified);
    rightElement.addEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified);
    leftElement.addEventListener(Enums.Events.STACK_VIEWPORT_SCROLL, handleStackScroll);
    rightElement.addEventListener(Enums.Events.STACK_VIEWPORT_SCROLL, handleStackScroll);

    return () => {
      destroyed = true;

      leftElement.removeEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified);
      rightElement.removeEventListener(Enums.Events.VOI_MODIFIED, handleVoiModified);
      leftElement.removeEventListener(Enums.Events.STACK_VIEWPORT_SCROLL, handleStackScroll);
      rightElement.removeEventListener(Enums.Events.STACK_VIEWPORT_SCROLL, handleStackScroll);

      // Cleanup synchronizers
      const sliceSync = SynchronizerManager.getSynchronizer(SLICE_SYNC_ID);
      if (sliceSync) SynchronizerManager.destroySynchronizer(SLICE_SYNC_ID);
      const voiSync = SynchronizerManager.getSynchronizer(VOI_SYNC_ID);
      if (voiSync) SynchronizerManager.destroySynchronizer(VOI_SYNC_ID);

      // Cleanup tool group
      const tg = ToolGroupManager.getToolGroup(DUAL_TOOL_GROUP_ID);
      if (tg) ToolGroupManager.destroyToolGroup(DUAL_TOOL_GROUP_ID);

      // Cleanup rendering engine
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }
      leftViewportRef.current = null;
      rightViewportRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftImageIds, rightImageIds]);

  // Prevent browser context menu on viewports
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="dual-dicom-viewport-container" style={containerStyle}>
      {/* Left viewport */}
      <div style={viewportWrapperStyle}>
        <div
          ref={leftElementRef}
          className="dicom-viewport dicom-viewport-left"
          onContextMenu={handleContextMenu}
          style={viewportElementStyle}
        />
        {/* Label overlay - Image A */}
        {state.status === 'ready' && (
          <div style={labelOverlayStyle}>Image A</div>
        )}
        {/* Slice info overlay - top left */}
        {state.status === 'ready' && (
          <div style={sliceInfoStyle}>
            Slice: {state.currentSlice} / {state.totalSlices}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={dividerStyle} />

      {/* Right viewport */}
      <div style={viewportWrapperStyle}>
        <div
          ref={rightElementRef}
          className="dicom-viewport dicom-viewport-right"
          onContextMenu={handleContextMenu}
          style={viewportElementStyle}
        />
        {/* Label overlay - Image B */}
        {state.status === 'ready' && (
          <div style={labelOverlayStyle}>Image B</div>
        )}
        {/* W/L info overlay - bottom right */}
        {state.status === 'ready' && (
          <div style={wlInfoStyle}>
            WW: {state.windowWidth} WC: {state.windowCenter}
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {state.status === 'loading' && (
        <div className="viewport-overlay viewport-loading" style={overlayStyle}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div className="spinner" style={spinnerStyle} />
            <p>Loading DICOM series...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
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
    </div>
  );
}

// --- Styles ---

const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'row',
};

const viewportWrapperStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
};

const viewportElementStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  backgroundColor: '#000',
};

const dividerStyle: React.CSSProperties = {
  width: 2,
  backgroundColor: '#333',
  flexShrink: 0,
};

const labelOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  pointerEvents: 'none',
  textShadow: '1px 1px 3px rgba(0,0,0,0.9)',
  backgroundColor: 'rgba(0,0,0,0.5)',
  padding: '2px 10px',
  borderRadius: 4,
};

const sliceInfoStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 8,
  color: '#fff',
  fontSize: '12px',
  fontFamily: 'monospace',
  pointerEvents: 'none',
  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
};

const wlInfoStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 8,
  right: 8,
  color: '#fff',
  fontSize: '12px',
  fontFamily: 'monospace',
  pointerEvents: 'none',
  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
};

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

export default DualDicomViewport;
