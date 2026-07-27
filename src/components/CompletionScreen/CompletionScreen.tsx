/**
 * CompletionScreen Component
 *
 * Shown when the rater finishes all assignments.
 * Provides download (JSON/CSV) and email (mailto:) report options.
 */

import { useCallback, useState } from 'react';
import type { RatingSubmission } from '@/types';
import {
  buildReport,
  downloadJSON,
  downloadCSV,
  openMailto,
} from '@/utils/reportExport';

export interface CompletionScreenProps {
  raterId: string;
  submissions: RatingSubmission[];
  totalItems: number;
  studyDisplayName: string;
  isSideBySide: boolean;
}

export function CompletionScreen({
  raterId,
  submissions,
  totalItems,
  studyDisplayName,
  isSideBySide,
}: CompletionScreenProps) {
  const [downloadedJSON, setDownloadedJSON] = useState(false);
  const [downloadedCSV, setDownloadedCSV] = useState(false);
  const [emailedTS, setEmailedTS] = useState(false);
  const [emailedVS, setEmailedVS] = useState(false);

  const emailTS = import.meta.env.VITE_EMAIL_TS || '';
  const emailVS = import.meta.env.VITE_EMAIL_VS || '';

  const handleDownloadJSON = useCallback(() => {
    const report = buildReport(raterId, submissions);
    downloadJSON(report);
    setDownloadedJSON(true);
  }, [raterId, submissions]);

  const handleDownloadCSV = useCallback(() => {
    downloadCSV(submissions, raterId);
    setDownloadedCSV(true);
  }, [raterId, submissions]);

  const handleEmailTS = useCallback(() => {
    if (!emailTS) return;
    const report = buildReport(raterId, submissions);
    openMailto(emailTS, report);
    setEmailedTS(true);
  }, [raterId, submissions, emailTS]);

  const handleEmailVS = useCallback(() => {
    if (!emailVS) return;
    const report = buildReport(raterId, submissions);
    openMailto(emailVS, report);
    setEmailedVS(true);
  }, [raterId, submissions, emailVS]);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>{studyDisplayName}</h1>
        <p style={completeTextStyle}>✓ Study Complete</p>
        <p style={detailStyle}>
          You have rated all {totalItems} {isSideBySide ? 'comparisons' : 'image sets'}.
          Thank you for your participation.
        </p>

        {/* Download Section */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Download Report</h3>
          <div style={buttonGroupStyle}>
            <button
              type="button"
              onClick={handleDownloadJSON}
              style={buttonStyle}
            >
              📥 {downloadedJSON ? 'Downloaded ✓' : 'Download JSON'}
            </button>
            <button
              type="button"
              onClick={handleDownloadCSV}
              style={buttonStyle}
            >
              📥 {downloadedCSV ? 'Downloaded ✓' : 'Download CSV'}
            </button>
          </div>
        </div>

        {/* Email Section */}
        {(emailTS || emailVS) && (
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Email Report</h3>
            <p style={emailHintStyle}>
              Downloads the JSON file, then opens your email client with a pre-filled message.
              Attach the downloaded file before sending.
            </p>
            <div style={buttonGroupStyle}>
              {emailTS && (
                <button
                  type="button"
                  onClick={handleEmailTS}
                  style={emailButtonStyle}
                >
                  📧 {emailedTS ? 'Opened ✓' : 'Email to TS'}
                </button>
              )}
              {emailVS && (
                <button
                  type="button"
                  onClick={handleEmailVS}
                  style={emailButtonStyle}
                >
                  📧 {emailedVS ? 'Opened ✓' : 'Email to VS'}
                </button>
              )}
            </div>
          </div>
        )}

        {!emailTS && !emailVS && (
          <p style={noEmailHintStyle}>
            Email recipients not configured. Set VITE_EMAIL_TS and VITE_EMAIL_VS in .env to enable.
          </p>
        )}
      </div>
    </div>
  );
}

// --- Styles ---

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0d0d1a',
};

const cardStyle: React.CSSProperties = {
  maxWidth: 480,
  width: '90%',
  padding: '32px 40px',
  backgroundColor: '#1a1a2e',
  borderRadius: 12,
  border: '1px solid #2a2a4a',
  textAlign: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#e0e0e0',
  marginBottom: 8,
};

const completeTextStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: '#4caf50',
  margin: '16px 0 8px',
};

const detailStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#aaa',
  marginBottom: 24,
  lineHeight: 1.5,
};

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
  paddingTop: 20,
  borderTop: '1px solid #2a2a4a',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#e0e0e0',
  marginBottom: 12,
};

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'center',
  flexWrap: 'wrap',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 500,
  color: '#e0e0e0',
  backgroundColor: '#2a2a4a',
  border: '1px solid #3a3a5a',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'background-color 0.15s',
};

const emailButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#1a3a5a',
  borderColor: '#2a5a8a',
};

const emailHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#888',
  marginBottom: 12,
  lineHeight: 1.4,
};

const noEmailHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#666',
  marginTop: 24,
  fontStyle: 'italic',
};
