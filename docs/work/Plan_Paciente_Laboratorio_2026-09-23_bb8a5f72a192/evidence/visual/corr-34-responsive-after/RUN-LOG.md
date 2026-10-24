# Official patient-route CORR-34 run

> HISTÓRICO: esta salida corresponde a la base `b7785e362a7ccfbbd0665b1863eab92b65ea4137`, previa al fast-forward a `a43ad2b`. Incluye `/my-account/loyalty`, que en la base actual redirige a `/my-account`; no usar como evidencia vigente. Ver `../corr-34-responsive-current-mockup/RUN-LOG.md`.

- Date: 2026-09-24 UTC
- Command: `E2E_BASE_URL=http://127.0.0.1:4300 CORR_USUARIO=paciente scripts/corr-evidencia.sh 34 --auditoria`
- Runner: `scripts/corr-evidencia.sh` and `playwright/corr-evidencia.spec.ts` copied unchanged from branch `justin/mockup-corr-34-fondo-blanco-ancho-completo`.
- Isolation: disposable project copy at `/private/tmp/mch-plan-paciente-corr34-run-20260924-a81c/project`; only lane 34 in that copy's route manifest was narrowed to the five patient routes. Output was written to the disposable copy's sibling `docs/`, then preserved here. Shared `docs/progress/evidence/lane-34/` was not written by this run.
- Routes: `/laboratory-directory`, `/my-account/appointments`, `/my-account/diagnostic-orders`, `/my-account/diagnostic-results`, `/my-account/loyalty`.
- Playwright: `--workers=1 --max-failures=1` (provided by the script); result `1 passed (42.4s)`.
- Result: 20 measurement cells; 0 red rows; no empty screenshots; zero console errors/HTTP 5xx reported.
- Viewports/themes: 375, 768, 1440 light; 1440 dark.
