# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Validation**: Zod (`zod/v4`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Kuaishou Video Downloader (`artifacts/kuaishou-downloader`)
- **Type**: React + Vite frontend (served at `/`)
- **Purpose**: Web app to extract and download Kuaishou and Kwai short videos without using official APIs
- **UI**: Dark theme with electric cyan (#00F0FF) accents, KSD branding
- **Download**: Blob-based download (fetch → blob → objectURL) for reliable cross-environment downloads

### API Server (`artifacts/api-server`)
- **Type**: Express backend (served at `/api`)
- **Key routes**:
  - `POST /api/download` — Extract video URL and metadata from a Kuaishou or Kwai URL
  - `GET /api/proxy-video?url=...` — Proxy a video stream for download (60 req/min limit)
  - `GET /api/healthz` — Health check
- **Trust proxy**: enabled (`app.set("trust proxy", 1)`) for correct rate limiting behind Replit's proxy

## Scraping Architecture (`artifacts/api-server/src/services/scraper.ts`)

### Kuaishou support
- Detects `kuaishou.com` and `gifshow.com` URLs
- Extraction priority:
  1. `window.__APOLLO_STATE__` — React Apollo GraphQL cache (most common)
  2. Script tags with JSON blocks containing `photoH265Url`, `photoUrl`, `mainMvUrls`
  3. `og:video` meta tags
  4. Inline JSON in `__INITIAL_STATE__`, `__NEXT_DATA__`
  5. Deep search via `deepFindVideoUrl`

### Kwai support
- Detects `kwai.com`, `kwai.app`, `share.kwai.app`, `v.kwai.com`, `m.kwai.com`
- Normalizes share/mobile URLs to `www.kwai.com`
- Extraction priority:
  1. **JSON-LD VideoObject** (`<script type="application/ld+json">`) — most reliable; provides full metadata (title, author, duration in ISO 8601, thumbnail, HD video URL, resolution)
  2. `__NUXT__` IIFE state — extracts `main_mv_urls` with unicode-decoded URLs (`\u002F` → `/`)
  3. `og:video` meta tags
  4. Mobile fallback (same priority order)
- Duration: ISO 8601 (e.g., `PT8S`) is converted to milliseconds

### Proxy allowlist
Covers all Kwai CDN subdomains via `kwai.net` wildcard match, plus Kuaishou CDNs:
`kwai.net`, `kwai.com`, `kuaishou.com`, `ks3cdn.com`, `kspkg.com`, etc.

## Features

- URL validation (Kuaishou + Kwai domains)
- In-memory result caching (5 min TTL)
- Rate limiting: 20 extractions/min, 60 proxy requests/min
- Video proxy with proper Referer spoofing and range request forwarding
- Video preview streamed through proxy (avoids CDN CORS restrictions)
- Blob-based file download for reliable device saves
- Full metadata: title, author name, duration (M:SS badge), quality (HD/FHD/SD), thumbnail
- Copy direct link to clipboard
