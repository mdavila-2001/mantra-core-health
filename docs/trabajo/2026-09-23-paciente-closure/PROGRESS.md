# SDD ledger — plan: /Users/josejeremias/Desktop/Mantra Core Technologies/Mantra Core Health/MetaPrompts/PLAN_PACIENTE_01_METAPROMPT_17b41ce468a1_2026-09-23/PATIENT_PLAN_01_METAPROMPT_2026-09-23.md

## Scope and baseline identity

- User clarification (2026-09-24): execute the frontend portion only; leave backend work as **PENDIENTE CRÍTICO**. Do not edit API, model, `.env`, or `proxy.conf.json`.
- Functional source `SOURCE.md` SHA-256 verified: `17b41ce468a147a4a4e97cc3b028869bed4088fe314845e3e8bf3f28f7f2b9b5`.
- Isolated FE worktree: `wt-patient-run-2026-09-24`, branch `justin/patient-closure-h1`, audited starting commit `4fd9f9f9ef26a0a166a5d724bd97bdf4e3d30ec8`.
- Concurrent patient-pharmacy worktree has uncommitted edits under `where-to-buy`, `pharmacy-orders`, and `campaign-detail`; do not edit or publish those files from this branch. The diagnostic-order component spec is also modified in the active patient-imaging worktree; keep that path out of this branch's diff.
- No `.codex/coordination/project.yaml` marker exists in the primary worktree, so no coordination board or claim was created.

## Rulings and interface preflight

- Ruling: execute FE M2 work against existing FE clients/contracts only; keep all backend/API/model M1 items explicitly PENDIENTE CRÍTICO — the user narrowed authority to frontend. Cost if wrong: some UI acceptance remains blocked until backend behavior is implemented and verified.
- Ruling: preserve source IDs (`H*.S*.M*`) and use them as ledger task IDs. The source plan has no numeric `## Task N` sections, so the task-brief generator cannot create its standard briefs. The task-done runner accepts the source IDs and has recorded the focused runs in the ignored workspace; this tracked file keeps the human-readable progress. Cost if wrong: process artifacts differ, but source requirements remain unchanged and progress is auditable.
- Interface row: backend M1 produces API/DTO contracts consumed by FE M2. Static audit in `CONTRATOS.md` describes P01 as existing at the audited SHAs; FE work may verify only fields exposed by current clients and must not invent server behavior. Persisted M3 and API-owned acceptance remain pending unless independently verifiable without changing backend code.
- Interface row: H1.S1 registration UI produces `PatientRegistration`, consumed by `IamClient.registerPatient`; tests must prove optional names remain optional and names/apellidos stay separate.
- Baseline at `4fd9f9f`: `corepack yarn test --watch=false` → 578/579 files passed; 7,308/7,310 tests passed, with 2 failures in `src/app/features/shell-layout/shell-layout.spec.ts` (`el menú solo ofrece rutas que existen`; `sin rótulo que las agrupe, las cosas parecidas siguen saliendo seguidas`). These are baseline failures, not hidden or weakened.

## Tasks

- H1.S1.M2 — FE UNIT VERIFIED; `corepack yarn test --watch=false --include=src/app/features/auth/register-patient/register-patient.spec.ts` → 1 file / 115 tests passed. Existing form/client/spec cover optional second/third/additional names, separated surnames, explicit payload projection, and success/error behavior; no production edit was needed. PAC-E02 persistence/duplicate behavior remains blocked by backend M1/M3.
- H1.S2.M2 — FE UNIT VERIFIED; same command/spec → 1 file / 115 tests passed. Age is derived by birthday; tests cover no date, birthday boundary and one-year singular, but not a future-date case explicitly. Catalog failure is explicit and occupation is optional. D03 (official SEGIP source/count) and backend persistence remain pending; UI does not label the current catalog as certified SEGIP data.
- H1.S3.M2 — FE UNIT VERIFIED WITH BLOCKER; `patient-profile-edit.spec.ts` 52/52 passed after adding distinct home/work address serialization and explicit foreign-work locality guidance. The existing client separately sends both coordinate pairs and permits manual map marking when GPS is denied (`ubicacion-picker.spec.ts`, 14/14). The current `OwnAddress` contract has no structured country field: storing country only in address text is best-effort UI guidance, not proof that country is persisted as a separate value. Backend/contract remains PENDIENTE CRÍTICO.
- H1.S4.M2 — FE DISPLAY VERIFIED; profile editor renders the saved email read-only and explains verification. Address-change/verification flow and persistence remain PENDIENTE CRÍTICO; no unsafe edit field was added.
- H1.S5.M2 — FE READ-ONLY DISPLAY VERIFIED; `my-profile.spec.ts` exercises profile read; registration catalog fields are intentionally omitted from the request under the current API DTO. Saving private/public declared coverage remains PENDIENTE CRÍTICO.
- H1.S6.M2 — FE UNIT VERIFIED; added coverage for hydrating and projecting NIT/tax-holder name through the existing profile client shape. This is unit evidence only, not a fresh persisted/API assertion.
- H2.S1.M2 — FE UNIT VERIFIED; activation form/link/error tests pass in the focused suite; token one-time ownership and post-activation persistence remain PENDIENTE CRÍTICO.
- H2.S2.M2 — FE READ-ONLY DISPLAY VERIFIED; profile tests cover existing coverage/contact rendering. Creating/revoking a legal relationship and authorization are PENDIENTE CRÍTICO; phone/contact data alone is not access.
- H3.S1.M2 — FE UNIT VERIFIED; practitioner availability spec passed in the directed suite; actual reservation/capacity is not closed without backend M1/M3.
- H3.S2.M2 — FE UNIT VERIFIED; appointments spec passed in the directed suite, including empty/error/cancel/delay UI cases; delivery of released-slot/delay notifications remains PENDIENTE CRÍTICO.
- H3.S3.M2 — DEFERRED; `diagnostic-orders.spec.ts` is actively modified in the separate imaging worktree. No overlapping edit was made.
- H4.S1.M2 — FE UNIT VERIFIED; `medical-record.spec.ts` passed in the directed suite, including empty/error/official download UI states. File ownership, outbox delivery and persisted cross-actor authorization remain PENDIENTE CRÍTICO.
- H5.S1.M2 — DEFERRED; pharmacy paths are owned by the active patient-pharmacy worktree.
- H5.S2.M2 — DEFERRED; diagnostics component spec overlaps the active imaging worktree.
- H5.S3.M2 — FE CLIENT UNIT VERIFIED; diagnostics client spec passed; full component journey remains blocked by the active imaging worktree.
- H6.S1.M2 — DEFERRED; pharmacy paths are owned by the active patient-pharmacy worktree.
- H6.S2.M2 — DEFERRED; diagnostics component spec overlaps the active imaging worktree.
- H6.S3.M2 — DEFERRED; diagnostics component spec overlaps the active imaging worktree.
- H6.S4.M2 — FE UNIT VERIFIED; settlement normalizer spec passed, preserving decimal strings and refusing incomplete/old responses.
- H7.S1.M2 — PENDIENTE CRÍTICO; real isolation/idempotency/revocation journeys require the backend and disposable stack.
- H7.S2.M1 — PENDING VISUAL EVIDENCE; component tests passed, but no current-turn Playwright screenshots/review at all three specified viewports were recorded.
- H7.S3.M2 — DEFERRED; checkout is in the active patient-pharmacy worktree; commercial source-of-truth decision also requires its owner.
- H7.S4.M2 — TODO; route health requires confirming an isolated live API and would clear prior route-health partials; not run under the frontend-only scope.

## Execution notes

- New or changed FE behavior follows test-first RED → GREEN, `corepack yarn`, no skipped/weakened assertions, and source acceptance IDs.
- FE unit tests alone do not close source criteria requiring API authorization/persistence. Backend milestones stay prominently pending.
- User authorization in this continuation is FE-only. API/model code, migrations, `.env`, and proxy configuration remain out of scope. Every backend M1/M3, authorization, persistence, external provider and integration criterion is **PENDIENTE CRÍTICO / ULTRA IMPORTANTE** even where prior historical evidence exists.
- Current-turn FE verification: 13 unique specs / 434 tests passed across registration, profile edit/read, coverage-card client/types, activation, practitioner availability, appointments, medical record, diagnostics client, map picker and insurance portability. `corepack yarn typecheck` passed on retry after one transient `ENOSPC`; targeted ESLint passed. Repo-wide `corepack yarn lint` still fails with 246 existing `prefer-on-push-component-change-detection` errors. The full suite/build after these edits and fresh visual captures remain to be run.
- A fresh full-suite log could not initially be created when the volume showed only 106 MiB available; no cleanup/deletion was performed. After the focused FE test, the available-space report showed 2.8 GiB; the full baseline then completed and its log is in the ignored SDD workspace.
- User requested push but not merge; no publication until in-scope FE changes are reviewed and verified.
