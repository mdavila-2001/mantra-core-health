# Reporte — Port del front del carril 16 (PR #1227) a dev

- Fecha: 2026-10-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `marcelo/lane16-insurance-ui-dev` → PR #1377 a `dev`
- Peldaño de evidencia alcanzado: `VERIFIED` para la maqueta (Playwright 25/25 + doble revisión de capturas); `TESTED` para el resto. No `REGRESSION_VERIFIED`: ver «No cubierto».
- Avance: 8 / 9 microtareas HECHO (88,9 %). Falta H1.M6 solo por la revisión humana que exige `dev`.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | Feat `14495e3a4` aplicado sin los docs retirados | `git show --stat HEAD` | 59 archivos: `src/`, `playwright/` y esta carpeta |
| H1.M2 | 7 conflictos resueltos leyendo ambos lados | `grep -rn '^<<<<<<<' src playwright` | sin coincidencias |
| H1.M3 | Typecheck | `yarn typecheck` | exit 0 ([01b](./evidencia/01b-typecheck-final-dev.txt)) |
| H1.M4 | Specs dirigidos | `yarn test --include=…` | 124 archivos, 1383 pruebas, 0 fallos ([02](./evidencia/02-tests-dirigidos-dev.recortada.txt)) |
| H1.M5 | Lint de los 34 archivos tocados | `yarn eslint <archivos>` | exit 0, sin salida ([04b](./evidencia/04b-lint-final-dev.txt)) |
| H1.M7 | Cuatro specs alineados a dev | `yarn test` completo | 913 archivos, 12 435 pruebas, 0 fallos en la 2.ª corrida ([03b](./evidencia/03b-test-completo-dev-repeticion.recortada.txt)) |
| H1.M8 | `objectionReason` viaja a la API real | `yarn test` + contrato de dev | `ClaimDisputeDto` declara `objectionReason`; `my-requests.spec` lo ve en el cuerpo |
| H1.M9 | Playwright del cobro contra la maqueta | `yarn pw playwright/carril-16-cobro-con-seguro.spec.ts` | `25 passed (41.2s)` ([07](./evidencia/07-playwright-cobro-con-seguro-dev.txt)) |

`PR #1377` — `MERGEABLE` · `CLEAN` · sin checks reportados (el CI propio está caído) · consultado 2026-10-25 tras el push `f90825f79` ([08](./evidencia/08-pr-1377-mergeable.txt)).

## A medias
### H1.M6 — PR a dev mergeable
- Qué anda: el PR está abierto, fuera de draft, `MERGEABLE` y `CLEAN`.
- Qué no anda: nada falla.
- Qué falta exactamente: la revisión humana; en este repo `gh pr merge` y el auto-merge están bloqueados.
- Dónde quedó: PR #1377.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H2 (port a test) | EN CURSO | Se hace en otra rama y otro PR, con su propio reporte |

## Evidencia
- Doble revisión de capturas (Playwright, maqueta, dev portada). Revisé 8 de las 26 capturas del spec y 2 vistas del diálogo completo; las otras 18 no se miraron y **no se incluyen** (se borraron).
  - Primera pasada (criterio: la médica cotiza en «Pagos» y ve el reparto del servidor; el paciente ve su parte y objeta): `cotizacion-medico-cifras-1280-claro`, `…envio-1280-oscuro`, `desglose-paciente-1280-claro` y `-375-oscuro`, `objecion-modal-1280-claro`, `objecion-paciente-1280-oscuro`, `pagos-dialogo-1280-light` y `-dark` en [capturas/](./evidencia/capturas/). Los repartos suman (50,00 + 450,00 = 500,00; 66,88 + 46,89 = 113,77) y el diálogo convive con los totales de `PatientCharges` de dev.
  - Segunda pasada (postura de rechazo), nota por pantalla: **ACEPTABLE CON RESERVAS**, ninguna `RECHAZADA`.
    - S2 · Formato de dinero inconsistente en el mismo diálogo: el bloque nuevo muestra «50.00 Bs» y el de dev «Bs 180,00». No se corrigió: es un cambio de UI no pedido.
    - S3 · El servicio dice «programado en con: sultorio» en la maqueta: viene de un dato del nomenclador simulado, no del port.
    - S3 · El campo de aprobación previa muestra el UUID cortado por el principio.
    - S3 · El resumen total repite la única línea cuando hay un solo servicio.
    - S3 · En el modal de objeción, «Motivo *» queda pegado al párrafo.
- `check-max-lines` (ratchet): `insurance.handlers.ts` 1949 (techo 1677), `insurer-received-claims.handlers.ts` 676 (tope 600), `insurance.types.ts` 1091 (techo 944) e `insurance.client.ts` 1075 (techo 950). Los dos últimos ya estaban por encima en dev; los dos primeros los empuja el port. No se actualizó el baseline (sería silenciar el gate) ni se partieron los archivos (sería un refactor fuera de alcance).
- `check-api-contract-drift`: en dev ya hay 51 operaciones sin declarar. El port agrega 3: `POST /insurance-claims`, `POST /insurance-claims/quote` y `GET /patient-coverages/by-patient/:patientProfileId`. En `mockup` tampoco están declaradas.
- Los otros chequeos manuales fallan por archivos que el port no toca: ninguno menciona un archivo del port, salvo `check-english-identifiers` y `check-css-tokens`, cuyas coincidencias son de otros archivos o texto del propio chequeo.

## No cubierto
- Playwright contra la **API real** (`carril-16-solicitudes-de-seguro.spec.ts`): requiere la semilla de la API local y no se ejecutó. Solo se corrió el spec del cobro contra la maqueta.
- Contra la API real de dev, cotizar con seguro no funciona de punta a punta: `GET /patient-coverages/by-patient` no existe en la API y la sección avisa «no disponible». El desglose y la objeción del paciente tampoco aparecen: `GET /insurance/my-claims` no devuelve `breakdown` ni `patientObjection`. Son huecos de backend ya registrados; el port no los cierra.
- No se desplegó ni se probó en el entorno `dev` publicado.
- Las 18 capturas que no revisé.

## Desvíos del plan
- Se agregaron H1.M7, H1.M8 y H1.M9 (el plan original no los traía): el port chocó con convenciones de dev que mockup no tiene.
- El plan decía que dev había retirado `docs/progress/`: era falso (conserva la evidencia del atlas). Lo corregí; de todos modos las capturas del carril quedan fuera del port.

## Riesgos residuales
- Un test no relacionado falló una vez de dos: `received-services.handlers.spec` > «un paciente no lee los servicios de otro» (`expected false to be 403`). Pasó en la corrida dirigida y en la repetición completa. **No se diagnosticó ni se comparó contra dev sin el port**, así que no puedo decir que sea previo.
- El port agrega rutas de la maqueta (`/insurance-claims/quote`, cobertura por persona) que reemplazan el cuerpo de `POST /insurance-claims`: dev aceptaba `{ lines: [{ service, billedAmount }] }` y ahora exige `patientCoverageId`, como la API real.

## Decisiones y ambigüedades
- Ambigüedad: ¿la maqueta de dev debe seguir aceptando el cobro sin cobertura? Supuesto tomado: no, porque la API real (#671) lo rechaza; se adaptó el único spec de dev que lo usaba. A confirmar con quien revise el PR.
- Decisión: `objectionReason` viaja a la API real porque el contrato de dev lo declara. Esto contradice el registro «solo simulador» de #1227, que era correcto para la base de mockup.
