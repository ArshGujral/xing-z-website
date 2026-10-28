# Xing-Z website: shared instructions for every coding agent

Claude Code and Codex both work on this repository. This file is the single source of rules for both of them
(`CLAUDE.md` only imports it). Change the rules here, not in a tool-specific file.

## What this is

The storefront and lead channel for Xing-Z, a maker of air-cooler motors and pumps. There is no checkout: every
page ends in a WhatsApp conversation. Read these before any design or copy change:

- `PRODUCT.md`: users, positioning, what may and may not be claimed.
- `DESIGN.md`: colours, type, spacing, components, do's and don'ts ("Copper & Current").

## Stack and commands

- Vite 5 + React 18 + Tailwind 3, plain JSX. 3D models use three.js; shader backgrounds use `@paper-design/shaders-react`.
- `npm run dev`: local dev server. `npm run build`: production build into `dist/`. Run the build before calling work done.
- Three pages, each its own HTML entry (see `vite.config.js`): `index.html` (home), `configurator.html` (3D
  configurator), `admin.html` (catalogue admin panel).
- `base: './'` keeps every URL relative, because GitHub Pages serves the site from `/xing-z-website/`. Build asset
  URLs with `asset()` from `src/content/site.js`, never with a leading `/`.

## Where things live

- `src/content/site.js`: site copy, contact details (placeholders until the owner supplies real ones), `asset()`.
- `src/components/`: home-page sections. `src/pages/`: page roots (Home, Configurator, Admin).
- `public/catalogue.json`: the product catalogue (names, codes, options; never prices). The admin panel edits it.
- `src/admin/github.js`: the admin panel's only backend, the GitHub contents API on this repo.
- `src/models/`: procedural three.js models per product family; `registry.js` maps families to models.
  `generated/` and `projectors/` are img2threejs output: regenerate them, don't hand-edit.
- `public/products/`, `public/parts/`, `public/models/`: published photos. `assets-src/` holds the originals and is
  gitignored.

## Hard rules

- **Never push to `main` without the owner's explicit OK.** A push to `main` republishes the live site through
  `.github/workflows`. Commit locally freely; push only when asked.
- No invented numbers, quotes, partner logos, specs or prices. Don't claim "largest manufacturer" or copper-wound
  motors (see `PRODUCT.md`). Leave a gap rather than fill it.
- WhatsApp stays the primary action on every page.
- Support both dark and light themes (`src/theme.jsx`, `ThemeToggle`). Check both when changing UI.
- Must work at phone width with no horizontal scroll.
- Never commit secrets. The admin token lives only in the owner's browser.
- Match the surrounding code: short comments that say why, the same naming and idiom.

## Working together (Claude Code + Codex)

The two agents must never edit the same files at the same time.

- **One task, one branch.** Start each task on its own branch (`claude/<task>` or `codex/<task>`), or in its own git
  worktree for parallel work: `git worktree add ../xingz-<task> -b codex/<task>`. Merge into `main` when it's done.
- **Commit before handing over.** Before switching agents, commit (or stash) so the next agent starts clean.
- **Default split of roles:**
  - Claude Code leads design, layout, copy and the 3D/visual work (it has the design skills in `.agents/skills`).
  - Codex reviews every finished change (`codex review`) and takes self-contained logic tasks (admin panel,
    catalogue handling, build and tooling fixes).
- **Handover notes.** When an agent stops mid-task, it writes what's done and what's left to `HANDOFF.md`
  (gitignored) so the other agent can continue.
- Either agent can call the other:
  - From Claude Code: `codex exec "<task>"` to delegate, `codex review --uncommitted` for a review.
  - From Codex: the `claude` MCP server (Claude Code's tools) is registered in `~/.codex/config.toml`.
