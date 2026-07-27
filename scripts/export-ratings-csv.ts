#!/usr/bin/env tsx
/**
 * Export Ratings from Supabase as CSV
 * ====================================
 *
 * Connects to Supabase, fetches all ratings, flattens the JSONB responses
 * into individual columns, and writes a CSV file.
 *
 * Usage:
 *   npx tsx scripts/export-ratings-csv.ts [output_file]
 *
 * Default output: ratings-export-<timestamp>.csv
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually (tsx doesn't auto-load Vite env)
function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        env[key] = value;
      }
    }
  }
  return env;
}

// Known question IDs (matches src/config/ratingQuestions.ts)
const QUESTION_IDS = [
  'viz_mamillothalamic_tract',
  'viz_stn',
  'viz_dentato_rubro_thalamic',
  'viz_red_nuclei',
  'viz_medial_lemniscus',
  'viz_mlf',
  'viz_olives',
  'thalamic_nuclei_delineation',
  'brainstem_structure_clarity',
  'diagnostic_confidence_posterior_fossa',
  'comments',
];

interface RatingRow {
  id: string;
  assignment_id: string;
  rater_id: string;
  series_id: string;
  responses_json: Array<{ questionId: string; value: string | number | boolean | null }>;
  viewer_state_json: unknown;
  started_at: string | null;
  submitted_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Fetching ratings from Supabase...');

  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .order('submitted_at', { ascending: true });

  if (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }

  const ratings = data as RatingRow[];

  if (ratings.length === 0) {
    console.log('No ratings found in database.');
    process.exit(0);
  }

  console.log(`Found ${ratings.length} rating(s). Generating CSV...`);

  // CSV header
  const headers = [
    'id',
    'rater_id',
    'assignment_id',
    'series_id',
    ...QUESTION_IDS,
    'started_at',
    'submitted_at',
    'duration_seconds',
  ];

  const rows: string[] = [headers.join(',')];

  for (const rating of ratings) {
    // Build a map from questionId → value for quick lookup
    const responseMap = new Map<string, unknown>();
    if (Array.isArray(rating.responses_json)) {
      for (const resp of rating.responses_json) {
        responseMap.set(resp.questionId, resp.value);
      }
    }

    const row = [
      csvEscape(rating.id),
      csvEscape(rating.rater_id),
      csvEscape(rating.assignment_id),
      csvEscape(rating.series_id),
      ...QUESTION_IDS.map((qId) => csvEscape(responseMap.get(qId))),
      csvEscape(rating.started_at),
      csvEscape(rating.submitted_at),
      csvEscape(rating.duration_seconds),
    ];

    rows.push(row.join(','));
  }

  // Determine output file
  const outputArg = process.argv[2];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = outputArg || `ratings-export-${timestamp}.csv`;

  fs.writeFileSync(outputFile, rows.join('\n') + '\n', 'utf-8');

  console.log(`\n✓ Exported ${ratings.length} ratings to: ${outputFile}`);
  console.log(`  Columns: ${headers.length} (${QUESTION_IDS.length} question columns + metadata)`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
