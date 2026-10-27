# Reporte — P44 · «Mis gastos»: `GET /patient-spending/me` en la API real

> **AVANCE: 8 / 8 — 100 %.** Sin prueba visual en navegador (ver «No cubierto»).

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/elegant-goodall-0wu6ci` (API y front)
- Commits: API `90d4a5fe`, `1a073709` · front `5e05dc4d4`, `6a61ed7fd`, `2fe82b8a0`
- Peldaño: modelo SKIP (sin esquema) · API `VERIFIED` funcional (HTTP real + base real + auditoría) · front `TESTED` (specs dirigidos; sin prueba visual)
- Escrito por el orquestador con el contenido que entregó el agente (la herramienta de escritura no le permitió crear el archivo).

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Conceptos `SPEND_*` (7) en `billing.concepts.ts`, sembrados | integración «categorías sembradas» | PASS |
| H1.S1.M2 | Rango validado (400) y `limit` 1..1000 | unitarios + integración HTTP «inválido» | PASS |
| H1.S1.M3 | `PatientSpendingRepository`: movimiento por factura (cubierto, descuento, plan de pagos, nota de crédito, borrador fuera, BOB, hoy en La Paz, orden total) | `patient-spending.int-spec.ts` | 6/6 PASS |
| H1.S1.M4 | Servicio + controlador `@Roles('PATIENT')` + `@AccessLogged`, titular del token | unitarios 16/16 + integración negativa | PASS |
| H1.S1.M5 | OpenAPI e inventario de `billing` regenerados | `tools/openapi/generate-openapi.mjs`, `tools/inventario/endpoints.mjs --modulo billing` | `CONTRATO` |
| H1.S1.M6 | HTTP real con la app completa: 401, 403, 400 del pipe y del servicio, aislamiento, fila de auditoría | `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1 yarn test:integration test/integration/patient-spending-http.int-spec.ts` | 5/5 PASS (`evidencia/api-integracion-http.txt`) |
| H2.S1.M1 | Front: fuera notas «sólo simulador»; `truncated` en DTO y simulador | `yarn ng test --include …` | 34/34 PASS |
| H2.S1.M2 | Front: aviso «Lista recortada», rótulo «Otros gastos», categoría desconocida tolerada | mismos specs | PASS |

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Prueba visual (3 viewports × 2 temas) del tablero contra la API y del aviso | TODO | `ng serve` + Playwright |

## Evidencia
Ver `evidencia/`: `api-unitarios.txt`, `api-integracion-db-real.txt`, `api-integracion-http.txt`, `front-specs-dirigidos.txt`.
`yarn test src/modules/billing` 311/311 · `yarn test src/common/seed` 322/322 · `yarn typecheck` (API, heap 6 GB) EXIT 0 · build de producción del front (pre-push) en verde.

## No cubierto
- Prueba visual en navegador.
- RLS activo (`RLS_ENFORCE=true`): el nombre del prestador cae al de la organización de la sede; no ejercitado.
- Typecheck/lint globales del front; suites completas.

## Desvíos del plan
- 400 (no 422) para el rango inválido: D3.
- Se agregaron `SPEND_OTHER` (D4) y `truncated` (D5).
- Sección nueva en `src/modules/billing/README.md`.
- La primera corrida HTTP falló por no exportar `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1`. Corregido; además queda la prueba a nivel de servicio contra la base.

## Riesgos residuales
- Primas de seguro y farmacia sin seguro no aparecen: hoy no generan factura al paciente.
- Las 16 facturas sembradas en `mantra_base` tienen todos los importes iguales; se muestran tal cual.
- `openapi.*` regenerado incluye deriva preexistente de `dev`.
- El `toCents` del front pasa por coma flotante antes de redondear (preexistente).

## Decisiones y ambigüedades (a confirmar con el dueño del producto)
D1 fuente única: facturas del paciente, sin esquema nuevo · D2 «pagado» = total cobrado · D3 400 por rango inválido, 422 sin perfil · D4 `SPEND_OTHER` · D5 tope + `truncated` · D6 BOB, sin moneda = BOB, otra moneda fuera · D7 nota de crédito negativa · D8 plan de pagos = `total − balance` · D9 instante = creación o mediodía La Paz · D10 sólo el titular, sin dependientes.
