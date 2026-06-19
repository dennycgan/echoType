# EchoType — Decision Log (ADR)

> Major technical/engineering decisions. Each entry is immutable: never edit or
> delete its reasoning. To overturn a decision, write a NEW entry and only flip
> the old entry's Status line to "Superseded by ADR-xx".
> The top "Plain summary" line is for the project owner to verify — it must be
> understandable without deep technical knowledge.
> Append new entries at the end; numbering increments. Always record the date
> and a commit/PR anchor.
>
> Status values: Accepted | Superseded by ADR-xx (date) | Deprecated (no
> replacement) | Reverted-in-code (implementation rolled back; see note)
>
> Revert reconciliation: if a code revert crosses the implementation point of an
> Accepted ADR, do NOT silently leave the log stale. Either (a) write a new ADR
> explaining the rollback, or (b) flip the old entry's Status to
> "Reverted-in-code (date, reason)" and add a one-line note. The original
> reasoning stays untouched.

---

## ADR Template
- Status: Accepted (YYYY-MM-DD)
- Commit/PR anchor: <sha or #PR>
- Plain summary (owner reads this): <one plain-language sentence>
- Context / what problem forced this:
- Decision (what was chosen):
- Rejected alternatives (why not B):
- Consequences (cost / constraints / limits on future work):
- Supersedes / superseded-by: none

---

## ADR-0001 — Anchor snapshot derived server-side; client never sends it
- Status: Accepted (2026-06-03)
- Commit/PR anchor: 021c62d
- Plain summary: The client only sends "from char N to char M + the note text";
  the server slices the original text itself, so the stored snapshot can't be
  forged.
- Context: Each note stores a snapshot of the text it was anchored to, used for
  later drift comparison. Trusting a client-uploaded snapshot would let it be
  tampered with.
- Decision: Client PUT excludes anchoredText; server deriveAnchoredText writes it.
- Rejected alternatives: Client uploads anchoredText directly — forgeable.
- Consequences: One extra server slice; security for negligible cost. All future
  edit flows must keep this; do not bypass.
- Supersedes / superseded-by: none

---

## ADR-0002 — Horizontal annotation positioning via per-glyph pixel measurement (charEdges)
- Status: Accepted (2026-06-09, Phase 4.2)
- Commit/PR anchor: 8204b7c
- Plain summary: When full-width and half-width punctuation are mixed, computing
  position as "Nth char x fixed char width" drifts cumulatively, so we measure
  each glyph's actual pixel edges instead.
- Context: Mixed full-width vs half-width punctuation made the highlight band
  drift out of alignment with the text.
- Decision: Measure per-glyph getBoundingClientRect on the mirror to get charEdges.
- Rejected alternatives: index x single charWidth — drifts under mixed widths.
- Consequences: More accurate; re-measured only on layout change
  (content/width/font), never per keystroke, to preserve typing performance.
- Supersedes / superseded-by: none

---

## ADR-0003 — Single CloudFront distribution serves SPA + /api (same-origin HTTPS)
- Status: Accepted (2026-06-11)
- Commit/PR anchor: cc9c378
- Plain summary: The public site is one HTTPS address on CloudFront — pages come
  from a private S3 bucket, API calls under /api go to EC2; the browser never
  talks to plain HTTP or a second domain, so no mixed-content or CORS headaches.
- Context: New AWS accounts cannot create CloudFront until Support verifies the
  account. Browsers block HTTPS pages calling HTTP APIs (mixed content). Hosting
  the SPA on CloudFront while the API stayed on EC2:80 would fail without
  end-to-end HTTPS or same-origin routing.
- Decision: One CloudFront distribution, two origins — default `/*` → S3 (OAC,
  private bucket); ordered `/api/*` → EC2 EIP over HTTP (server-to-server).
  Backend routes live under `/api` prefix; `WEB_ORIGIN` = CloudFront URL in SSM.
  EC2 port 80 locked to CloudFront origin-facing prefix list only.
- Rejected alternatives: SPA on CloudFront + API on `http://EIP` — mixed content;
  separate API subdomain without custom domain/ACM — extra cost/complexity for MVP.
- Consequences: Custom domain later needs ACM + DNS on this distribution. First
  deploy order: terraform apply → backend workflow → frontend workflow. Destroy
  rebuild gets a new CF domain — update SSM `WEB_ORIGIN` via apply, no hardcoded
  URLs in repo.
- Supersedes / superseded-by: none

---

## ADR-0004 — Course content: line-ending normalization + control-character filter
- Status: Accepted (2026-06-11)
- Commit/PR anchor: pending Sub-phase B merge
- Plain summary (owner reads this): When users paste from Word or Windows, line
  breaks are automatically turned into normal `\n`; besides that, only regular
  visible characters are allowed — tabs and other invisible control characters
  are blocked, but Chinese, emoji, and punctuation are fine.
- Context: Step 1 never filtered illegal characters; pasted `\r\n` text could
  shift annotation indices relative to what users see, and control characters
  (tab, NUL, etc.) are data-hygiene problems, not user expression.
- Decision:
  1. **Line-ending normalization** before all validation and DB writes:
     `\r\n` → `\n`, lone `\r` → `\n` (same approach as Git `core.autocrlf`,
     Node `fs`, and most HTTP frameworks — absorb OS differences, do not punish
     the user).
  2. **Control-character filter** on normalized content: reject Unicode `\p{Cc}`
     except `\n`; do not restrict Chinese, emoji, or punctuation.
  3. **Shared validation** in `packages/shared`: `normalizeLineEndings`,
     `validateContentCharacters`, `prepareCourseContent`; client Step 1 and
     server API both use it; stored content is always LF-only.
  4. **Edit-load remap**: when opening a course whose DB content still contains
     legacy CRLF, remap annotation indices once on editor init (client only).
- Rejected alternatives:
  - Reject `\r` outright — punishes high-frequency Word/Windows paste.
  - Client-only validation — API bypassable.
  - Server-side annotation index remap on API payloads — hides malformed clients;
    422 after normalize is enough.
- Consequences:
  - New saves are LF-only; `\t` and other control chars blocked with plain-language errors.
  - Legacy courses with CRLF get silent index remap on first edit open (console log for debug).
  - Direct API callers must send indices relative to normalized content or get 422 bounds errors.
- Supersedes / superseded-by: none
