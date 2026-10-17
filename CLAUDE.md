# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Delve** is a cozy/absurd, D&D-flavoured idle/incremental game (Trimps / Realm Grinder inspired) played as an installable PWA on the owner's Android phone. You are the "Digging God": a colony digs a vertical mine (economy) while a separate, always-running Expedition (combat) pushes through zones. `DESIGN.md` is the living design doc and records decisions, build status and what's next — read it before design work and update it when design changes.

- Live: https://garebear72.github.io/delve/ — repo `Garebear72/delve` (public, branch `main`).
- Every push to `main` deploys via `.github/workflows/deploy.yml` (GitHub Pages). The app checks `version.json` and shows an "Update available" banner on the phone.

## Commands

```bash
npm run dev        # Vite dev server (also .claude/launch.json "delve", port 5173)
npm run build      # tsc --noEmit + vite build (this is the check; there is no linter or test suite)
npm run typecheck  # types only
npm run preview    # serve the built dist (.claude/launch.json "delve-built", port 4173)
```

Deploy = commit + `git push`, then confirm the Pages run:
`gh run watch $(gh run list -R Garebear72/delve -L 1 --json databaseId --jq '.[0].databaseId') -R Garebear72/delve --exit-status`

### Testing / balance (no test framework)
Verification is done in the dev server's page (Browser pane) with JavaScript:
- `window.delve` (dev only) is the live store: `delve.state`, `delve.d` (derived numbers).
- Headless simulations: dynamically import game modules and drive a fresh state, e.g.
  `const { newGame } = await import('/src/game/state.ts'); const { advance, catchUp } = await import('/src/game/sim.ts');`
  then `advance(s, seconds)` / `catchUp(s, seconds)`; call `setQuiet(true)` from `/src/game/events.ts` to silence toasts.
- `tools/combat-bench.js` (import it in the page) reports how far a squad/gear setup gets in 15 minutes and whether it beats a guardian. Use it after any combat-number change.
- The Browser pane throttles `requestAnimationFrame` when hidden, so time-based checks must run headlessly, not by waiting on the live loop.
- The in-game Menu → Developer mode has speed ×10–×1000, resource/depth/zone cheats, skill level controls, and "Simulate 1h away".

## Architecture

TypeScript + Vite, no framework. Canvas for the mine and battle views; DOM (rebuilt as HTML strings and patched with `morphdom`) for everything else.

- **`src/data/`** — all content as data. `defs.ts` (resources, jobs, floors, biomes, guardians, classes, enemies, items, relics, gear, research, Divine tree, races, gods, achievements, tuning constants) and `skills.ts` (skills, tree nodes, run perks, `STAT_INFO`, XP sources). Add content here; most systems pick it up automatically.
- **`src/game/state.ts`** — `GameState = { run, meta }`. `run` resets on prestige; `meta` is permanent (Divine Favor/tree, achievements, collection, skill XP and tree allocations, loadout). `migrate()` fills missing fields from fresh defaults and `sanitize()`s unknown ids, so **new fields only need a default in `newRun`/`newMeta`** to stay save-compatible.
- **`src/game/calc.ts`** — `derive(s)` computes everything derived (rates, caps, max pop, idle/free/reserved colonists, dig/tap power, squad cap, blocked guardian…); `squadStats`, `enemyStats`, `pendingFavor`, `canPrestige`. Pure functions of state; call freely.
- **`src/game/sim.ts`** — `tick(s, d, dt)` advances production, growth/starvation, digging and combat. `advance` uses 0.25s steps; `catchUp` (offline) uses large steps but combat always sub-steps at 0.25s so offline matches live. Combat is discrete hits: each class swings on its own timer (grouped into ≤6 volleys), the enemy on its own timer, heals in 2s pulses.
- **`src/game/skills.ts`** — RuneScape XP curve (1–99), `addXp`, skill points (spread evenly 1→99 so 99 = `TREE_MAX`, no other point sources), learn rules (tiers, `req`, pick-one `group`s), run perks, ability loadout. `bonuses(s)` sums every node/perk into a `Record<Stat, number>` and is **cached** — any code that mutates `meta.alloc`/`run.perks` in place must go through the functions here (they bump the cache epoch). Stats are applied in `calc.ts`/`sim.ts`/`actions.ts`.
- **`src/game/actions.ts`** — every player action (tap dig, build, jobs, research, squad plan, gear, Divine, prestige). **`session.ts`** — load/save/offline catch-up and the "welcome back" report. **`save.ts`** — 5 localStorage slots, backup rolled every 10 min, export/import (`DELVE1:` + base64 JSON).
- **`src/game/events.ts`** — tiny bus. The sim emits `hit`/`hurt`/`heal`/`kill`/`tap`/`dug`/`toast`/…; renderers and UI subscribe. `setQuiet(true)` (used during offline catch-up) drops cosmetic events.
- **`src/render/`** — `mine.ts` (scrolling cross-section, tap-anywhere-to-dig, per-row build/⚙ buttons, multi-touch), `combat.ts` (battle view driven by sim events), `sprites.ts` (pixel art defined as text grids + palette; `icon()` gives `<img>` data URLs for the DOM).
- **`src/ui/`** — `ui.ts` is the shell: top bar, tabs, slide-up sheet, toasts, modals, a single delegated click handler dispatching on `data-act`/`data-arg`, and `history.pushState` so Android back closes panels. Panels (`panels.ts`, `skillsPanel.ts`) return HTML strings re-rendered every 250ms; `morphdom` skips canvases and focused inputs.
- **`src/main.ts`** — boot, rAF loop (advance → render → 4 Hz UI → 10 s autosave), visibility handling (save on hide, offline catch-up on return), update checks, service worker (`public/sw.js`: network-first pages, cache-first hashed assets, never caches `version.json`).

Key flows: tabs/features unlock progressively (Battle after building a Barracks; Divine after defeating the first guardian, which is also required to prestige). Guardians seal each biome boundary and must be beaten in Battle before digging continues.

## Working with the owner

- They are not a programmer; explain changes in plain language and keep updates short.
- **Discuss design-shaping choices before building** (genres, new systems, progression rules) — ask focused, numbered questions. Small fixes and clearly-requested changes can go straight to implement → verify → deploy.
- They care a lot about pacing: progression must be slow and earned (no free points, no maxing overnight). Re-check pacing with headless sims after touching XP, costs or combat numbers, and report the measured numbers.

## Environment gotchas (Windows)

- Don't rewrite source files with PowerShell `Get-Content`/`Set-Content` — it corrupts UTF-8 (emoji and `·`/`—` are everywhere in UI strings). Use the Edit/Write tools.
- PowerShell mangles quoted commit messages passed to git; write the message to a file and use `git commit -F <file>`.
