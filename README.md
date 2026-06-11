# EchoType

**Repeat, type, and remember meaningful English texts**

*Practice English typing with your own annotated texts.*

I built EchoType because I wanted to revisit English texts I actually care about — poems, quotes, essays — through repetitive typing, until words and rhythm sink in. It is meant to be quiet, focused, and meaningful — not a WPM contest.

The name comes from echo — a voice returning. The texts I choose are usually ones that already feel like my own; typing them is how I make them so.

![EchoType in action](docs/product-screenshot.png)

Since I am a Chinese native speaker, I can also pin native-language annotations above unfamiliar English words to keep them visible while typing. But the heart is the loop: choose a text I want to remember, type it, return to it.

---

## Differentiators

- **Choose your own meaningful text** — Courses are passages and short articles you pick and keep (e.g. *Stray Birds*, favorite quotes). No random word lists; the text itself is the point.
- **Quiet repetition over WPM** — The session is for low-pressure review and muscle memory, not speed leaderboards. I type the same meaningful text until it sticks.
- **Native-language annotation overlay** — Optional notes in your own language float above anchored English characters while you type, so glosses stay in context instead of a separate glossary.
- **Notes survive edits** — If you change the source text later, your notes are not silently wiped. The app shows you which notes still align and which need your attention before saving.

---

## Tech Stack

The typing loop itself is conventional React/Node/Postgres. The interesting choices are around annotation correctness — type contracts, measurement-driven layout, atomic replacement.

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **TypeScript end-to-end** | Shared contracts across web, API, and a common types package. Inclusive range-index off-by-one bugs are caught at compile time, not in misaligned overlays. |
| Contracts | **Zod in a shared package** | Same course and annotation payload parsing on client and server; mode-length rules live next to the types the editor imports. |
| API + DB | **Fastify 5 + Prisma + PostgreSQL** | Small REST surface; courses own annotations replaced atomically inside one database transaction on update. |
| Anchor snapshots | **Server-derived only** | Clients send character indices and note text; the API derives the anchored substring at save time so stored snapshots cannot be spoofed. |
| Overlay layout | **Mirror measurement + global indices** | A hidden mirror measures per-character `offsetTop` for visual-line breaks and per-glyph `getBoundingClientRect` for horizontal edges (charEdges); annotations are stored as global indices. Supports cross-line spans and mixed CJK/Latin widths (not index × average width). |
| Frontend | **React 18 + Vite + Tailwind** | Component model fits a measurement-heavy overlay; utilities keep the typing surface simple without a heavy design system. |
| State | **Zustand + TanStack Query** | Local typing UI state vs server-backed course list and mutations. |
| Regression guard | **Playwright probe (local)** | Stop-loss after overlay changes: zero measure-on-typing, stable line ranges, bounded DOM mutations per keystroke. |
| Cloud | **EC2 + RDS + S3 + CloudFront + SSM + GitHub Actions OIDC** | API on EC2 against RDS; static build to S3/CloudFront; deploy via OIDC-assumed role and SSM Run Command — no long-lived AWS keys in CI. |

---

## Core engineering challenge: keeping annotations aligned with text

The product loop is intentionally simple: pick a text, type it, repeat. The engineering depth is in making annotations stay aligned with that text — even as the user edits the source, even across line breaks and CJK/Latin glyph widths.

**Rendering:** I store annotations as global string indices, not row/column coordinates. At render time, a hidden mirror uses per-character `offsetTop` for visual-line breaks and per-glyph `getBoundingClientRect` for horizontal edges. Highlight bands and note labels are positioned from those measurements, including cross-line spans and mixed-width glyphs.

**Editing:** When the user changes the source text on an annotated course, blindly keeping old indices would point notes at the wrong words. Phase 4 replaced an earlier "content change clears all annotations" rule with a review flow:

1. Each annotation's saved text snapshot is compared to the substring at its current indices.
2. **Green** — slice still matches.
3. **Yellow** — mismatch or out-of-range; user **re-selects** a new anchor or **deletes** the note.
4. Step 3 blocks **Next** while yellow items remain; Step 4 blocks **Save**; the server rejects invalid state with structured validation errors.
5. On save, the API re-derives snapshots from the final text.

A subtle UX bug: yellow bands reused Phase 3's "click to edit note text" behavior, but users wanted re-anchoring. I split the click behavior by review state — in review mode, yellow clicks enter re-anchor flow, not note editing.

---

## Architecture

### Frontend

![Frontend architecture](docs/architecture.png)

One shared overlay component and one measurement hook (mirror spans → `offsetTop` line breaks → per-glyph `getBoundingClientRect` / charEdges) power both the typing page and the four-step course editor. The editor adds a staged state machine; Phase 4's review layer (green/yellow status, review panel, review-state click routing) sits on top without forking the renderer.

### Deployment

![Deployment architecture](docs/deployment.png)

**Terraform** provisions VPC, EC2, and RDS. The API runs in docker compose on EC2; the Vite build goes to **S3** behind **CloudFront**. **GitHub Actions** uses **OIDC** + **SSM Run Command** for backend deploy and S3 sync for the static bundle. Manual steps: `deploy/README.md`.

---

## How to run locally

**Prerequisites:** Node.js 20+ (`.nvmrc`), pnpm 9, Docker for PostgreSQL.

```bash
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
pnpm --filter @echotype/api prisma:generate
pnpm --filter @echotype/api prisma:migrate
pnpm --filter @echotype/api seed
pnpm dev          # API :3001, web :5173 (proxies /api)
```

Open `http://localhost:5173` → **Courses** → create or edit a course → **Type this**.

```bash
pnpm run typecheck
node apps/web/scripts/phase2-probe.mjs   # needs dev servers; expect SUMMARY PASS
```

Reset DB: `pnpm --filter @echotype/api prisma:reset` then `seed`.

I ship in phases with manual gates (`docs/project-kickoff.md`); after overlay changes I run the Playwright probe locally. Project rules in `.cursor/rules/` keep AI-assisted sessions inside phase scope.

---

## Implementation status

| Status | Item |
|--------|------|
| ✅ | **Phase 1** — Shared Zod contracts, API validation, atomic annotation replacement, server-derived anchor snapshots |
| ✅ | **Phase 2** — Annotation overlay (mirror offsetTop + charEdges, cross-line highlights, note slots, typing-page integration) |
| ✅ | **Phase 3** — Four-step course editor (pick state machine, overlap rules, save + validation regression) |
| ✅ | **Phase 4** — Annotation review (yellow/green diff, re-anchor/delete, block Next/Save) |
| 🚧 | **Mode-specific list pages** — Short vs Article routes (today: unified course list) |
| 📋 | **AWS Cognito auth** — Replace demo-user auth shim |
| 📋 | **CloudFront production cutover** — Infra ready; blocked on AWS Support |
| 📋 | **Polish** — Search/filter/sort, Sentry, rate limiting, session timer UX |

---

## Further reading

- **`docs/project-kickoff.md`** — Full product spec and phase history (Chinese).
- **`deploy/README.md`** — Terraform, SSM access, cloud deploy.

Private portfolio project — contact me for access or demo.
