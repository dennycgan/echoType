# echoType — Engineering State

> Current engineering state. Read this FIRST before starting work in a new chat.
> Maintenance: facts only, no history. Update = rewrite the relevant line.
> NEVER append paragraphs here.
> Conflict priority: code/git > this file > DECISIONS.md > local kickoff (if present).
> History / rationale -> DECISIONS.md. Private product notes -> docs/project-kickoff.md (local only, gitignored).

## Capability Roadmap (project-level; top-to-bottom = execution order; YOU ARE HERE)
- [x] Annotation feature
- [x] Cloud deploy (CloudFront cutover; live at *.cloudfront.net + post-deploy fixes)
- [x] Typing experience (auto-loop, newline skip, session flow, IME composition; ADR-0006/0007/0008)
- [x] Course management (mode routes, card list, DELETE, description, search/sort, collections; ADR-0009–0013)
- [x] Course stats (per-session + cumulative; STATS.md contract; ADR-0014 phases 1–7)
- [x] Auth (Cognito; replaces demo-user shim; required before sharing externally)
- [x] Custom domain (echotype.ink — ACM + CloudFront alias + Cognito URLs; unblocks Google sign-in → Auth follow-up; ADR-0022)
- [x] Ops & safety (Sentry + disclaimer/error states; ADR-0023/0024; CloudWatch/rate limiting deferred)
- [x] Google sign-in (Cognito Google IdP + account linking; ADR-0025–0028)
- [x] Link previews & mobile notice (desktop banner + share assets; ADR-0041)
- [~] (maintenance) Polish & UX improvements — ongoing    <-- YOU ARE HERE


> Each line is a capability, not a sub-step. Completed capabilities stay one line
> (internal history -> git/DECISIONS). Only the ACTIVE capability is expanded in
> the Phase Roadmap below.
> Top-to-bottom = current execution order. Reorder if priorities change; never leave it unordered.

## Phase Roadmap (active capability only)
Active capability: (maintenance) Polish & UX improvements
- (ongoing) Owner-priority polish from Known debt and real-usage feedback; no gated phase list

> Legend: [x] done  [~] in progress  [ ] todo  (blocked) noted inline
> When the active capability changes, replace this entire Phase Roadmap with the
> new capability's phases and move YOU ARE HERE above.

## Now working on (describe ONLY the in-progress item)
- Goal (one line): maintenance polish (no active gated phase)
- Sub-steps done: Link previews Phase 1–3 (banner `b881ca1` / `7a4d32e`; share assets `a6b1124`)
- Next step: owner priority (e.g. textarea padding scroll polish if pursued)
- Related decisions: ADR-0041

## Contract pointers (don't memorize, go read the source)
- Stats metrics (definitions/formulas only): docs/STATS.md
- Course stats serialize: packages/shared/courseStats.ts, apps/api/src/courseStats.ts
- User practice summary (home): GET `/api/stats/summary` → `apps/api/src/routes/stats.ts`, `packages/shared/practiceSummary.ts`; UI `apps/web/src/components/PracticeSummary.tsx`; formatters `formatPracticeDuration` / `formatPracticeSummaryLines` in `packages/shared/practiceDisplay.ts` (ADR-0032)
- Card display helpers: packages/shared/practiceDisplay.ts
- Last-practice winner (read-time): apps/api/src/modeLastPractice.ts
- Collection rollup: packages/shared/categoryRollup.ts, apps/api/src/routes/categories.ts
- Session types/API: packages/shared/session.ts, apps/api/src/routes/sessions.ts
- Types/validation: packages/shared/course.ts, packages/shared/category.ts
- Course + collection routes: apps/api/src/routes/courses.ts, apps/api/src/routes/categories.ts (PUT preserves categoryId when omitted — ADR-0037; moves via PATCH /courses/category)
- Typing UI: apps/web/src/pages/TypingPage.tsx
- Typing Night mode (shell only): apps/web/src/lib/nightMode.ts, NightModeProvider.tsx; Tailwind `serika` tokens in `apps/web/tailwind.config.js`; probe `apps/web/scripts/night-mode-probe.mjs` (ADR-0033 palette; ADR-0036 tab-memory override)
- Site DocumentDark (sole `html.dark` writer): apps/web/src/RootLayout.tsx, apps/web/src/lib/DocumentDarkProvider.tsx; probe `apps/web/scripts/site-dark-probe.mjs` (ADR-0036)
- Typing scroll + immersive caret pin: apps/web/src/lib/typingScroll.ts (ADR-0031)
- Session timer + pause: apps/web/src/components/typing/SessionTimerStrip.tsx, TimerEndDialog.tsx, apps/web/src/lib/sessionTimer.ts; probe `apps/web/scripts/phase7-pause-probe.mjs`
- Typing Back paths: apps/web/src/lib/collectionPaths.ts
- Mode list + collections UI: apps/web/src/pages/CourseListPage.tsx, CollectionDetailPage.tsx
- List sort options + localStorage: apps/web/src/lib/courseListSort.ts
- Card stats UI: apps/web/src/components/card/CardPracticeStats.tsx
- Annotation rendering: apps/web/src/components/AnnotatedText.tsx + apps/web/src/components/annotated-text/useTextMeasurement.ts; NotePopover placement `notePopoverPlacement.ts` (ADR-0039)
- Editor + review: apps/web/src/components/editor/useCourseEditor.ts, reviewUtils.ts, AnnotatedTextEditor.tsx
- Deploy: deploy/README.md, .github/workflows/deploy.yml, .github/workflows/deploy-web.yml
- CI: .github/workflows/ci.yml — install, prisma generate, typecheck, test (ADR-0040); architecture suite is first segment of root `pnpm test` (ADR-0044)
- Architecture guards: `test/architecture/` (`run.mjs` + helpers; workspace deps, Prisma API-only, DocumentDark sole `html.dark` writer); `pnpm test:architecture` for local iteration only (ADR-0044)
- Desktop notice banner: apps/web/src/lib/desktopNotice.ts, apps/web/src/components/DesktopNoticeBanner.tsx (ADR-0041)
- Share assets (Phase 3): `apps/web/public/og/echotype-og.png`, `favicon.svg`, `favicon-32x32.png`; README `docs/echotype-sonnet-18-readme.png` + `docs/echotype-annotations.gif`; local scripts `apps/web/scripts/share-assets-*.mjs` (`capture:share-{image,og,gif,favicon}`)
- Sentry (web): apps/web/src/lib/sentry.ts, vite.config.ts (`@sentry/vite-plugin`); probe `apps/web/scripts/ops-sentry-probe.mjs`; SSM `/echotype/SENTRY_DSN_WEB`
- Sentry (API): apps/api/src/sentry.ts, `apps/api/src/routes/debug.ts` (`SENTRY_DEBUG=1` only); probe `apps/api/scripts/ops-sentry-probe.mjs`; SSM `/echotype/SENTRY_DSN_API`
- Privacy + page status (web): apps/web/src/content/legal/privacy.ts, `pages/legal/PrivacyPage.tsx`, `components/page-status/`, `lib/apiErrors.ts`; probe `apps/web/scripts/ops-phase2-probe.mjs`
- Custom domain (Terraform): infra/acm.tf, infra/cloudfront.tf, `custom_domain` variable; outputs `site_url`, `acm_validation_records`; CloudFront `price_class = PriceClass_All` (ADR-0043)
- RDS (Terraform): infra/rds.tf — `backup_retention_period = 1`, `deletion_protection = true`, fixed `backup_window`; tear-down + pre-migration snapshot notes in `deploy/README.md` (ADR-0042)
- API JWT auth: apps/api/src/auth/, probe `apps/api/scripts/auth-phase3-jwt-probe.mjs`
- Web auth (Cognito SPA): apps/web/src/auth/, apps/web/.env.example, probe `apps/web/scripts/auth-phase4-probe.mjs`, `auth-phase5-probe.mjs`, `auth-phase6-probe.mjs`
- Google sign-in Phase 1 (infra): `infra/cognito.tf`, `packages/shared/src/cognitoOAuth.ts`, probe `apps/api/scripts/auth-google-phase1-probe.mjs`; GCP OAuth redirect = `terraform output -raw google_oauth_redirect_uri`
- Google sign-in Phase 2 (web + linking): `apps/web/src/auth/cognitoOAuthExchange.ts`, `NicknameSetupModal.tsx`; API `apps/api/src/auth/federatedLink.ts`, `federatedSync.ts`, `routes/federatedAuth.ts`, `routes/emailStatus.ts`; PreSignUp `infra/lambda/cognito_presignup/`, `infra/cognito_presignup.tf`
- Google L2 maintenance (unmaterialized native + stale Hosted UI): API `ensureLinkedNativeAccount` in `routes/federatedAuth.ts`; web stale-session retry + `autoReuse` in `cognitoOAuthExchange.ts` / `HomePage.tsx`
- Account API + page: packages/shared/src/account.ts, apps/api/src/routes/account.ts, apps/web/src/pages/AccountPage.tsx
- Google-only password setup (identity reconstruction): apps/api/src/auth/googlePasswordSetup.ts, `POST /account/set-password`; PreSignUp `AdminCreateUser` relaxation in `infra/lambda/cognito_presignup/handler.py`; shared re-auth copy `apps/web/src/auth/passwordMessages.ts`
- Guest course catalog (local): apps/web/src/guest/guestCoursesStore.ts, apps/web/src/guest/useCourseCatalog.ts
- Account vs guest writes: useCourseCatalog (data); collection !isGuest UI (CourseListPage, CollectionDetailPage); useRequireAuthAction (e.g. New collection); TypingPage disabled Save
- Onboarding catalog (shared): packages/shared/src/onboardingCatalog.ts (re-exported in apps/api/prisma/fixtures/courseCatalog.ts)
- Onboarding seed API: POST apps/api/src/routes/onboarding.ts (`/api/onboarding/seed`); hook apps/web/src/auth/useOnboardingSeed.ts
- Onboarding materialize: apps/api/prisma/fixtures/materializeCourse.ts (`materializeOnboardingForUser`)

## Do NOT touch (unless explicitly opening a new phase)
- annotation measurement hook (charEdges per-glyph measurement) — ADR-0002
- Phase 4 review state machine / reviewPickGate (annotation editor — not course-mgmt Phase 4)
- server-side deriveAnchoredText (client never sends anchoredText) — ADR-0001

## Known debt / intentionally deferred
| Capability | Item | Reason | Picks it up | Related ADR |
|---|---|---|---|---|
| Course stats | Typing stats lost on browser close / crash without Save | MVP: manual Save only; no beforeunload | intentional (ADR-0014) | ADR-0014 |
| Course stats | Timer visit abandoned via external close before end modal | Same as above | intentional (Phase 6) | ADR-0014 |
| Course stats | WPM uses English 5-chars-per-word for all scripts; no Chinese (CPM) line | MVP single formula (STATS.md §2); Chinese-primary product not in scope | future if Chinese courses ship | ADR-0006 |
| Course mgmt | Collection detail in-page search | MVP: sort only on detail; mode list has global search | future polish | ADR-0013 |
| Course mgmt | Full markdown in description (headings, `[text](url)` syntax) | Phase 3 plain text + URL linkify on typing/collection detail only; no markdown renderer | future polish if users paste rich notes | ADR-0011 |
| Typing | English course + accidental IME shows red diff only, no explicit "switch to English" guidance | Phase 3 chose IME-as-valid-input (ADR-0008) over kickoff #7 banner/pause; red diff implies the error | future polish / real-usage feedback | ADR-0008 |
| Typing | Immersive mode: no keydown refocus after textarea blur — user must click passage | MVP: amber overlay + passage mousedown refocus (`3d0f3e9`); global keydown refocus deferred | future polish if self-testing reports friction | ADR-0021 |
| Typing | After a paragraph, cursor sits on the next non-`\n` char while blank lines remain visible above (ADR-0007 greedy skip) | Cursor means “next real keystroke lands here”; typists OK, content authors may find it surprising | revisit only if typist feedback shows friction | ADR-0007, ADR-0030 |
| Annotation | false-green (duplicate substring, no index shift) | MVP skips index shift | user reanchor | — |
| Annotation | Overlay measurement = mirror offsetTop (lines) + per-glyph getBoundingClientRect (charEdges); NOT Range.getClientRects() | Phase 2 deliberate | do not revert without ADR | ADR-0002 |
| Auth | Guest typing progress not restored after login | In-memory session only; sign in before starting a session you intend to save | intentional (ADR-0015 §16) | ADR-0015 |
| Auth | Email change | Deferred if implementation requires extra SES/Lambda cost beyond existing Cognito verify path | Auth Phase 5 cost check, or post-MVP | ADR-0015 |
| Auth | Google OAuth consent screen shows Cognito domain instead of app name "echoType" | Two separate issues: (1) Google brand verification required to show app name on consent screen; (2) Cognito custom domain (auth.echotype.ink) would replace long Cognito URL but still not show app name without verification | Future polish | ADR-0028 |
| Auth | Google-only user password setup requires identity reconstruction (delete `Google_*` + AdminCreateUser + migrate Postgres id) because a Cognito federated username does not accept email-based SRP auth | Cognito architectural constraint; Firebase/Auth0 would not require this | No fix planned; monitor Sentry for Step 5 compensation failures | ADR-0029 |
| Auth | Google account chooser may appear twice on L2 linking path (multi-account Chrome users) | Cognito Hosted UI cannot forward login_hint to Google; architectural constraint | Fix: redesign Google→Cognito initiation to bypass Hosted UI so login_hint can reach Google | ADR-0027 |
| Ops & safety | CloudWatch structured logging/alarms (planned Ops Phase 2; never shipped) | Current user volume does not warrant | Revisit when user volume warrants | ADR-0023, ADR-0024 |
| Ops & safety | API rate limiting (planned Ops Phase 3; never shipped) | Same | Same | ADR-0023, ADR-0024 |
| Custom domain | Wildcard `*.echotype.ink` CNAME still points to Porkbun parking | MVP canonical host is apex only (ADR-0022); ACM cert covers wildcard for future subdomains | future if www or subdomain needed | ADR-0022 |
| Frontend | No semantic color tokens; under scan `apps/web/src/**/*.{ts,tsx}`, 46 files use hardcoded Tailwind scales (bg-white, slate-*) plus per-component dark: serika overrides | Intentional: dark: path without CSS variables (ADR-0036); no color guard until semantic tokens exist (ADR-0044) | Future: introduce semantic tokens, then color guard | ADR-0036, ADR-0044 |
| Tooling | Node 20 `node --test` can exit 0 when a shell glob matches nothing or a listed file path is missing. Affected scripts: packages/shared `test` (`src/*.test.ts`); apps/web `test:auth` (`src/auth/*.test.ts`, `src/guest/*.test.ts`), `test:layout` (`src/components/annotated-text/*.test.ts`), `test:typing`, `test:sentry`, `test:ops-phase2`; apps/api `test:auth`, `test:sentry`, `test:auth-google-phase1`, `test:auth-google-phase2` | Recorded while adding architecture guards; not fixed this round | reuse `test/architecture/run.mjs` fail-loud pattern later | ADR-0044 |
| Typing | Site DocumentDark (auto) and typing Night override (tab memory) coexist; typing can diverge from system within a tab until reload or Follow browser setting | Intentional C1-memory + retained Night switch (ADR-0036) | Revisit if users find divergence confusing | ADR-0036 |
| Ops & safety | AWS Free account plan: planned Paid upgrade ~2026-11-20; credits projected to exhaust ~2026-11-26 (~$1.12/day from ~$29.75 on 2026-10-30); hard deadline 2026-11-29 | Free plan end suspends the account; site and data become unavailable until upgrade within the post-expiry window | upgrade to Paid before credits run out or 2026-11-29; at upgrade set a $50/mo cost Budget (Include tax Yes, Include credits No; 100% actual + 100% forecast only — no 80% alert) and remove the zero-spend alert; then raise RDS retention `1 → 7` (nonzero→nonzero, no outage) and append ADR-0042 | ADR-0042 |
| Ops & safety | Full Terraform plan has three unrelated pending entries: Cognito Google IdP normalization, GitHub OIDC thumbprint refresh, and cascading deploy-role assume-policy recompute | RDS / CloudFront changes used targeted plans; an ordinary apply would include these | assess separately before the next non-targeted Terraform apply | ADR-0042 |
| Ops & safety | RDS `backup_retention_period = 1` (interim on Free plan); this account rejected 7 and 3, accepted 1 | Free plan limit; not claimed as a universal Free-plan maximum | after Paid upgrade: set retention 7 (no outage), keep deletion protection, keep-latest manual snapshot for migration deploys | ADR-0042 |
| Ops & safety | RDS `db.t4g.micro` memory is tight but adequate (2026-10: FreeableMemory min ~113 MiB; SwapUsage stable ~25–29 MiB; connections ≤3; disk latency low) | Smallest practical class; not evidence of thrashing today | if SwapUsage starts rising sustainably, revisit instance class; no CloudWatch alarm for now | — |
| Ops & safety | RDS storage is unencrypted at rest (`storage_encrypted` unset / false) | Encryption cannot be enabled in place; needs snapshot → encrypted copy → restore to a new instance → cutover (parallel migration; deletion protection and Terraform state must be handled carefully) | evaluated; default do not migrate — low data sensitivity vs high cutover risk; if a concrete need appears, follow that plan after Paid upgrade + retention 7 are stable | — |
| Ops & safety | `terraform fmt -check` fails on four pre-existing files: `infra/cognito.tf`, `infra/cognito_presignup.tf`, `infra/iam.tf`, `infra/terraform.tfvars` | Unrelated formatting drift; not touched by RDS / CloudFront work | separate fmt-only pass when convenient | — |
