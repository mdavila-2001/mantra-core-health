# Reporte — Ocultar «Mis cuestionarios» del menú del paciente

> **AVANCE: 4 / 4 — 100 %.**

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `pablo/ocultar-cuestionarios-2026-09-25`
- Peldaño de evidencia alcanzado: **VERIFIED** — ejercitado en navegador real (no sólo unitarios):
  el menú del paciente ya no muestra la fila, y la ruta directa sigue resolviendo y funcionando.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | `fueraDelMenuPara: [ANY_ROLE]` en la entrada `my-account/questionnaires` de `navigation.map.ts` | `yarn typecheck` | exit 0 |
| H1.M2 | `docs/pendiente-decision-cuestionarios.md` con la decisión pendiente | — | archivo creado, referenciado desde el comentario del código |
| H1.M3 | Regresión de navegación (el test que listaba la ruta en el menú del paciente se actualizó) | `ng test --include=src/app/core/navigation/*.spec.ts --watch=false` | 6 files / 124 tests OK |
| H1.M4 | Verificación real en navegador: entrar como paciente, confirmar que la fila no está, entrar por URL directa y confirmar que la pantalla sigue viva | `ng serve --port 4221` + Playwright ad-hoc (borrado después de capturar la evidencia) | capturas en `evidencia/menu-sin-cuestionarios.png` y `evidencia/ruta-directa-sigue-viva.png` |

## Evidencia

```text
$ yarn typecheck
(sin errores)

$ ng test --include=src/app/core/navigation/*.spec.ts --watch=false
Test Files  6 passed (6)
     Tests  124 passed (124)

$ yarn build
(sin errores)
```

Capturas: `evidencia/menu-sin-cuestionarios.png` (menú del paciente, ya no lista «Mis
cuestionarios» — corta en «Cotizaciones»), `evidencia/ruta-directa-sigue-viva.png` (la pantalla
«Mis cuestionarios» renderiza normal entrando por `/my-account/questionnaires` directo, con sus
pestañas «Aspectos médicos»/«Encuestas»).

## No cubierto

- No se verificó el tema oscuro ni otros viewports — el cambio no toca la pantalla en sí, sólo su
  visibilidad en el menú, y ese comportamiento no depende de viewport ni de tema.
- No se verificó «Tus accesos» (el listado alternativo que el JSDoc de `fueraDelMenuPara` promete
  que sigue mostrando la sección) — se confirmó por lectura del código y por los tests existentes
  del servicio, no con una captura nueva.

## Desvíos del plan

Ninguno. El spec de Playwright usado para la verificación en navegador fue ad-hoc y se borró
después de capturar la evidencia: no es parte de la suite permanente, sólo sirvió para demostrar el
comportamiento con evidencia real antes de cerrar (regla `NO_EVIDENCE_NO_DONE`).

## Decisiones y ambigüedades

La decisión de fondo —qué hacer con la sección de acá en más— queda explícitamente sin tomar y
documentada en `docs/pendiente-decision-cuestionarios.md`, tal como pidió el propietario. No se
interpretó ni se resolvió por conveniencia.
