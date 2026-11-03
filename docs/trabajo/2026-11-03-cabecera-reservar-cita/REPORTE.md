# Reporte — Médico de cabecera: botón «Reservar cita»

- Fecha: 2026-11-03 · Plan: [PLAN.md](./PLAN.md) · Rama: `marcelo/feat-cabecera-reservar-cita`
- Peldaño de evidencia alcanzado: `TESTED`. Sin `VERIFIED` en navegador.
- Avance: 2 / 2 microtareas con DoD ejecutado.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | «Reservar cita» en la tarjeta, a `/directory/:id#horarios`; «Ver su ficha» queda como secundario | `ng test` (`primary-practitioner-card.spec.ts`) | 5 pruebas en verde |
| H1.M2 | Sin médico no aparece «Reservar cita» y sí el botón a la guía | ídem | verde |

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Verificación en navegador | TODO | `ng serve` con la maqueta y captura de la tarjeta |

## Evidencia
```
Test Files  1 passed (1)
     Tests  5 passed (5)
```
`tsc -p tsconfig.app.json` sin errores en `primary-practitioner`.

## No cubierto
- Se corrió sólo el spec de la tarjeta, con `tsconfig` y runner temporales (no versionados) y el tiempo de arranque de workers de Vitest subido en un `node_modules` local, por la carga de la máquina. Suite completa no corrida (en `dev` hay specs que no compilan, ver PR #1895).
- No se comprobó que el ancla `#horarios` baje la pantalla en el navegador; el spec sólo fija el `href`.
- Lint no corrido.

## Desvíos del plan
Ninguno.

## Riesgos residuales
- «Directo a reservar» llega a los horarios, no a un cupo: reservar exige elegir cupo.

## Decisiones y ambigüedades
- Ver las dos del plan.
