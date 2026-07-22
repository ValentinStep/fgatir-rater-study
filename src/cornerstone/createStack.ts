/**
 * createStack.ts
 *
 * Creates a stack viewport configuration from a list of image IDs.
 * Image IDs should use the wadouri: scheme for individual DICOM files.
 */

import { Enums } from '@cornerstonejs/core';

export interface StackViewportConfig {
  viewportId: string;
  type: typeof Enums.ViewportType.STACK;
  element: HTMLDivElement;
  defaultOptions: {
    background: [number, number, number];
  };
}

/**
 * Create a stack viewport configuration for use with a RenderingEngine.
 */
export function createStackViewportConfig(
  viewportId: string,
  element: HTMLDivElement,
): StackViewportConfig {
  return {
    viewportId,
    type: Enums.ViewportType.STACK,
    element,
    defaultOptions: {
      background: [0, 0, 0] as [number, number, number],
    },
  };
}

/**
 * Build wadouri: image IDs for a series served from the local dev server.
 *
 * @param seriesId - The series directory name
 * @param sliceCount - Number of slices in the series
 * @param basePath - Base URL path (default: '/dicom-data')
 * @returns Array of wadouri: image IDs ordered by slice number
 */
export function buildImageIds(
  seriesId: string,
  sliceCount: number,
  basePath = '/dicom-data',
): string[] {
  const imageIds: string[] = [];
  for (let i = 1; i <= sliceCount; i++) {
    const paddedIndex = String(i).padStart(3, '0');
    imageIds.push(`wadouri:${basePath}/${seriesId}/slice_${paddedIndex}.dcm`);
  }
  return imageIds;
}
