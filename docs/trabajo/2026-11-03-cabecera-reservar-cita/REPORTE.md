# Reporte — Médico de cabecera: botón «Reservar cita»

- Fecha: 2026-11-03 · Plan: [PLAN.md](./PLAN.md) · Rama: `marcelo/feat-cabecera-reservar-cita`
- Peldaño de evidencia alcanzado: `VERIFIED` en la maqueta (`ng serve --configuration demo`). Sin API real.
- Avance: 3 / 3 microtareas con DoD ejecutado.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | «Reservar cita» en la tarjeta, a `/directory/:id#horarios`; «Ver su ficha» queda como secundario | `ng test` (`primary-practitioner-card.spec.ts`) | 5 pruebas en verde |
| H1.M2 | Sin médico no aparece «Reservar cita» y sí el botón a la guía | ídem | verde |
| H2.M1 | La ficha baja a «Sedes y horarios» con `#horarios`: antes la sección quedaba a 2266 px (fuera de la pantalla de 720 px), ahora a 289 px y visible | `ng test` (`practitioner-detail.spec.ts`) + Playwright | 2 pruebas nuevas en verde; medición en navegador |

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Verificación contra la API real | TODO | un entorno con la API |

## Evidencia
```
Test Files  2 passed (2)   (practitioner-detail + primary-practitioner-card)
     Tests  25 passed (25)
```
Navegador (Playwright, maqueta, paciente de prueba): la tarjeta muestra «Reservar cita» → `/directory/<id>#horarios`; al pulsarla, «Sedes y horarios» queda visible (top de `#horarios` = 289 px con la pantalla de 720; sin el arreglo: 2266 px).
Capturas: [tarjeta](./evidencia/4-tarjeta-reservar.png) · [ficha en «Sedes y horarios»](./evidencia/5-ficha-horarios.png).
`tsc -p tsconfig.app.json` sin errores en `primary-practitioner`.

## No cubierto
- Se corrieron sólo los specs de la tarjeta y la ficha, con `tsconfig` y runner temporales (no versionados) y el tiempo de arranque de workers de Vitest subido en un `node_modules` local, por la carga de la máquina. Suite completa no corrida (en `dev` hay specs que no compilan, ver PR #1895).
- La verificación fue contra la maqueta, no contra la API real; el médico de prueba no tiene horarios publicados, así que no se vio un cupo concreto.
- Lint no corrido.

## Desvíos del plan
Ninguno.

## Riesgos residuales
- «Directo a reservar» llega a los horarios, no a un cupo: reservar exige elegir cupo.
- El arreglo del ancla también cambia el comportamiento de «Revisar disponibilidad» en la guía (ahora sí baja); no se verificó ese enlace en el navegador.

## Decisiones y ambigüedades
- Ver las dos del plan.
