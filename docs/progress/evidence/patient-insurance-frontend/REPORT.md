# Patient insurance — frontend review H1–H5

This report records the presentation that the current patient frontend can render from its existing contracts and synthetic data. It does not certify API, persistence, permissions, insurer decisions, or provider behavior. H3/H4 acceptance for item-level insurance decisions remains incomplete because the patient frontend contract does not expose all requested lines and decisions; the backend/contract is pending.

## Observed frontend behavior

- H1, profile coverage: the patient profile distinguishes verified from declared coverage, current/expired/future validity, and shows published plan, benefits, dates, amounts, and absent values. See `coverage-1440x900.png` and `coverage-390x844.png`.
- H2, settlement: the shared settlement view presents published totals and exclusions separately from confirmed patient responsibility; pending publication, review, and unavailable states are distinct. A provider failure has no distinct contract state in the observed DTO.
- H3/H4, pharmacy and diagnostic orders: the UI shows available settlement states, exclusions/motives where supplied, preparation supplied by the facility, result links, and logistical rejection separately from insurer rejection. The current synthetic scenarios do not cover the source acceptance matrices of 5 medicines as 3/2, 8 lab studies as 5/3, or 3 images as 2/1. No decisions were inferred from totals or exclusions.
- H5, contact: the profile card presents WhatsApp and call-center links independently; keyboard focus and telephone URL are covered by the E2E.

## Verification

- `corepack yarn test --watch=false` over 10 targeted profile, coverage, settlement, pharmacy, diagnostics, and contact-channel specs — 10 files, 163 tests passed.
- `corepack yarn pw playwright/patient-coverage-copays.spec.ts --workers=1 --reporter=list` — 6/6 passed across 1440×900 and 390×844. The scenarios cover profile coverage/channels, pharmacy settlements (including partial, pending, denied, and separate logistics rejection), and diagnostic orders/preparation/results.
- The first E2E attempt happened before the dev server was started and failed at `localhost:4200/auth` with connection refused; no assertions ran. After starting the frontend mock with `corepack yarn dev --port 4200`, the same command passed 6/6.
- Full screenshots are included beside this report. They were inspected at both viewport sizes; no horizontal overflow was reported by the test.

## Remaining backend work

The insurer/API owner still needs to provide the approved per-item decision contract, reasons/clauses, currency and amounts, version/correlation, response errors, authorization, persistence and idempotency. Until then, the frontend cannot truthfully render the full H3/H4 acceptance scenarios. Keep those criteria A MEDIAS/BLOQUEADO; do not fill the missing state with fixtures presented as real decisions.
