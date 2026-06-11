# EchoType — Engineering State

> Current engineering state. Read this FIRST before starting work in a new chat.
> Maintenance: facts only, no history. Update = rewrite the relevant line.
> NEVER append paragraphs here.
> Conflict priority: code/git > this file > DECISIONS.md > kickoff (vision).
> History / rationale -> DECISIONS.md. Product vision/spec -> kickoff.

## Roadmap (mark YOU ARE HERE)
- [x] Phase 1 Data contracts
- [x] Phase 2 Rendering
- [x] Phase 3 Editor (3.0 / 3.1 / 3.2)
- [x] Phase 4 Review (4.0 / 4.1 / 4.2)
- [~] Mode-specific list pages (short / article routes)   <-- YOU ARE HERE
- [ ] Cognito auth
- [ ] CloudFront cutover (blocked: AWS Support)

> Legend: [x] done  [~] in progress  [ ] todo  (blocked) noted inline
> Rule: whenever a phase is split finer (X -> X.1/X.2), update this tree in the
> same turn.

## Now working on (describe ONLY the in-progress item)
- Goal (one line): Split unified CoursesPage into mode-specific list routes; preset mode on create; read-only mode on edit.
- Sub-steps done: Phase 3.0 debt documented in kickoff; mode field + editor modal exist; unified list works.
- Next step: Add short/article routes; filter courses by mode; remove mode radio from modal when opened from mode page.
- Related decisions: none yet

## Contract pointers (don't memorize, go read the source)
- Types/validation: packages/shared/course.ts
- Annotation rendering: apps/web/src/components/AnnotatedText.tsx + apps/web/src/components/annotated-text/useTextMeasurement.ts
- Editor + review: apps/web/src/components/editor/useCourseEditor.ts, reviewUtils.ts, AnnotatedTextEditor.tsx
- Deploy: deploy/README.md, .github/workflows/deploy.yml, .github/workflows/deploy-web.yml

## Do NOT touch (unless explicitly opening a new phase)
- annotation measurement hook (charEdges per-glyph measurement) — ADR-0002
- Phase 4 review state machine / reviewPickGate
- server-side deriveAnchoredText (client never sends anchoredText) — ADR-0001

## Known debt / intentionally deferred
| Item | Reason | Owner / picks it up | Related ADR |
|---|---|---|---|
| create-mode content edit skips review | Phase 4 scoped to edit flow only | after mode pages or Cognito | — |
| CoursesPage not split into routes | Phase 3.0 debt | mode list pages (current) | — |
| false-green (duplicate substring, no index shift) | MVP skips index shift | user reanchor | — |
| Step 1 no illegal-character filter | Never implemented; length/mode only | TBD | — |
| Typing page: no click-to-view full note (hover title only) | Phase 2 scope | polish phase | — |
| Overlay measurement = mirror offsetTop (lines) + per-glyph getBoundingClientRect (charEdges); NOT Range.getClientRects() | Phase 2 deliberate | do not revert without ADR | ADR-0002 |
