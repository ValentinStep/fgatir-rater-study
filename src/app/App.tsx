/**
 * Main application component.
 * Integrates the DICOM viewer with rating workflow.
 * Manages series navigation, session state, and unsaved changes warnings.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { initCornerstone } from '@/cornerstone/initCornerstone';
import { DicomViewport } from '@/components/DicomViewport/DicomViewport';
import { ViewerToolbar } from '@/components/ViewerToolbar/ViewerToolbar';
import { DiagnosticPanel } from '@/components/DiagnosticPanel/DiagnosticPanel';
import { ProgressHeader } from '@/components/ProgressHeader/ProgressHeader';
import { RatingForm } from '@/components/RatingForm/RatingForm';
import { getImageSource } from '@/services/imageSource';
import { getRatingService } from '@/services/ratingService';
import { SessionService, buildAssignments } from '@/services/sessionService';
import { STUDY_CONFIG } from '@/config/studyConfig';
import type {
  RatingResponse,
  RatingSubmission,
  SessionState,
  Assignment,
  ViewerStateSnapshot,
} from '@/types';
import type { StudyManifest } from '@/services/imageSource';

type AppView = 'loading' | 'viewer' | 'error' | 'complete';

const RENDERING_ENGINE_ID = 'fgatir-rendering-engine';
const VIEWPORT_ID = 'fgatir-stack-viewport';

function App() {
  const [view, setView] = useState<AppView>('loading');
  const [loadingStatus, setLoadingStatus] = useState('Starting...');
  const [error, setError] = useState<string | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [manifest, setManifest] = useState<StudyManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [currentSeriesId, setCurrentSeriesId] = useState<string | null>(null);
  const [windowCenter, setWindowCenter] = useState(21);
  const [windowWidth, setWindowWidth] = useState(54);
  const [currentSlice, setCurrentSlice] = useState(1);
  const [totalSlices, setTotalSlices] = useState(0);

  // Rating workflow state
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [inProgressResponses, setInProgressResponses] = useState<RatingResponse[]>([]);
  const [viewportKey, setViewportKey] = useState(0);

  // Refs for duration tracking
  const itemOpenTimeRef = useRef<string | null>(null);
  const sessionServiceRef = useRef<SessionService | null>(null);

  // Initialize Cornerstone, load manifest, and set up session
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        // Initialize Cornerstone
        setLoadingStatus('Initializing DICOM engine...');
        await initCornerstone();

        if (cancelled) return;

        // Load manifest
        setLoadingStatus('Loading study manifest...');
        const source = getImageSource();
        const loadedManifest = await source.getManifest();

        if (cancelled) return;
        setManifest(loadedManifest);

        // Build assignments
        const raterId = STUDY_CONFIG.devRaterId;
        const builtAssignments = buildAssignments(loadedManifest, raterId);
        setAssignments(builtAssignments);

        if (builtAssignments.length === 0) {
          setError('No series found in manifest');
          setView('error');
          return;
        }

        // Set up session service and restore/init session
        setLoadingStatus('Setting up session...');
        const sessionSvc = new SessionService(raterId, builtAssignments);
        sessionServiceRef.current = sessionSvc;

        const session = await sessionSvc.restoreOrInitSession();

        if (cancelled) return;
        setSessionState(session);

        // Check if study is already complete
        if (sessionSvc.isStudyComplete(session)) {
          setView('complete');
          return;
        }

        // Load the current assignment's series
        const assignment = sessionSvc.getCurrentAssignment(session);
        if (!assignment) {
          setView('complete');
          return;
        }

        setCurrentAssignment(assignment);
        setInProgressResponses(session.inProgressResponses);

        // Load image IDs for the series
        setLoadingStatus('Loading DICOM images...');
        const ids = await source.getSeriesImageIds(assignment.seriesId);

        if (cancelled) return;

        // Find the series metadata for window settings
        const seriesMeta = findSeriesMeta(loadedManifest, assignment.seriesId);

        setCurrentSeriesId(assignment.seriesId);
        setImageIds(ids);
        setTotalSlices(ids.length);
        setWindowCenter(seriesMeta?.windowCenter ?? 21);
        setWindowWidth(seriesMeta?.windowWidth ?? 54);
        setView('viewer');

        // Record item-open time
        const openTime = new Date().toISOString();
        itemOpenTimeRef.current = openTime;

        const updatedSession = await sessionSvc.recordItemOpen(session);
        setSessionState(updatedSession);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('[App] Initialization failed:', message);
        setError(message);
        setManifestError(message);
        setView('error');
      }
    }

    initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  // Unsaved changes warning (beforeunload)
  useEffect(() => {
    if (!STUDY_CONFIG.features.unsavedChangesWarning) return;

    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const handleSliceChange = useCallback(
    (slice: number, total: number) => {
      setCurrentSlice(slice);
      setTotalSlices(total);
    },
    [],
  );

  const handleVoiChange = useCallback(
    (wc: number, ww: number) => {
      setWindowCenter(wc);
      setWindowWidth(ww);
    },
    [],
  );

  // Auto-save in-progress responses
  const handleResponsesChange = useCallback(
    (responses: RatingResponse[]) => {
      setInProgressResponses(responses);
      setHasUnsavedChanges(responses.length > 0);

      if (STUDY_CONFIG.features.autoSaveInProgress && sessionServiceRef.current && sessionState) {
        sessionServiceRef.current.saveInProgress(sessionState, responses).then((updated) => {
          setSessionState(updated);
        });
      }
    },
    [sessionState],
  );

  // Handle rating submission
  const handleSubmit = useCallback(
    async (responses: RatingResponse[]) => {
      if (!currentAssignment || !sessionState || !sessionServiceRef.current) return;

      setIsSaving(true);

      try {
        const ratingService = getRatingService();

        // Build submission
        const viewerState: ViewerStateSnapshot = {
          currentSlice,
          totalSlices,
          windowCenter,
          windowWidth,
          zoom: 1, // Default zoom for now
        };

        const now = new Date().toISOString();
        const openTime = itemOpenTimeRef.current ?? now;
        const durationMs = new Date(now).getTime() - new Date(openTime).getTime();

        const submission: RatingSubmission = {
          id: `${currentAssignment.id}_${Date.now()}`,
          raterId: STUDY_CONFIG.devRaterId,
          assignmentId: currentAssignment.id,
          seriesId: currentAssignment.seriesId,
          responses,
          viewerState,
          itemOpenTime: openTime,
          submissionTime: now,
          durationMs,
        };

        // Save rating
        await ratingService.saveRating(submission);

        // Advance session
        const updatedSession = await sessionServiceRef.current.advanceToNext(
          sessionState,
          currentAssignment.id,
        );
        setSessionState(updatedSession);
        setHasUnsavedChanges(false);
        setInProgressResponses([]);

        // Show success feedback
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1500);

        // Check if study is now complete
        if (sessionServiceRef.current.isStudyComplete(updatedSession)) {
          setView('complete');
          setIsSaving(false);
          return;
        }

        // Load next assignment
        const nextAssignment = sessionServiceRef.current.getCurrentAssignment(updatedSession);
        if (!nextAssignment) {
          setView('complete');
          setIsSaving(false);
          return;
        }

        // Reset viewport state for next item
        setCurrentAssignment(nextAssignment);
        setViewportKey((k) => k + 1);

        const source = getImageSource();
        const ids = await source.getSeriesImageIds(nextAssignment.seriesId);
        const seriesMeta = manifest ? findSeriesMeta(manifest, nextAssignment.seriesId) : null;

        setCurrentSeriesId(nextAssignment.seriesId);
        setImageIds(ids);
        setTotalSlices(ids.length);
        setCurrentSlice(1);
        setWindowCenter(seriesMeta?.windowCenter ?? 21);
        setWindowWidth(seriesMeta?.windowWidth ?? 54);

        // Record new item-open time
        const newOpenTime = new Date().toISOString();
        itemOpenTimeRef.current = newOpenTime;
        await sessionServiceRef.current.recordItemOpen(updatedSession);
      } catch (err) {
        console.error('[App] Save failed:', err);
        // Preserve unsaved answers on failure
        setInProgressResponses(responses);
        setHasUnsavedChanges(true);
      } finally {
        setIsSaving(false);
      }
    },
    [currentAssignment, sessionState, currentSlice, totalSlices, windowCenter, windowWidth, manifest],
  );

  return (
    <div className="app" style={appStyle}>
      {/* Loading state */}
      {view === 'loading' && (
        <div style={centeredStyle}>
          <div style={loadingContainerStyle}>
            <h1 style={titleStyle}>FGATIR Rater Study</h1>
            <p style={subtitleStyle}>Initializing DICOM viewer...</p>
            <p style={statusTextStyle}>{loadingStatus}</p>
            <div style={spinnerContainerStyle}>
              <div style={spinnerStyle} />
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {view === 'error' && (
        <div style={centeredStyle}>
          <div style={errorContainerStyle}>
            <h1 style={titleStyle}>FGATIR Rater Study</h1>
            <p style={errorTextStyle}>⚠ Initialization Error</p>
            <p style={errorDetailStyle}>{error}</p>
            <p style={hintStyle}>
              Make sure you have run <code>npm run ingest-cases</code> to generate
              the local DICOM data, and that the dev server is running.
            </p>
          </div>
        </div>
      )}

      {/* Complete state */}
      {view === 'complete' && (
        <div style={centeredStyle}>
          <div style={completeContainerStyle}>
            <h1 style={titleStyle}>{STUDY_CONFIG.displayName}</h1>
            <p style={completeTextStyle}>✓ Study Complete</p>
            <p style={completeDetailStyle}>
              You have rated all {assignments.length} image sets.
              Thank you for your participation.
            </p>
          </div>
        </div>
      )}

      {/* Viewer state */}
      {view === 'viewer' && (
        <div style={mainLayoutStyle}>
          <ProgressHeader
            studyTitle={STUDY_CONFIG.displayName}
            currentItem={
              sessionState
                ? sessionState.currentAssignmentIndex + 1
                : 1
            }
            totalItems={assignments.length}
            hasUnsavedChanges={hasUnsavedChanges}
            isComplete={false}
          />
          <ViewerToolbar
            currentSlice={currentSlice}
            totalSlices={totalSlices}
            windowCenter={windowCenter}
            windowWidth={windowWidth}
            renderingEngineId={RENDERING_ENGINE_ID}
            viewportId={VIEWPORT_ID}
            initialWindowCenter={windowCenter}
            initialWindowWidth={windowWidth}
          />
          <div style={contentAreaStyle}>
            <div style={viewportContainerStyle}>
              <DicomViewport
                key={viewportKey}
                imageIds={imageIds}
                initialWindowCenter={windowCenter}
                initialWindowWidth={windowWidth}
                onSliceChange={handleSliceChange}
                onVoiChange={handleVoiChange}
              />
            </div>
            <RatingForm
              displayLabel={currentAssignment?.displayLabel ?? 'Image set'}
              onSubmit={handleSubmit}
              isSaving={isSaving}
              initialResponses={inProgressResponses}
              onResponsesChange={handleResponsesChange}
              showSuccess={showSuccess}
            />
          </div>
        </div>
      )}

      {/* Diagnostic panel (dev only, toggle with Ctrl+Shift+D) */}
      <DiagnosticPanel
        manifest={manifest}
        manifestError={manifestError}
        currentSeriesId={currentSeriesId}
        currentSlice={currentSlice}
        totalSlices={totalSlices}
        windowCenter={windowCenter}
        windowWidth={windowWidth}
      />
    </div>
  );
}

// --- Helpers ---

function findSeriesMeta(manifest: StudyManifest, seriesId: string) {
  for (const caseEntry of manifest.cases) {
    const found = caseEntry.series.find((s) => s.seriesId === seriesId);
    if (found) return found;
  }
  return null;
}

// --- Styles ---

const appStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  backgroundColor: '#0d0d1a',
  color: '#e0e0e0',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const centeredStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
};

const loadingContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 40,
};

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 600,
  marginBottom: 8,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#888',
  marginBottom: 8,
};

const statusTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6c63ff',
  marginBottom: 20,
  minHeight: 16,
};

const spinnerContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid rgba(255,255,255,0.2)',
  borderTop: '3px solid #6c63ff',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const errorContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 40,
  maxWidth: 500,
};

const errorTextStyle: React.CSSProperties = {
  fontSize: 18,
  color: '#ff6b6b',
  marginBottom: 8,
};

const errorDetailStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#ccc',
  fontFamily: 'monospace',
  padding: '8px 12px',
  backgroundColor: 'rgba(255,0,0,0.1)',
  borderRadius: 4,
  marginBottom: 16,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#888',
};

const completeContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 40,
};

const completeTextStyle: React.CSSProperties = {
  fontSize: 20,
  color: '#4caf50',
  fontWeight: 600,
  marginBottom: 12,
};

const completeDetailStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#ccc',
};

const mainLayoutStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
};

const contentAreaStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const viewportContainerStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
};

export default App;
