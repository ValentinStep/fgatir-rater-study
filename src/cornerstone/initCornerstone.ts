/**
 * initCornerstone.ts
 *
 * Initializes @cornerstonejs/core and @cornerstonejs/dicom-image-loader.
 * Exports a singleton initialization promise that ensures init is called only once.
 */

import * as cornerstone from '@cornerstonejs/core';
import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader';

let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

/**
 * Initialize Cornerstone3D and the DICOM image loader.
 * Returns a singleton promise - safe to call multiple times.
 */
export function initCornerstone(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = doInit();
  return initPromise;
}

async function doInit(): Promise<void> {
  try {
    // Initialize cornerstone core
    cornerstone.init();

    // Initialize the DICOM image loader
    // In Cornerstone v5, the image loader is initialized via its init() function
    dicomImageLoaderInit({
      maxWebWorkers: navigator.hardwareConcurrency || 4,
    });

    console.log('[Cornerstone] Initialization complete');
  } catch (error) {
    initError =
      error instanceof Error ? error : new Error(String(error));
    console.error('[Cornerstone] Initialization failed:', initError.message);
    throw initError;
  }
}

/**
 * Check if Cornerstone has been initialized.
 */
export function isCornerstoneReady(): boolean {
  return cornerstone.isCornerstoneInitialized();
}

/**
 * Get the initialization error if one occurred.
 */
export function getInitError(): Error | null {
  return initError;
}

/**
 * Reset initialization state (useful for testing).
 */
export function resetInit(): void {
  initPromise = null;
  initError = null;
  cornerstone.resetInitialization();
}
