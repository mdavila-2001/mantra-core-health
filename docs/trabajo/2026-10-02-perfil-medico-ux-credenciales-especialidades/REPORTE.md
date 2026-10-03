> **AVANCE: 19 / 23 — 82,6 %.** QA de integración: **FAIL**. Entrega todavía en curso; no se declara el hito cerrado.

# Reporte — Hito 1: perfil médico

- Continuación: 2026-10-03. Plan: [PLAN.md](PLAN.md). Rama: `marcelo/fix-perfil-medico-ux-credenciales-especialidades`.
- Base actual: `b84f74aaf3a359de93c53ab05941e2ec7ac5d0c1`; inicial `ad5623a7`. Peldaño: **TESTED**, con límites explícitos.
- Perfil, editor, adaptadores, navegación y shell modificados; backend, modelo, dependencias y entornos intactos.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Reglas actualizadas antes del código | `git pull --ff-only` | PASS: [preparacion.txt](evidencia/preparacion.txt) |
| H1.S1.M2 | Rama solicitada; dos avances de dev integrados sin conflictos | `git merge-base --is-ancestor b84f74aa HEAD` | PASS: [preparation-and-env.txt](evidencia/preparation-and-env.txt) |
| H1.S1.M3 | Plan escrito antes del código | `Test-Path PLAN.md` | PASS: [preparacion.txt](evidencia/preparacion.txt) |
| H1.S2.M1 | Especialidades sólo en su ubicación propia/portada pública | `yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S2.M2 | Idiomas propios y su editor en Datos personales | `yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S3.M1 | Alias autenticado conserva /account/profile y ruta anterior | `yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S3.M2 | Un Mi perfil activo y breadcrumbs canónicos | `yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S3.M3 | Cancelación protege cambios reales, inválidos e imágenes; bloquea operaciones | `yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S4.M1 | Credenciales 5/6/12, búsqueda y paginación sin pérdidas | `yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S4.M2 | Trayectoria conserva grupos y tablas sin overflow | `yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S4.M3 | Acciones laborales según puedeCorregirse/puedeRetirarse | `yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S4.M4 | Aprobación explícita independiente de vigencia; rechazado no aprobado por verifiedAt | `yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S4.M5 | Respaldo propio, archivo real, retry; otro usuario 403 sin contenido | `yarn test --include=... --watch=false; yarn pw ...` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S4.M6 | Cabecera pública cabe en tablet, sin cambios de primitivas | `yarn pw ... --workers=1 --retries=0` | PASS: [e2e-current-base-isolated.txt](evidencia/e2e-public-captures.txt) |
| H1.S5.M1 | Typecheck, plantillas Angular, lint y presupuesto pasan | `corepack.cmd yarn typecheck; yarn build; yarn lint` | PASS: [build-public-padding-final.txt](evidencia/build-public-padding-final.txt) |
| H1.S5.M2 | 26 suites dirigidas, 972 pruebas aprobadas | `corepack.cmd yarn test --include=... --watch=false` | PASS: [targeted-current-base.txt](evidencia/targeted-current-base.txt) |
| H1.S5.M4 | 32 recapturas con P1 y P2 independiente, cero rechazos finales | `yarn pw ... --workers=1 --retries=0` y revisión individual | PASS: [doble-revision.md](evidencia/doble-revision.md), [final-second-review.md](evidencia/final-second-review.md) |
| H1.S5.M5 | Entornos sin diff, mockBackend:false real preservado; archivos ajenos fuera | `git diff b84f74aa -- src/environments/` | PASS: [preparation-and-env.txt](evidencia/preparation-and-env.txt) |
| H1.S6.M1 | Reporte de estado, evidencia y límites en disco | `Test-Path REPORTE.md` | PASS: [triage.md](evidencia/triage.md) |

## A medias

### H1.S5.M3 — integración con API de desarrollo

- Qué anda: cancelación limpia y con rechazo/aceptación, recarga con valor anterior y cero escrituras de perfil; perfiles, autenticación y PDF son reales. La descarga propia entrega PDF válido y la cuenta ajena recibe 403 sin bytes del documento.
- Qué no anda: red/consola limpia en modo REAL. La API local carece de signature-assets, insurance-networks e insurance-carriers (404); service-offerings devuelve 500 porque falta la relación scheduling.practitioner_service_offerings. Backend /health responde 200. VS_LANGUAGE y VS_LANGUAGE_PROFICIENCY devuelven 200 con items=0; el editor muestra error recuperable al cargar idiomas.
- Qué falta exactamente: el equipo API debe implementar los GET documentados y preparar la relación de scheduling y sembrar ambos catálogos de idiomas; después ejecutar ambos specs sin E2E_PROFILE_ISOLATED, con Chromium, un worker y cero reintentos.
- Dónde quedó: los dos specs practitioner-profile-*.spec.ts y support/practitioner-profile-test.ts; compilación aprobada. Modo aislado opt-in limita simulaciones a esos cuatro GET, identificado en salida. No acredita integración completa.

## Pendiente

| ID | Estado | Qué falta |
|---|---|---|
| H1.S6.M2 | TODO | Commit acotado y push con hook build activo. |
| H1.S6.M3 | TODO | Abrir PR no draft contra dev con ambos reviewers. |
| H1.S6.M4 | TODO | Consultar GitHub después del último push; registrar mergeabilidad y checks reales. |

## Evidencia

Comandos completos y salida literal en [qa-report.md](evidencia/qa-report.md); fallos intermedios permanecen en evidencia y triage.

```text
corepack.cmd yarn typecheck
EXIT_CODE=0
corepack.cmd yarn lint
EXIT_CODE=0
corepack.cmd yarn build
Output location: C:\Alovida\mantra-core-health\dist\mantra-core-health
EXIT_CODE=0
E2E aislado, Chromium 1 worker / 0 retries:
4 passed (1.5m)
EXIT_CODE=0
Pruebas dirigidas (ver comando completo en qa-report):
Test Files  26 passed (26)
Tests  972 passed (972)
EXIT_CODE=0
Suite completa actual:
Test Files  2 failed | 763 passed (765)
Tests  2 failed | 10628 passed (10630)
EXIT_CODE=1
Base b84f74aa sin este cambio:
Test Files  1 failed | 764 passed (765)
Tests  1 failed | 10538 passed (10539)
EXIT_CODE=1
git diff b84f74aa -- src/environments/
EXIT_CODE=0
```

Arquitectura, CSS tokens y generate-doc-report tienen exit 1 en trabajo y base actual. El catálogo 137 frente a 43 falla también en base. El fallo adicional de pdf-logo no se reprodujo en base ni subconjunto: **causa completa no resuelta**, no se atribuye categóricamente a la base.

## No cubierto

- Preview no tiene ruta/consumidor activo: sólo pruebas presentacionales.
- Errores recuperables de descarga, respaldo ausente, estados rechazado/vencido/desconocido y operaciones de imágenes se verifican con dobles unitarios; no se atribuyen a un recorrido real de todos esos bordes.
- No se ejecutó toda la regresión E2E del producto ni certificación clínica; se usan únicamente cuentas y documentos sintéticos.

## Desvíos del plan

- Dos fast-forward de dev durante el trabajo: se preservaron frecuencia de facturación e idiomas independientes; estos últimos se trasladaron a Datos personales y se añadieron cinco pruebas de cancelación/persistencia.
- Se añadió H1.S4.M6 antes del cambio, para corregir el overflow de cabecera tablet demostrado; total 23 microtareas.
- La falta de cuatro GET auxiliares obliga a evidencia aislada explícita. No se cambió mockBackend ni se ocultaron errores en el modo REAL.
- Se habilitó GitHub CLI portable oficial, con checksum verificado y autenticación existente, sin guardar tokens.

## Riesgos residuales

- Integración y suite global en rojo impiden certificar REGRESSION_VERIFIED. Fallas generales de arquitectura, tokens y documentación requieren trabajos ajenos al perfil.
- Labels ingleses del catálogo y espacio de acciones públicas vacío son reservas visuales de baja severidad.
- Aprobación humana y resultado de CI pendientes; no se autoriza ni ejecuta merge.

## Decisiones y ambigüedades

- Se respeta /account/profile como URL sin redirección; /my-account sigue disponible.
- Aprobación se toma del estado explícito, nunca de verifiedAt, fuente o En curso.
- Respaldo visible sólo para el titular; backend decide autorización real. Vínculos laborales no tienen adjuntos.
- Idiomas poseen guardado independiente en dev: lo ya persistido no se descarta al cancelar la presentación.
- Resolver contratos auxiliares y catálogo frontend/API corresponde al equipo API; resolver CI general al mantenedor del repositorio.
