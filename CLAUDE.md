# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — an online arcade platform where users play games and compete for the highest score ("plataforma para jugar online y competir por la mayor cantidad de puntos"). The repo is currently a fresh `create-next-app` scaffold (App Router, TS, Tailwind v4) with no game/vault features implemented yet — `app/page.tsx` and `app/layout.tsx` are still the default template.

### Spec Driven Design workflow

Per README.md, this project follows Spec Driven Design using the `/spec` and `/spec-impl` skills from https://github.com/Klerith/fernando-skills. Those skills are **not yet installed** in this repo (no `.claude/skills` present). If a task calls for them, install first:

```bash
npx skills@latest add Klerith/fernando-skills
```

There is no test runner configured in `package.json` yet.

## Architecture notes specific to this Next.js 16 / React 19.2 setup

Next.js 16.3.1 is newer than this model's training data and has real breaking changes from Next 14/15 idioms. Before writing App Router code (route handlers, layouts, metadata, image generation, caching), read the matching doc under `node_modules/next/dist/docs/` as instructed in AGENTS.md — don't assume Next 14/15 APIs still apply. A few things already visible in this codebase or worth knowing up front:

- **Typed route props**: `app/layout.tsx` uses the generated `LayoutProps<"/">` helper type instead of a hand-written props interface. Pages should similarly use the generated `PageProps<'/route'>` / `RouteContext` helpers (from `next typegen`) rather than typing `params`/`searchParams` manually.
- **Async request APIs are fully async, no sync fallback**: `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` must all be `await`ed — the Next 15 temporary sync-access compatibility shim is gone in v16.
- **`middleware` → `proxy`**: a root middleware file must be named `proxy.ts`/`proxy.js` and export `proxy()`, not `middleware()`. The `edge` runtime is not supported in `proxy`.
- **ESLint flat config only** — see `eslint.config.mjs`; there is no `.eslintrc`.
- **Turbopack is the default** for both `dev` and `build`; `next build` will hard-fail if it detects a custom webpack config unless you pass `--webpack`.
- Path alias `@/*` maps to the repo root (see `tsconfig.json`).
- Styling is Tailwind CSS v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`, `app/globals.css`) — there is no `tailwind.config.*` file (v4 is CSS-first config).
