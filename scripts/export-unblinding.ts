/**
 * export-unblinding.ts
 *
 * Admin-only CLI script that generates a CSV mapping series to conditions.
 * This file should NEVER be accessible to raters.
 *
 * Usage:
 *   npm run export-unblinding -- --manifest "./local-data/manifest.json" \
 *     --key "./local-data/.unblinding-key.json" \
 *     --output "./local-data/unblinding-export.csv"
 */

import fs from 'node:fs';
import path from 'node:path';

// --- Types (local to script, not importing from src to avoid bundler issues) ---

interface SeriesEntry {
  seriesId: string;
  sliceCount: number;
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  windowCenter: number;
  windowWidth: number;
  transferSyntaxUID: string;
}

interface CaseEntry {
  subjectId: string;
  series: SeriesEntry[];
}

interface StudyManifest {
  version: string;
  cases: CaseEntry[];
}

interface UnblindingKeyEntry {
  seriesId: string;
  condition: string;
  sourceFolder: string;
}

interface UnblindingKey {
  version: string;
  generatedAt: string;
  entries: UnblindingKeyEntry[];
}

// --- CLI arg parsing ---

function parseArgs(): { manifest: string; key: string; output: string } {
  const args = process.argv.slice(2);
  let manifest = './local-data/manifest.json';
  let key = './local-data/.unblinding-key.json';
  let output = './local-data/unblinding-export.csv';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--manifest' && next) {
      manifest = next;
      i++;
    } else if (arg === '--key' && next) {
      key = next;
      i++;
    } else if (arg === '--output' && next) {
      output = next;
      i++;
    }
  }

  return { manifest, key, output };
}

// --- Main ---

function main(): void {
  const { manifest: manifestPath, key: keyPath, output: outputPath } = parseArgs();

  // Resolve paths relative to CWD
  const resolvedManifest = path.resolve(manifestPath);
  const resolvedKey = path.resolve(keyPath);
  const resolvedOutput = path.resolve(outputPath);

  // Load manifest
  if (!fs.existsSync(resolvedManifest)) {
    console.error(`❌ Manifest not found: ${resolvedManifest}`);
    process.exit(1);
  }

  const manifest: StudyManifest = JSON.parse(
    fs.readFileSync(resolvedManifest, 'utf-8'),
  );

  // Load unblinding key
  if (!fs.existsSync(resolvedKey)) {
    console.error(`❌ Unblinding key not found: ${resolvedKey}`);
    process.exit(1);
  }

  const unblindingKey: UnblindingKey = JSON.parse(
    fs.readFileSync(resolvedKey, 'utf-8'),
  );

  // Build a lookup from seriesId → condition
  const conditionMap = new Map<string, string>();
  for (const entry of unblindingKey.entries) {
    conditionMap.set(entry.seriesId, entry.condition);
  }

  // Build CSV rows
  const csvHeader = 'subject_id,series_id,condition,display_label_example';
  const csvRows: string[] = [csvHeader];

  let displayIndex = 1;
  for (const caseEntry of manifest.cases) {
    for (const series of caseEntry.series) {
      const condition = conditionMap.get(series.seriesId) ?? 'UNKNOWN';
      csvRows.push(
        `${caseEntry.subjectId},${series.seriesId},${condition},Image set ${displayIndex}`,
      );
      displayIndex++;
    }
  }

  // Write output
  const outputDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(resolvedOutput, csvRows.join('\n') + '\n', 'utf-8');

  console.log(`✅ Unblinding export written to: ${resolvedOutput}`);
  console.log(`   ${csvRows.length - 1} entries exported.`);
}

main();
