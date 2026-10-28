# Reporte — Que la cotización, el desglose y la objeción se vean contra la API real (carril 16)

- Fecha: 2026-10-27 · Plan: [PLAN.md](./PLAN.md) · Rama del front: `marcelo/lane16-lecturas-reales-dev`
- Peldaño de evidencia alcanzado: `TESTED` (specs dirigidos y suite completa) y `VERIFIED` solo contra la maqueta (Playwright 25/25). **No se probó contra la API real**: no `VERIFIED` para ese camino.
- Avance: 11 / 12 microtareas HECHO, 1 DESCARTADO (H4.M1) y H2 «A MEDIAS» por la prueba contra Postgres (91,7 % HECHO).

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1, H2, H3 | API: lectura de seguros de una persona, desglose y objeción en `my-claims`; contrato y documentos; PR a dev y a test | `gh pr view 1024` / `1025` | `MERGED` 2026-10-27 (#1024 aprobado, #1025 en test); `git ls-tree` confirma el código y el contrato en `origin/dev` y `origin/test` |
| H4.M2 | `listCoveragesOfPatient` ya no es «solo simulador»: sale a `GET /patient-coverages/by-patient/:id` | `yarn test --include=…insurance.client.spec.ts` | 22/22; la prueba nueva corre con `mockBackend: false` |
| H4.M2 | `breakdown` y `patientObjection` dejan de ser «extensión de la maqueta»; el tipo de cobertura pierde póliza y afiliado (la API no los entrega) | `yarn typecheck` | exit 0 ([02](./evidencia/02-typecheck.txt)) |
| H4.M3 | Maqueta con la forma real; el spec de la sección ya no necesita encender la maqueta | specs dirigidos | 127 archivos, 1431 pruebas, 1 fallo ajeno ([05](./evidencia/05-tests-resumen.txt)) |
| — | Lint de los 6 archivos tocados | `yarn eslint <archivos>` | exit 0 ([03](./evidencia/03-lint.txt)) |
| — | Playwright del cobro contra la maqueta | `yarn pw playwright/carril-16-cobro-con-seguro.spec.ts` | `25 passed (39.0s)` ([04](./evidencia/04-playwright-cobro.txt)) |

## A medias
### H4 — verlo contra la API real
- Qué anda: el cliente pide las coberturas y las solicitudes a la API real; la API ya devuelve los datos en dev y test.
- Qué no anda: no lo vi funcionar de punta a punta. No hay prueba de navegador contra la API real de dev ni de test.
- Qué falta exactamente: abrir «Pagos» de una consulta con una médica/operadora BILLING real y a una paciente con un cobro con seguro, en el entorno desplegado de dev o de test.
- Dónde quedó: esta rama y los PR que salgan de ella.

### H2 — desglose y objeción en `my-claims` (API)
- Qué anda: pruebas unitarias del servicio con dobles.
- Qué falta exactamente: una prueba de integración contra Postgres real; el `.env` local apunta a Neon compartido y no se siembra ahí.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Rol del médico para cotizar (BILLING/FINANCE) | TODO | Ambigüedad #1 del carril; decisión del propietario |
| Tres operaciones que el catálogo de contratos del front tiene atrasadas | TODO, ajeno | Regenerar con `node scripts/gen-mock-contract.mjs --api-ref origin/dev` en un PR propio |

## Evidencia
- Suite completa: 939 archivos, 12 920 pruebas, 2 fallos. **Ninguno es de seguros**:
  - `siat-simulated.adapter.spec` («sector 17 → 940»): falla siempre, también aislado y sobre `dev` limpio (verificado con stash).
  - `received-services.handlers.spec` («un paciente no lee los servicios de otro»): falló en la corrida completa y pasa 2/2 aislado, con y sin mis cambios. Es el mismo intermitente del 25/10; **sigue sin diagnosticarse**.
- Capturas del Playwright: el spec las generó y **no las revisé** (no hay revisión doble); se borraron y no se incluyen. El cambio no toca estilos ni plantillas.

## No cubierto
- Todo contra la API real (ver «A medias»).
- Que la API devuelva el 404 uniforme de la puerta asistencial al front: la pantalla lo muestra con el camino de error de siempre; no probé el texto exacto con ese 404.
- Revisión visual doble de capturas.
- Que el cobro con seguro se **envíe** contra la API real (`POST /insurance-claims`): fuera de este cambio.

## Desvíos del plan
- H4.M1 descartado: el catálogo `api-contract.generated.ts` solo guarda cuerpos de escritura, no lecturas. Regenerarlo no agrega lo que pedía el plan y suma 3 operaciones ajenas; lo revertí.
- Se quitó el parche que encendía la maqueta en `claim-quote-section.spec`: ya no hace falta.

## Riesgos residuales
- Si una cuenta BILLING no tiene relación asistencial con la persona, la API responde 404 y la sección de cotizar muestra su estado de error genérico, no «esta persona no es paciente suya».
- El desglose solo viene para las 50 solicitudes más recientes del paciente; las demás traen `breakdown: null` y la pantalla debe decirlo (no lo verifiqué contra datos reales).

## Decisiones y ambigüedades
- Se mantuvo la decisión del PR de API de exigir relación asistencial para leer seguros, igual que cotizar en dev. A confirmar con el propietario del carril.
