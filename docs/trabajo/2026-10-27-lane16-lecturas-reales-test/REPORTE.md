# Reporte — Port a test del ajuste del front del carril 16 (lecturas reales)

- Fecha: 2026-10-27 · Plan: [PLAN.md](./PLAN.md) · Rama: `marcelo/lane16-lecturas-reales-test`
- Peldaño de evidencia alcanzado: `TESTED`. No se probó contra la API real ni en el entorno `test` desplegado; el Playwright del cobro se corrió solo en la rama de dev (mismo código).
- Avance: 5 / 6 microtareas HECHO (83,3 %); falta el PR mergeable (revisión humana).

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | El cambio de dev aplicado sin conflictos sobre `origin/test` | `git cherry-pick -n` | 5 archivos de `src/` |
| H1.M2 | Typecheck | `yarn typecheck` | exit 0 ([01](./evidencia/01-typecheck-test.txt)) |
| H1.M3 | Lint | `yarn eslint <archivos>` | exit 0 ([02](./evidencia/02-lint-test.txt)) |
| H1.M4 | Specs dirigidos | `yarn test --include=…` | 127 archivos, 1433 pruebas, 0 fallos ([03](./evidencia/03-tests-resumen-test.txt)) |
| H1.M5 | Suite completa | `yarn test` | 939 archivos, 12 920 pruebas, 2 fallos en `motion.spec` (ajeno) |

## A medias
### H1.M6 — PR a test mergeable
- Qué anda: el PR queda abierto con el estado que se consulte tras el push (ver el cuerpo del PR).
- Qué falta exactamente: la revisión humana y la prueba contra la API real de `test`.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Verlo contra la API real | TODO | Abrir «Pagos» y «Mis solicitudes» en el entorno desplegado de `test` con datos de prueba |

## Evidencia
- `motion.spec` falló en la corrida completa (2 pruebas) y pasa 8/8 aislado, 2 veces con el cambio y 2 veces sobre `origin/test` limpio (stash). Intermitente, no diagnosticado, no es de seguros.
- Los dirigidos pasan completos en `test`, incluido el spec de SIAT que falla en `dev`.

## No cubierto
- API real y entorno desplegado.
- Playwright en esta rama; revisión visual de capturas.

## Desvíos del plan
Ninguno.

## Riesgos residuales
- Los de dev: 404 de la puerta asistencial con el error genérico; desglose solo para las 50 solicitudes más recientes.

## Decisiones y ambigüedades
- Las del reporte de dev.
