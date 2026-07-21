-- Generic multi-rater annotation schema (table definitions only).
-- Run this in your own Supabase project's SQL editor.
--
-- One row per (annotator, item). Re-saving the same item upserts the row
-- (the app POSTs with Prefer: resolution=merge-duplicates against the
-- unique constraint below).

create table if not exists public.annotations (
    id           bigint generated always as identity primary key,
    annotator    text        not null,          -- rater name / id
    item_id      text        not null,          -- id of the image stack being annotated
    slice_index  integer,                        -- which slice the points were placed on
    landmarks    jsonb,                          -- { "<point_key>": { "x": <num>, "y": <num> }, ... }
    created_at   timestamptz not null default now(),
    unique (annotator, item_id)
);

-- Helpful index for per-rater progress lookups.
create index if not exists annotations_annotator_idx
    on public.annotations (annotator);

-- ---------------------------------------------------------------------------
-- Row Level Security (recommended). Adjust to your trust model.
-- The example below allows anonymous read/insert/update, which matches the
-- lightweight "share a link with named raters" workflow. Tighten as needed.
-- ---------------------------------------------------------------------------
alter table public.annotations enable row level security;

create policy "anon can read annotations"
    on public.annotations for select
    to anon
    using (true);

create policy "anon can insert annotations"
    on public.annotations for insert
    to anon
    with check (true);

create policy "anon can update annotations"
    on public.annotations for update
    to anon
    using (true)
    with check (true);

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- Create a PUBLIC storage bucket named to match STORAGE_BUCKET (default:
-- "images") via the Supabase dashboard (Storage > New bucket > Public).
-- Upload:
--   manifest.json                          -> { "items": [ { "id": "<item_id>", "slices": <n> }, ... ] }
--   <item_id>/slice_001.png ... slice_NNN.png
-- The app fetches these from:
--   {SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/...
