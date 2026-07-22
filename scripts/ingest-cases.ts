/**
 * ingest-cases.ts
 *
 * Ingestion script that:
 * 1. Scans for case folders (original/denoised pairs)
 * 2. Copies DICOM files to local-data/ with neutral filenames
 * 3. Orders slices by InstanceNumber/SliceLocation
 * 4. Generates manifest.json and .unblinding-key.json
 *
 * Usage: npm run ingest-cases -- --input <path-to-test-case-folder> --output <output-dir>
 *
 * NEVER includes PHI in output manifests.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dicomParser from 'dicom-parser';

// --- Types ---

interface SeriesInfo {
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
  series: SeriesInfo[];
}

interface StudyManifest {
  version: string;
  cases: CaseEntry[];
}

interface UnblindingEntry {
  seriesId: string;
  condition: 'original' | 'denoised';
  sourceFolder: string;
}

interface UnblindingKey {
  version: string;
  generatedAt: string;
  entries: UnblindingEntry[];
}

interface SliceFile {
  filePath: string;
  instanceNumber: number;
  sliceLocation: number;
  imagePositionPatient: number[];
}

// --- Argument parsing ---

function parseArgs(): { input: string; output: string } {
  const args = process.argv.slice(2);
  let input = '';
  let output = './local-data';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      input = args[i + 1]!;
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[i + 1]!;
      i++;
    }
  }

  if (!input) {
    console.error(
      'Usage: npm run ingest-cases -- --input <path> --output <path>',
    );
    process.exit(1);
  }

  return { input, output };
}

// --- Utility functions ---

function generateDeterministicId(seed: string, prefix: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `${prefix}_${hash.slice(0, 12)}`;
}

function findDicomFiles(dirPath: string): string[] {
  const files: string[] = [];

  function walkDir(currentPath: string): void {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'DICOMDIR') continue;
        files.push(fullPath);
      }
    }
  }

  walkDir(dirPath);
  return files.sort();
}

function parseDicomSliceInfo(filePath: string): SliceFile | null {
  try {
    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    const dataSet = dicomParser.parseDicom(byteArray);

    const instanceNumber = dataSet.intString('x00200013') ?? 0;
    const sliceLocationStr = dataSet.string('x00201041');
    const sliceLocation = sliceLocationStr
      ? parseFloat(sliceLocationStr)
      : 0;

    const ippStr = dataSet.string('x00200032');
    const imagePositionPatient = ippStr
      ? ippStr.split('\\').map(Number)
      : [0, 0, 0];

    return {
      filePath,
      instanceNumber,
      sliceLocation,
      imagePositionPatient,
    };
  } catch {
    return null;
  }
}

function extractSeriesMetadata(filePath: string): SeriesInfo | null {
  try {
    const buffer = fs.readFileSync(filePath);
    const byteArray = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    const dataSet = dicomParser.parseDicom(byteArray);

    const rows = dataSet.uint16('x00280010') ?? 0;
    const columns = dataSet.uint16('x00280011') ?? 0;
    const bitsAllocated = dataSet.uint16('x00280100') ?? 16;
    const bitsStored = dataSet.uint16('x00280101') ?? 12;
    const transferSyntaxUID = dataSet.string('x00020010') ?? '1.2.840.10008.1.2.1';

    const wcStr = dataSet.string('x00281050');
    const wwStr = dataSet.string('x00281051');
    const windowCenter = wcStr ? parseFloat(wcStr.split('\\')[0]!) : 0;
    const windowWidth = wwStr ? parseFloat(wwStr.split('\\')[0]!) : 0;

    return {
      seriesId: '', // Will be set later
      sliceCount: 0, // Will be set later
      rows,
      columns,
      bitsAllocated,
      bitsStored,
      windowCenter,
      windowWidth,
      transferSyntaxUID,
    };
  } catch {
    return null;
  }
}

// --- Case detection ---

interface DetectedCase {
  subjectId: string;
  originalDir: string;
  denoisedDir: string | null;
}

function detectCases(inputDir: string): DetectedCase[] {
  const entries = fs.readdirSync(inputDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  // Find pairs: XXXX and XXXX_denoised
  const cases: DetectedCase[] = [];
  const processed = new Set<string>();

  for (const dir of dirs) {
    if (processed.has(dir)) continue;

    if (dir.endsWith('_denoised')) {
      // This is a denoised dir, find its original
      const baseName = dir.replace(/_denoised$/, '');
      if (!processed.has(baseName)) {
        // Check if the original exists (might be in a subfolder)
        const originalCandidate = path.join(inputDir, baseName);
        if (fs.existsSync(originalCandidate)) {
          const subjectId = generateDeterministicId(baseName, 'subject');
          cases.push({
            subjectId,
            originalDir: originalCandidate,
            denoisedDir: path.join(inputDir, dir),
          });
          processed.add(baseName);
          processed.add(dir);
        }
      }
    } else {
      // Check if a denoised counterpart exists
      const denoisedName = `${dir}_denoised`;
      const denoisedPath = path.join(inputDir, denoisedName);
      const subjectId = generateDeterministicId(dir, 'subject');

      if (dirs.includes(denoisedName)) {
        cases.push({
          subjectId,
          originalDir: path.join(inputDir, dir),
          denoisedDir: denoisedPath,
        });
        processed.add(dir);
        processed.add(denoisedName);
      } else {
        // Solo directory - might contain IMAGES subfolder
        cases.push({
          subjectId,
          originalDir: path.join(inputDir, dir),
          denoisedDir: null,
        });
        processed.add(dir);
      }
    }
  }

  return cases;
}

function findImageDirectory(caseDir: string): string {
  // Look for DICOM files directly or in known subdirectories
  // Common patterns: <case>/<date>/IMAGES/ or <case>/
  const imagesSubdir = findDeepestImageDir(caseDir);
  return imagesSubdir || caseDir;
}

function findDeepestImageDir(dir: string): string | null {
  // Recursively search for a directory containing DICOM-like files
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // Check if this dir directly contains DICOM files (files without common extensions)
  const hasFiles = entries.some(
    (e) =>
      e.isFile() &&
      !e.name.startsWith('.') &&
      e.name !== 'DICOMDIR',
  );

  if (hasFiles) {
    // Verify at least one is a DICOM file
    const testFile = entries.find(
      (e) =>
        e.isFile() &&
        !e.name.startsWith('.') &&
        e.name !== 'DICOMDIR',
    );
    if (testFile) {
      try {
        const buffer = fs.readFileSync(path.join(dir, testFile.name));
        const byteArray = new Uint8Array(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength,
        );
        dicomParser.parseDicom(byteArray);
        return dir;
      } catch {
        // Not a DICOM file, continue searching
      }
    }
  }

  // Search subdirectories
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const found = findDeepestImageDir(path.join(dir, entry.name));
      if (found) return found;
    }
  }

  return null;
}

// --- Main ingestion logic ---

function ingestSeries(
  imageDir: string,
  seriesId: string,
  outputDir: string,
): SeriesInfo | null {
  console.log(`  Scanning: ${path.basename(imageDir)}`);

  const files = findDicomFiles(imageDir);
  if (files.length === 0) {
    console.warn(`  Warning: No files found in ${imageDir}`);
    return null;
  }

  // Parse slice info from all files
  const slices: SliceFile[] = [];
  for (const file of files) {
    const info = parseDicomSliceInfo(file);
    if (info) {
      slices.push(info);
    }
  }

  if (slices.length === 0) {
    console.warn(`  Warning: No valid DICOM files in ${imageDir}`);
    return null;
  }

  // Sort by InstanceNumber (primary), then SliceLocation (secondary)
  slices.sort((a, b) => {
    if (a.instanceNumber !== b.instanceNumber) {
      return a.instanceNumber - b.instanceNumber;
    }
    return a.sliceLocation - b.sliceLocation;
  });

  // Extract metadata from first slice
  const metadata = extractSeriesMetadata(slices[0]!.filePath);
  if (!metadata) {
    console.warn(`  Warning: Could not extract metadata`);
    return null;
  }

  // Create output directory
  const seriesOutputDir = path.join(outputDir, seriesId);
  fs.mkdirSync(seriesOutputDir, { recursive: true });

  // Copy files with neutral names
  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]!;
    const paddedIndex = String(i + 1).padStart(3, '0');
    const destFile = path.join(seriesOutputDir, `slice_${paddedIndex}.dcm`);
    fs.copyFileSync(slice.filePath, destFile);
  }

  console.log(`  Copied ${slices.length} slices to ${seriesId}/`);

  return {
    seriesId,
    sliceCount: slices.length,
    rows: metadata.rows,
    columns: metadata.columns,
    bitsAllocated: metadata.bitsAllocated,
    bitsStored: metadata.bitsStored,
    windowCenter: metadata.windowCenter,
    windowWidth: metadata.windowWidth,
    transferSyntaxUID: metadata.transferSyntaxUID,
  };
}

function validateGeometry(
  series1: SeriesInfo,
  series2: SeriesInfo,
): boolean {
  const issues: string[] = [];

  if (series1.rows !== series2.rows)
    issues.push(`Rows mismatch: ${series1.rows} vs ${series2.rows}`);
  if (series1.columns !== series2.columns)
    issues.push(`Columns mismatch: ${series1.columns} vs ${series2.columns}`);
  if (series1.sliceCount !== series2.sliceCount)
    issues.push(
      `Slice count mismatch: ${series1.sliceCount} vs ${series2.sliceCount}`,
    );
  if (series1.bitsAllocated !== series2.bitsAllocated)
    issues.push(
      `BitsAllocated mismatch: ${series1.bitsAllocated} vs ${series2.bitsAllocated}`,
    );

  if (issues.length > 0) {
    console.warn('  ⚠ Geometry validation warnings:');
    for (const issue of issues) {
      console.warn(`    - ${issue}`);
    }
    return false;
  }

  console.log('  ✓ Geometry validated: paired series match');
  return true;
}

function main(): void {
  const { input, output } = parseArgs();

  // Validate input
  if (!fs.existsSync(input)) {
    console.error(`Error: Input path does not exist: ${input}`);
    process.exit(1);
  }

  console.log('=== DICOM Case Ingestion ===');
  console.log(`Output directory: ${output}`);
  console.log('');

  // Create output directory
  fs.mkdirSync(output, { recursive: true });

  // Detect cases
  const cases = detectCases(input);
  console.log(`Detected ${cases.length} case(s)`);
  console.log('');

  if (cases.length === 0) {
    console.error('No cases detected. Check input directory structure.');
    process.exit(1);
  }

  const manifest: StudyManifest = {
    version: '1.0',
    cases: [],
  };

  const unblindingKey: UnblindingKey = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    entries: [],
  };

  for (const detectedCase of cases) {
    console.log(`Processing case: ${detectedCase.subjectId}`);

    const caseEntry: CaseEntry = {
      subjectId: detectedCase.subjectId,
      series: [],
    };

    // Process original series
    const originalImageDir = findImageDirectory(detectedCase.originalDir);
    const originalSeriesId = generateDeterministicId(
      `${detectedCase.subjectId}_original`,
      'series',
    );

    console.log('  [Original]');
    const originalSeries = ingestSeries(
      originalImageDir,
      originalSeriesId,
      output,
    );

    if (originalSeries) {
      caseEntry.series.push(originalSeries);
      unblindingKey.entries.push({
        seriesId: originalSeriesId,
        condition: 'original',
        sourceFolder: path.basename(detectedCase.originalDir),
      });
    }

    // Process denoised series if available
    if (detectedCase.denoisedDir) {
      const denoisedImageDir = findImageDirectory(detectedCase.denoisedDir);
      const denoisedSeriesId = generateDeterministicId(
        `${detectedCase.subjectId}_denoised`,
        'series',
      );

      console.log('  [Denoised]');
      const denoisedSeries = ingestSeries(
        denoisedImageDir,
        denoisedSeriesId,
        output,
      );

      if (denoisedSeries) {
        caseEntry.series.push(denoisedSeries);
        unblindingKey.entries.push({
          seriesId: denoisedSeriesId,
          condition: 'denoised',
          sourceFolder: path.basename(detectedCase.denoisedDir),
        });

        // Validate geometry between original and denoised
        if (originalSeries) {
          validateGeometry(originalSeries, denoisedSeries);
        }
      }
    }

    if (caseEntry.series.length > 0) {
      manifest.cases.push(caseEntry);
    }

    console.log('');
  }

  // Write manifest
  const manifestPath = path.join(output, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✓ Manifest written: ${manifestPath}`);

  // Write unblinding key (gitignored)
  const keyPath = path.join(output, '.unblinding-key.json');
  fs.writeFileSync(keyPath, JSON.stringify(unblindingKey, null, 2) + '\n');
  console.log(`✓ Unblinding key written: ${keyPath}`);

  console.log('');
  console.log('=== Ingestion Complete ===');
  console.log(`  Cases: ${manifest.cases.length}`);
  console.log(
    `  Total series: ${manifest.cases.reduce((sum, c) => sum + c.series.length, 0)}`,
  );
}

main();
