/**
 * validate-manifest.ts
 *
 * Validates a manifest.json file for correctness.
 * Usage: npm run validate-manifest -- --input <path-to-manifest.json>
 */

import fs from 'node:fs';
import path from 'node:path';

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

function parseArgs(): { input: string } {
  const args = process.argv.slice(2);
  let input = './local-data/manifest.json';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      input = args[i + 1]!;
      i++;
    }
  }

  return { input };
}

function main(): void {
  const { input } = parseArgs();

  if (!fs.existsSync(input)) {
    console.error(`Error: Manifest file not found: ${input}`);
    process.exit(1);
  }

  const content = fs.readFileSync(input, 'utf-8');
  let manifest: StudyManifest;

  try {
    manifest = JSON.parse(content) as StudyManifest;
  } catch {
    console.error('Error: Invalid JSON in manifest file');
    process.exit(1);
  }

  console.log('=== Manifest Validation ===');
  console.log(`File: ${path.resolve(input)}`);
  console.log('');

  let errors = 0;

  // Check version
  if (!manifest.version) {
    console.error('✗ Missing version field');
    errors++;
  } else {
    console.log(`✓ Version: ${manifest.version}`);
  }

  // Check cases
  if (!Array.isArray(manifest.cases)) {
    console.error('✗ Missing or invalid cases array');
    errors++;
  } else {
    console.log(`✓ Cases: ${manifest.cases.length}`);

    for (const caseEntry of manifest.cases) {
      console.log(`  Subject: ${caseEntry.subjectId}`);

      if (!caseEntry.subjectId) {
        console.error('  ✗ Missing subjectId');
        errors++;
      }

      if (!Array.isArray(caseEntry.series)) {
        console.error('  ✗ Missing or invalid series array');
        errors++;
        continue;
      }

      for (const series of caseEntry.series) {
        console.log(`    Series: ${series.seriesId}`);
        console.log(`      Slices: ${series.sliceCount}, Dims: ${series.rows}×${series.columns}`);
        console.log(`      Bits: ${series.bitsStored}/${series.bitsAllocated}, WW/WC: ${series.windowWidth}/${series.windowCenter}`);

        if (!series.seriesId) {
          console.error('    ✗ Missing seriesId');
          errors++;
        }
        if (series.sliceCount <= 0) {
          console.error('    ✗ Invalid sliceCount');
          errors++;
        }
        if (series.rows <= 0 || series.columns <= 0) {
          console.error('    ✗ Invalid dimensions');
          errors++;
        }
      }
    }
  }

  console.log('');
  if (errors > 0) {
    console.error(`✗ Validation failed with ${errors} error(s)`);
    process.exit(1);
  } else {
    console.log('✓ Manifest is valid');
  }
}

main();
