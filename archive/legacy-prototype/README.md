# Multi-Rater Image Annotation Tool (generic)

A lightweight, single-file web tool for **multi-rater landmark annotation** on
stacked image slices. Named raters log in, page through slices, click to place
a configurable set of landmark points on any slice, and their annotations are
saved to a [Supabase](https://supabase.com) table. Built for inter-observer
data collection where you want several people to independently annotate the
same set of images.

It is fully generic: **you define your own landmark points** in a config file.
There is no built-in measurement, index, threshold, or classification logic —
the tool only collects point coordinates. What you do with them afterward is up
to you.

## Features

- Click-to-place landmark points (placed in a configurable order)
- Slice navigation: scroll wheel, arrow / `A` `D` keys, or a slider
- Zoom (`Ctrl`+scroll), pan (right-mouse drag), window/level (middle-mouse drag)
- Undo (`Z`), per-point clear, save + advance (`Enter`)
- Per-rater progress tracking and resume (reloads your saved work on login)
- Config-driven landmark scheme — no code changes to define new points

## How it works

- `index.html` — the entire app (React via CDN, no build step).
- `landmarks.config.json` — **your** landmark scheme (points + optional guide lines).
- `config.js` — your Supabase URL + key (created from `config.example.js`; gitignored).
- `schema.sql` — the single `annotations` table + storage notes.
- Images and the `manifest.json` item list live in a public Supabase Storage bucket.

## Setup

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) and create a new project.

### 2. Create the database table

Open the project's **SQL Editor** and run the contents of [`schema.sql`](schema.sql).
This creates the `annotations` table (and a permissive Row Level Security policy
you should tighten to your needs).

### 3. Create a storage bucket and upload images

- In **Storage**, create a **public** bucket (default name `images`).
- Upload a `manifest.json` at the bucket root listing your items:

  ```json
  {
    "items": [
      { "id": "case_0001", "slices": 32 },
      { "id": "case_0002", "slices": 28 }
    ]
  }
  ```

- For each item, upload its slices as PNGs under a folder named by its `id`:

  ```
  case_0001/slice_001.png
  case_0001/slice_002.png
  ...
  ```

### 4. Configure credentials

```
cp config.example.js config.js
```

Edit `config.js` and set your `SUPABASE_URL`, `SUPABASE_KEY` (use the
**publishable / anon** key — never a service-role key in a browser), and
`STORAGE_BUCKET`. An equivalent `.env.example` is provided if you prefer to
manage the same values through a `.env` for your own tooling.

### 5. Define your landmarks

Edit [`landmarks.config.json`](landmarks.config.json). The shipped example
defines three generic points (`point_a`, `point_b`, `point_c`). Replace them
with your own:

```json
{
  "title": "My Annotation Task",
  "subtitle": "Place each point where instructed.",
  "landmarks": [
    { "key": "tip",  "label": "Tip",  "color": "#E24B4A", "short": "T" },
    { "key": "base", "label": "Base", "color": "#378ADD", "short": "B" }
  ],
  "connections": [ ["tip", "base"] ]
}
```

- `landmarks` — ordered list of points the rater places. `key` is a unique id,
  `label` is shown in the UI, `color` is a hex color, `short` is a 1–2 char badge.
- `connections` — optional `[keyA, keyB]` pairs that draw a dashed guide line
  between two placed points. Purely visual; nothing is measured.

### 6. Serve the app

Because the app fetches `landmarks.config.json`, serve the folder over HTTP
rather than opening `index.html` directly from disk:

```
python -m http.server 8000
# then open http://localhost:8000
```

Or host the folder on any static host (GitHub Pages, Netlify, Vercel, etc.).
Do **not** upload `config.js` or `.env` to a public host if your Supabase key
is not meant to be public — prefer environment-based injection for public
deployments.

## Data model

Each save is one row in `annotations`:

| column        | meaning                                             |
|---------------|-----------------------------------------------------|
| `annotator`   | rater name entered on login                         |
| `item_id`     | id of the annotated image stack                     |
| `slice_index` | slice the points were placed on                     |
| `landmarks`   | `{ "<point_key>": { "x": <num>, "y": <num> }, ... }` in image pixel coordinates |

Re-saving the same item by the same rater updates their existing row.
