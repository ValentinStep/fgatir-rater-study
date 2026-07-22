/**
 * inspect-dicom.ts
 *
 * Utility script to inspect DICOM file headers and metadata.
 * Usage: npm run inspect-dicom -- --input <path-to-dicom-directory>
 *
 * Extracts non-PHI metadata from DICOM files and reports:
 * - File count, dimensions, bit depth, transfer syntax
 * - Orientation, spacing, slice ordering
 *
 * NEVER prints: PatientName, PatientID, PatientBirthDate,
 * AccessionNumber, InstitutionName, ReferringPhysicianName
 */

import fs from 'node:fs';
import path from 'node:path';
import dicomParser from 'dicom-parser';

// --- PHI tags that must NEVER be printed ---
const PHI_TAGS = new Set([
  'x00100010', // PatientName
  'x00100020', // PatientID
  'x00100030', // PatientBirthDate
  'x00080050', // AccessionNumber
  'x00080080', // InstitutionName
  'x00080090', // ReferringPhysicianName
]);

// --- Safe metadata tags to extract ---
interface DicomMetadata {
  fileName: string;
  rows?: number;
  columns?: number;
  bitsAllocated?: number;
  bitsStored?: number;
  pixelRepresentation?: number;
  transferSyntaxUID?: string;
  imageOrientationPatient?: string;
  imagePositionPatient?: string;
  pixelSpacing?: string;
  sliceThickness?: number;
  instanceNumber?: number;
  sliceLocation?: number;
  windowCenter?: number | string;
  windowWidth?: number | string;
  modality?: string;
  seriesInstanceUID?: string;
}

function parseArgs(): { input: string } {
  const args = process.argv.slice(2);
  let input = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      input = args[i + 1]!;
      i++;
    }
  }

  if (!input) {
    console.error('Usage: npm run inspect-dicom -- --input <path-to-dicom-directory>');
    process.exit(1);
  }

  return { input };
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
        // Skip hidden files and known non-DICOM files
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'DICOMDIR') continue;
        files.push(fullPath);
      }
    }
  }

  walkDir(dirPath);
  return files.sort();
}

function getNumericString(
  dataSet: dicomParser.DataSet,
  tag: string,
): number | undefined {
  const value = dataSet.string(tag);
  if (value === undefined) return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

function getMultiValueString(
  dataSet: dicomParser.DataSet,
  tag: string,
): string | undefined {
  const value = dataSet.string(tag);
  return value || undefined;
}

function extractMetadata(
  filePath: string,
  buffer: Buffer,
): DicomMetadata | null {
  try {
    const byteArray = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    const dataSet = dicomParser.parseDicom(byteArray);

    // Get TransferSyntax from meta header
    let transferSyntaxUID = dataSet.string('x00020010');
    if (!transferSyntaxUID) {
      // Try without meta header prefix
      transferSyntaxUID = 'Unknown';
    }

    const metadata: DicomMetadata = {
      fileName: path.basename(filePath),
      rows: dataSet.uint16('x00280010'),
      columns: dataSet.uint16('x00280011'),
      bitsAllocated: dataSet.uint16('x00280100'),
      bitsStored: dataSet.uint16('x00280101'),
      pixelRepresentation: dataSet.uint16('x00280103'),
      transferSyntaxUID,
      imageOrientationPatient: getMultiValueString(dataSet, 'x00200037'),
      imagePositionPatient: getMultiValueString(dataSet, 'x00200032'),
      pixelSpacing: getMultiValueString(dataSet, 'x00280030'),
      sliceThickness: getNumericString(dataSet, 'x00180050'),
      instanceNumber: dataSet.intString('x00200013') ?? undefined,
      sliceLocation: getNumericString(dataSet, 'x00201041'),
      windowCenter: getMultiValueString(dataSet, 'x00281050'),
      windowWidth: getMultiValueString(dataSet, 'x00281051'),
      modality: dataSet.string('x00080060'),
      seriesInstanceUID: dataSet.string('x0020000e'),
    };

    return metadata;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  Warning: Could not parse ${path.basename(filePath)}: ${message}`);
    return null;
  }
}

function main(): void {
  const { input } = parseArgs();

  // Validate input path
  if (!fs.existsSync(input)) {
    console.error(`Error: Input path does not exist: ${input}`);
    process.exit(1);
  }

  const stat = fs.statSync(input);
  if (!stat.isDirectory()) {
    console.error(`Error: Input path is not a directory: ${input}`);
    process.exit(1);
  }

  console.log('=== DICOM Inspection Report ===');
  console.log(`Input directory: [REDACTED]`);
  console.log('');

  // Find all DICOM files
  const files = findDicomFiles(input);
  console.log(`Files found: ${files.length}`);

  if (files.length === 0) {
    console.log('No DICOM files found in directory.');
    return;
  }

  // Extract metadata from all files
  const allMetadata: DicomMetadata[] = [];
  for (const file of files) {
    const buffer = fs.readFileSync(file);
    const meta = extractMetadata(file, buffer);
    if (meta) {
      allMetadata.push(meta);
    }
  }

  console.log(`Successfully parsed: ${allMetadata.length}/${files.length}`);
  console.log('');

  if (allMetadata.length === 0) {
    console.log('No valid DICOM files could be parsed.');
    return;
  }

  // Report summary from first file
  const first = allMetadata[0]!;
  console.log('--- Image Dimensions ---');
  console.log(`  Rows: ${first.rows}`);
  console.log(`  Columns: ${first.columns}`);
  console.log('');

  console.log('--- Bit Depth ---');
  console.log(`  BitsAllocated: ${first.bitsAllocated}`);
  console.log(`  BitsStored: ${first.bitsStored}`);
  console.log(`  PixelRepresentation: ${first.pixelRepresentation} (${first.pixelRepresentation === 0 ? 'unsigned' : 'signed'})`);
  console.log('');

  console.log('--- Transfer Syntax ---');
  console.log(`  TransferSyntaxUID: ${first.transferSyntaxUID}`);
  const tsName = getTransferSyntaxName(first.transferSyntaxUID ?? '');
  if (tsName) console.log(`  Name: ${tsName}`);
  console.log('');

  console.log('--- Orientation ---');
  console.log(`  ImageOrientationPatient: ${first.imageOrientationPatient ?? 'N/A'}`);
  console.log('');

  console.log('--- Spacing ---');
  console.log(`  PixelSpacing: ${first.pixelSpacing ?? 'N/A'}`);
  console.log(`  SliceThickness: ${first.sliceThickness ?? 'N/A'}`);
  console.log('');

  console.log('--- Window ---');
  console.log(`  WindowCenter: ${first.windowCenter ?? 'N/A'}`);
  console.log(`  WindowWidth: ${first.windowWidth ?? 'N/A'}`);
  console.log('');

  console.log('--- Modality ---');
  console.log(`  Modality: ${first.modality ?? 'N/A'}`);
  console.log('');

  console.log('--- Series ---');
  console.log(`  SeriesInstanceUID: ${first.seriesInstanceUID ?? 'N/A'}`);
  console.log('');

  // Slice ordering analysis
  console.log('--- Slice Ordering ---');
  const sortedByInstance = [...allMetadata]
    .filter((m) => m.instanceNumber !== undefined)
    .sort((a, b) => (a.instanceNumber ?? 0) - (b.instanceNumber ?? 0));

  if (sortedByInstance.length > 0) {
    const firstSlice = sortedByInstance[0]!;
    const lastSlice = sortedByInstance[sortedByInstance.length - 1]!;
    console.log(`  Instance Number range: ${firstSlice.instanceNumber} - ${lastSlice.instanceNumber}`);
    console.log(`  SliceLocation range: ${firstSlice.sliceLocation} - ${lastSlice.sliceLocation}`);
    console.log(`  First ImagePositionPatient: ${firstSlice.imagePositionPatient ?? 'N/A'}`);
    console.log(`  Last ImagePositionPatient: ${lastSlice.imagePositionPatient ?? 'N/A'}`);
  }

  console.log('');
  console.log('=== End of Report ===');
}

function getTransferSyntaxName(uid: string): string | undefined {
  const names: Record<string, string> = {
    '1.2.840.10008.1.2': 'Implicit VR Little Endian',
    '1.2.840.10008.1.2.1': 'Explicit VR Little Endian',
    '1.2.840.10008.1.2.2': 'Explicit VR Big Endian',
    '1.2.840.10008.1.2.4.50': 'JPEG Baseline',
    '1.2.840.10008.1.2.4.51': 'JPEG Extended',
    '1.2.840.10008.1.2.4.57': 'JPEG Lossless',
    '1.2.840.10008.1.2.4.70': 'JPEG Lossless First-Order Prediction',
    '1.2.840.10008.1.2.4.80': 'JPEG-LS Lossless',
    '1.2.840.10008.1.2.4.81': 'JPEG-LS Near-Lossless',
    '1.2.840.10008.1.2.4.90': 'JPEG 2000 Lossless',
    '1.2.840.10008.1.2.4.91': 'JPEG 2000',
    '1.2.840.10008.1.2.5': 'RLE Lossless',
  };
  return names[uid];
}

// Ensure PHI_TAGS is referenced to avoid unused variable lint error
void PHI_TAGS;

main();
