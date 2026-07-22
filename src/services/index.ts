/**
 * Services Layer - Factory & Exports
 *
 * Auto-detects whether Supabase is configured and returns the appropriate
 * service implementations. Falls back to local (localStorage) mode when
 * Supabase environment variables are not set.
 */

import { isSupabaseConfigured } from './supabaseClient';
import { LocalImageSource, type ImageSource } from './imageSource';
import { LocalRatingService, type IRatingService } from './ratingService';
import { SupabaseImageSource } from './supabaseImageSource';
import { SupabaseRatingService } from './supabaseRatingService';

// --- Re-exports ---

export {
  LocalImageSource,
  type ImageSource,
  type StudyManifest,
  type CaseEntry,
  type SeriesEntry,
} from './imageSource';

export {
  LocalRatingService,
  type IRatingService,
} from './ratingService';

export {
  SessionService,
  buildAssignments,
} from './sessionService';

export { SupabaseImageSource } from './supabaseImageSource';
export { SupabaseRatingService } from './supabaseRatingService';
export { isSupabaseConfigured, getSupabaseClient } from './supabaseClient';
export type { Database } from './supabaseTypes';

// --- Service Factory ---

/** Cached service instances */
let _imageSource: ImageSource | null = null;
let _ratingService: IRatingService | null = null;

/**
 * Get the appropriate ImageSource implementation.
 * Returns SupabaseImageSource when Supabase is configured,
 * otherwise returns LocalImageSource for local development.
 *
 * @param studyId - Required when using Supabase mode (ignored in local mode)
 */
export function getImageSource(studyId?: string): ImageSource {
  if (_imageSource) {
    return _imageSource;
  }

  if (isSupabaseConfigured() && studyId) {
    _imageSource = new SupabaseImageSource(studyId);
  } else {
    _imageSource = new LocalImageSource();
  }

  return _imageSource;
}

/**
 * Get the appropriate IRatingService implementation.
 * Returns SupabaseRatingService when Supabase is configured,
 * otherwise returns LocalRatingService for local development.
 */
export function getRatingService(): IRatingService {
  if (_ratingService) {
    return _ratingService;
  }

  if (isSupabaseConfigured()) {
    _ratingService = new SupabaseRatingService();
  } else {
    _ratingService = new LocalRatingService();
  }

  return _ratingService;
}

/**
 * Reset all cached service instances.
 * Useful for testing or when switching modes.
 * @internal
 */
export function _resetServices(): void {
  _imageSource = null;
  _ratingService = null;
}
