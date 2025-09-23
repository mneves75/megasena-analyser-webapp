# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application for analyzing Mega Sena lottery data, built with React 19, TypeScript, and TailwindCSS. The project uses the App Router architecture with Turbopack for improved performance.

## Development Commands

- `npm run dev` - Start development server with Turbopack hot reload
- `npm run build` - Build production bundle with Turbopack (run before every push/PR)
- `npm run start` - Serve production build for testing
- `npm run lint` - Run ESLint with Next.js config (treat warnings as blockers)
- `npm run typecheck` - Run TypeScript compiler without emitting files
- `npm run format` - Format code with Prettier
- `npm run prepare` - Set up Git hooks with Husky

## Project Architecture

### Directory Structure

- `src/app/` - Next.js App Router pages and layouts
- `src/lib/` - Shared utilities and helpers (create when needed)
- `public/` - Static assets and mock data files
- `docs/` - Documentation and planning updates

### Key Configuration

- Uses TypeScript with strict mode enabled
- Path alias `@/*` maps to `./src/*`
- ESLint extends Next.js core-web-vitals and TypeScript configs
- Husky + lint-staged for pre-commit hooks
- TailwindCSS v4 for styling

## Coding Standards

### TypeScript & React

- Default to React Server Components
- Only add `"use client"` when browser APIs or client state required
- Use TypeScript strict mode throughout

### File & Directory Naming

- Use `kebab-case` for files and directories (e.g., `draw-frequency-table.tsx`)
- 2-space indentation consistently
- Favor Tailwind utilities over custom CSS

### Styling

- Global styles in `src/app/globals.css`
- Extend Tailwind config instead of adding global CSS
- Use format-on-save and let ESLint handle spacing/imports

## Testing

Currently no automated testing configured. When adding tests:

- Place `*.test.ts(x)` files beside code or under `src/__tests__/`
- Cover deterministic logic first (probability aggregations)
- Document manual verification in PRs until test runner exists

## Git & Commit Guidelines

- Use concise, imperative commit subjects (e.g., "Add draw frequency table")
- Reference issue IDs when applicable
- PRs must include: lint/build status, change summary, UI screenshots for visual updates

## Environment & Security

- Store secrets in `.env.local` (never commit)
- Document environment variables and defaults in README.md
- When adding external APIs, document auth steps and rate limits in `docs/`

## Pre-commit Hooks

Lint-staged runs on commit:

- TypeScript/JavaScript files: ESLint + Prettier
- Other files (JSON, MD, CSS): Prettier formatting
