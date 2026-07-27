/**
 * Report Export Utilities
 *
 * Functions to build, download, and email study completion reports.
 * Supports JSON export, CSV export, and mailto: link generation.
 */

import type { RatingSubmission } from '@/types';
import { RATING_QUESTIONS } from '@/config/ratingQuestions';

/** Structured report object */
export interface StudyReport {
  meta: {
    raterId: string;
    exportedAt: string;
    totalSubmissions: number;
    questionIds: string[];
  };
  submissions: RatingSubmission[];
}

/**
 * Build a structured report from all submissions.
 */
export function buildReport(raterId: string, submissions: RatingSubmission[]): StudyReport {
  return {
    meta: {
      raterId,
      exportedAt: new Date().toISOString(),
      totalSubmissions: submissions.length,
      questionIds: RATING_QUESTIONS.map((q) => q.id),
    },
    submissions,
  };
}

/**
 * Convert submissions to CSV string.
 * One row per submission; boolean values as 1/0, Likert as integers.
 */
export function buildCSV(submissions: RatingSubmission[]): string {
  const questionIds = RATING_QUESTIONS.map((q) => q.id);

  // Header
  const headers = [
    'raterId',
    'assignmentId',
    'seriesId',
    ...questionIds,
    'durationMs',
    'submissionTime',
    'windowCenter',
    'windowWidth',
    'currentSlice',
  ];

  const rows: string[] = [headers.join(',')];

  for (const sub of submissions) {
    const responseMap = new Map(sub.responses.map((r) => [r.questionId, r.value]));

    const values: string[] = [
      csvEscape(sub.raterId),
      csvEscape(sub.assignmentId),
      csvEscape(sub.seriesId),
      ...questionIds.map((qId) => {
        const val = responseMap.get(qId);
        if (val === null || val === undefined) return '';
        if (typeof val === 'boolean') return val ? '1' : '0';
        if (typeof val === 'number') return String(val);
        return csvEscape(String(val));
      }),
      String(sub.durationMs),
      sub.submissionTime,
      String(sub.viewerState.windowCenter),
      String(sub.viewerState.windowWidth),
      String(sub.viewerState.currentSlice),
    ];

    rows.push(values.join(','));
  }

  return rows.join('\n');
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download the report as JSON.
 */
export function downloadJSON(report: StudyReport): void {
  const json = JSON.stringify(report, null, 2);
  const filename = `fgatir_report_${report.meta.raterId}_${formatDate()}.json`;
  downloadFile(json, filename, 'application/json');
}

/**
 * Download the report as CSV.
 */
export function downloadCSV(submissions: RatingSubmission[], raterId: string): void {
  const csv = buildCSV(submissions);
  const filename = `fgatir_report_${raterId}_${formatDate()}.csv`;
  downloadFile(csv, filename, 'text/csv');
}

/**
 * Open a mailto: link with a summary in the body.
 * Also triggers a JSON download so the user can attach the file.
 */
export function openMailto(
  recipientEmail: string,
  report: StudyReport,
): void {
  // Trigger download first so user has file to attach
  downloadJSON(report);

  const subject = encodeURIComponent(
    `FGATIR Rating Report — ${report.meta.raterId} — ${formatDate()}`,
  );

  const body = encodeURIComponent(
    [
      `FGATIR Rating Study Report`,
      ``,
      `Rater: ${report.meta.raterId}`,
      `Submissions: ${report.meta.totalSubmissions}`,
      `Exported: ${report.meta.exportedAt}`,
      ``,
      `Please find the full report in the attached JSON file.`,
      `(The file was automatically downloaded to your Downloads folder.)`,
    ].join('\n'),
  );

  window.open(`mailto:${recipientEmail}?subject=${subject}&body=${body}`, '_self');
}

// --- Helpers ---

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}
