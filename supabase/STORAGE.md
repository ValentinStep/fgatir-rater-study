# Supabase Storage Design — FGATIR Rater Study

## Bucket: `dicom-images` (Private)

All DICOM image data is stored in a **private** Supabase Storage bucket. No public read access is granted.

### Structure

```
dicom-images/
  {study_id}/
    {blinded_series_code}/
      slice_001.dcm
      slice_002.dcm
      ...
      slice_NNN.dcm
```

- **`study_id`**: UUID of the study (from the `studies` table)
- **`blinded_series_code`**: The blinded code for the series (from `image_series.blinded_series_code`)
- **`slice_NNN.dcm`**: Zero-padded slice index (3 digits)

### Access Control

- **No public read access** — the bucket is set to private.
- Authenticated users receive **short-lived signed URLs** (default: 1 hour expiry) to access individual DICOM slices.
- Signed URLs are generated server-side (via Edge Function or the Supabase client with service-role key).
- The browser application never sees the raw `storage_prefix` path — only receives signed URLs.

### Signed URL Generation

The application requests signed URLs for a series through one of:

1. **Supabase Edge Function** (recommended for production):
   - Validates the user has an assignment for the requested series
   - Returns an array of signed URLs for all slices

2. **Direct client SDK** (for development/staging):
   - Uses `supabase.storage.from('dicom-images').createSignedUrl(path, expiresIn)`
   - Only works when the user has appropriate RLS access

### URL Expiration & Retry

- Default expiration: **3600 seconds** (1 hour)
- The `SupabaseImageSource` handles expired URLs by requesting fresh ones on 403/401 responses
- A single retry with a fresh signed URL is attempted before surfacing an error

### Security Considerations

- Storage paths use **blinded series codes**, not original folder names
- The `storage_prefix` column in `image_series` is used server-side only
- Raters cannot enumerate the bucket or discover other series
- The `unblinding` table (condition mapping) is completely inaccessible to raters

### Local Development

For local development **without Supabase**:
- The Vite dev server middleware serves DICOM files from `local-data/`
- The `LocalImageSource` fetches from `/dicom-data/{seriesId}/slice_NNN.dcm`
- No Supabase credentials are required for local development
- The application auto-detects missing Supabase config and falls back to local mode

### Ingestion Workflow

When ingesting new cases (admin operation):

1. Run the ingestion script with service-role credentials
2. DICOM files are uploaded to `dicom-images/{study_id}/{blinded_series_code}/`
3. The `image_series` table is populated with metadata
4. The `unblinding` table records the original/denoised condition
5. Assignments are generated for each rater
