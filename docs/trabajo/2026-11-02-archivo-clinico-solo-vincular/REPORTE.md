# Reporte — Archivo clínico: sólo «Solicitar vinculación»

- Fecha: 2026-11-02/03 · Plan: [PLAN.md](./PLAN.md) · Rama: `marcelo/fix-archivo-clinico-solo-vincular`
- Peldaño de evidencia alcanzado: `VERIFIED` en la maqueta (`ng serve --configuration demo`) para el comportamiento; `TESTED` para el resto. Sin API real.
- Avance: 3 / 3 microtareas con DoD ejecutado; de los 5 Playwright se ejecutó 1.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | La fila de «Archivo clínico» ofrece sólo «Solicitar vinculación»; se quitó la carpeta y `rutaDe`; la columna pasa a «Vinculación» | `ng test` (`clinical-record.spec.ts`) | spec nuevo en verde |
| H2 | Un 409 al pedir el vínculo se muestra como aviso informativo, no como error | `ng test` (`request-access.spec.ts`) | spec nuevo en verde |
| H1.M2 | Los 5 recorridos Playwright que entraban por la carpeta toman el perfil del enlace de la fila (`playwright/support/expediente.ts`) | `tsc -p playwright/tsconfig.json --noEmit`, filtrado a estos archivos | sin errores en ellos |

## A medias
### H1.M2 — recorridos Playwright
- Qué anda: `clinica-c3-enfermedades-activas.spec.ts` pasa contra la maqueta (login, búsqueda, enlace de la fila, expediente). Los 5 tipan sin errores.
- Qué no anda: nada conocido.
- Qué falta exactamente: ejecutar los otros 4 (`carril-insurance-antifraud-duplicates`, `clinica-c5-receta`, `infra-f5-integracion`, `task-27-error-flow-evidence`); usan el mismo ayudante.
- Dónde quedó: esta rama.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Verificación contra la API real | TODO | un entorno con la API; la maqueta ya traía un pedido pendiente para Ana, por eso reproduce el 409 |

## Evidencia
```
Test Files  2 passed (2)
     Tests  26 passed (26)
```
`tsc` (app, spec y playwright) sin errores en `clinical-record`, `request-access` y los 5 specs tocados.

Verificación en la maqueta con Playwright (Chromium), médica de prueba: 16 filas con «Solicitar vinculación» y 0 con «Ver expediente»; al pedir el vínculo con Ana Lucía Pérez Quiroga (ya pendiente en la maqueta) sale el aviso informativo, 0 alertas rojas. `clinica-c3-enfermedades-activas.spec.ts`: 1 passed.
Capturas: [fila](./evidencia/1-archivo-clinico.png) · [aviso del 409](./evidencia/2-409-aviso.png).

## No cubierto
- El `ng test` se corrió **sólo con estos 2 specs**, con un `tsconfig` y un runner temporales (no versionados) y con el tiempo de arranque de workers de Vitest subido en un `node_modules` local, porque la máquina estaba al 100 % de CPU.
- La suite completa NO se corrió. En `dev`, `tsc -p tsconfig.spec.json` ya falla en archivos que no toqué (`adt/bed-compatibility.spec.ts`, `adt/inpatient-indicators.spec.ts`, `support-access.provisioning.handlers.spec.ts`), así que `ng test` completo no compila en esta base.
- Lint no corrido.
- La verificación fue contra la maqueta, no contra la API real.

## Desvíos del plan
Ninguno.

## Riesgos residuales
- El 409 no distingue «pendiente» de «activo»: la API no manda un `code` distinto y el repo ramifica por `code`. Si se quiere, pedir un `reason` en la API.
- El 403 de `GET /profiles/patients/:id` en la pantalla de solicitud sigue ocurriendo sin vínculo (el nombre cae al genérico).
- Sin botón de expediente en el buscador, el médico entra por la agenda o la consulta.

## Decisiones y ambigüedades
- Quitar la carpeta fue pedido explícito del propietario (02/11/2026).
