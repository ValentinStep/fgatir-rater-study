import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock cornerstone modules before importing App
vi.mock('@cornerstonejs/core', () => ({
  init: vi.fn(),
  isCornerstoneInitialized: vi.fn(() => false),
  resetInitialization: vi.fn(),
  getRenderBackend: vi.fn(() => 'webgl'),
  getRenderingEngine: vi.fn(() => null),
  RenderingEngine: vi.fn(() => ({
    enableElement: vi.fn(),
    getViewport: vi.fn(() => ({
      setStack: vi.fn().mockResolvedValue(undefined),
      setProperties: vi.fn(),
      render: vi.fn(),
      resetCamera: vi.fn(),
      getCamera: vi.fn(() => ({})),
      getCurrentImageIdIndex: vi.fn(() => 0),
      getProperties: vi.fn(() => ({})),
      setImageIdIndex: vi.fn(),
    })),
    destroy: vi.fn(),
  })),
  Enums: {
    ViewportType: { STACK: 'stack' },
    Events: {
      VOI_MODIFIED: 'CORNERSTONE_VOI_MODIFIED',
      STACK_VIEWPORT_SCROLL: 'CORNERSTONE_STACK_VIEWPORT_SCROLL',
    },
  },
}));

vi.mock('@cornerstonejs/dicom-image-loader', () => ({
  default: vi.fn(),
}));

vi.mock('@cornerstonejs/tools', () => ({
  init: vi.fn(),
  addTool: vi.fn(),
  WindowLevelTool: { toolName: 'WindowLevel' },
  PanTool: { toolName: 'Pan' },
  ZoomTool: { toolName: 'Zoom' },
  StackScrollTool: { toolName: 'StackScroll' },
  ToolGroupManager: {
    createToolGroup: vi.fn(() => ({
      addTool: vi.fn(),
      setToolActive: vi.fn(),
      addViewport: vi.fn(),
    })),
    getToolGroup: vi.fn(() => null),
    destroyToolGroup: vi.fn(),
  },
  Enums: {
    MouseBindings: {
      Primary: 1,
      Secondary: 2,
      Auxiliary: 4,
      Wheel: 524288,
    },
  },
}));

vi.mock('@/services/imageSource', () => ({
  getImageSource: vi.fn(() => ({
    getManifest: vi.fn().mockRejectedValue(new Error('No manifest in test')),
    getSeriesImageIds: vi.fn().mockResolvedValue([]),
  })),
  LocalImageSource: vi.fn(),
}));

vi.mock('@/cornerstone/initCornerstone', () => ({
  initCornerstone: vi.fn().mockResolvedValue(undefined),
  isCornerstoneReady: vi.fn(() => false),
  getInitError: vi.fn(() => null),
  resetInit: vi.fn(),
}));

import App from '../app/App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<App />);
    expect(
      screen.getByText('Initializing DICOM viewer...'),
    ).toBeInTheDocument();
  });

  it('renders the application title in loading state', () => {
    render(<App />);
    expect(screen.getByText('FGATIR Rater Study')).toBeInTheDocument();
  });
});
