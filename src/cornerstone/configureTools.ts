/**
 * configureTools.ts
 *
 * Registers Cornerstone tools and creates a tool group with mouse bindings:
 * - Left mouse: Window/Level
 * - Right mouse: Pan
 * - Mouse wheel: Stack scroll
 * - Middle mouse: Zoom
 */

import {
  addTool,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  StackScrollTool,
  ToolGroupManager,
  Enums as ToolEnums,
} from '@cornerstonejs/tools';
import type { Types as ToolTypes } from '@cornerstonejs/tools';

export const TOOL_GROUP_ID = 'fgatir-viewer-tool-group';

let toolsRegistered = false;

/**
 * Register all tools with cornerstone tools (called once).
 */
export function registerTools(): void {
  if (toolsRegistered) return;

  addTool(WindowLevelTool);
  addTool(PanTool);
  addTool(ZoomTool);
  addTool(StackScrollTool);

  toolsRegistered = true;
}

/**
 * Create and configure a tool group for the viewer viewport.
 * Returns the tool group instance.
 */
export function createViewerToolGroup(
  viewportId: string,
  renderingEngineId: string,
): ToolTypes.IToolGroup {
  // Destroy existing group if it exists
  const existing = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (existing) {
    ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
  }

  const toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID)!;

  // Add tools to the group
  toolGroup.addTool(WindowLevelTool.toolName);
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);

  // Set tool modes and bindings
  // Left mouse: Window/Level
  toolGroup.setToolActive(WindowLevelTool.toolName, {
    bindings: [
      { mouseButton: ToolEnums.MouseBindings.Primary },
    ],
  });

  // Right mouse: Pan
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [
      { mouseButton: ToolEnums.MouseBindings.Secondary },
    ],
  });

  // Middle mouse: Zoom
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [
      { mouseButton: ToolEnums.MouseBindings.Auxiliary },
    ],
  });

  // Mouse wheel: Stack scroll
  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [
      { mouseButton: ToolEnums.MouseBindings.Wheel },
    ],
  });

  // Associate viewport with tool group
  toolGroup.addViewport(viewportId, renderingEngineId);

  return toolGroup;
}
