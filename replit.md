# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Kuaishou Video Downloader (`artifacts/kuaishou-downloader`)
- **Type**: React + Vite frontend (served at `/`)
- **Purpose**: Web app to extract and download Kuaishou short videos without using official APIs

### API Server (`artifacts/api-server`)
- **Type**: Express backend (served at `/api`)
- **Key routes**:
  - `POST /api/download` — Extract video URL and metadata from a Kuaishou URL
  - `GET /api/proxy-video?url=...` — Proxy a video for direct download
  - `GET /api/healthz` — Health check
- **Scraping**: `artifacts/api-server/src/services/scraper.ts`
  - Browser-like headers (mobile + desktop user agents)
  - Parses `og:video` meta tags, `__APOLLO_STATE__`, `__INITIAL_STATE__`, inline JSON
  - In-memory cache (5 min TTL) to avoid duplicate requests
  - Rate limiting: 20 downloads/min, 30 proxy requests/min

## Features

- URL validation (Kuaishou domains only)
- In-memory result caching (TTL: 5 minutes)
- Rate limiting on both endpoints
- Video proxy for safe downloads (with Referer header spoofing)
- Mobile-first responsive UI
- Video preview with thumbnail, title, author, quality badge
- Copy link to clipboard
- Download via proxy button
