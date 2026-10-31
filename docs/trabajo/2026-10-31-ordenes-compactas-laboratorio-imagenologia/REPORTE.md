> **AVANCE: 3 / 6 — 50,0 %.**

# Reporte — Órdenes compactas de laboratorio e imagenología

- Fecha: 2026-10-31 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/compassionate-franklin-0rqq5g` (rebasada sobre `origin/dev`)
- Peldaño de evidencia alcanzado: **web, H1 → `VERIFIED` funcional** (flujo observado en navegador con persistencia tras recarga); **visual → `VERIFIED_FUNCTIONAL_ONLY`** hasta que el juego final de capturas pase la segunda revisión independiente. H2 y H3: `UNKNOWN`.
- Solo contra el **simulador** (P52): la API real no publica `/diagnostics/lab/*`, así que el ciclo de órdenes no existe en el backend.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | El menú del laboratorio queda en Resumen, Órdenes, Precios y Sucursales; recepción, cola y resultados redirigen a Órdenes | `yarn ng test` (navigation, app.routes, diagnostics, lab-reception, laboratory, mock) | PASS, 141 archivos / 2026 tests |
| H1.S1.M2 | «Órdenes»: una tarjeta con pestañas por estado (Todas, Borrador, Recibidas, Procesadas, Subidos, Canceladas y rechazadas), conteo, búsqueda, vacío orientador y error con reintento | `laboratory-orders.spec.ts`, `laboratory-orders.logic.spec.ts` | PASS (24 tests) |
| H1.S1.M3 | Acciones Recibir, Marcar como procesada, Subir resultados y Descargar; un paso fuera de orden responde 409; subir exige orden procesada | `lab-portal.handlers.spec.ts` + Playwright «laboratorio: portal…» | PASS; en navegador 390 y 1440: Borrador → Recibida → Procesada → Subidos, descarga byte a byte igual, estado «Subidos» tras recargar (`evidencia/recorrido-final.log`) |

Otros gates: `tsc -p tsconfig.app.json --noEmit` limpio · `eslint` limpio sobre lo tocado · `tsc -p playwright/tsconfig.json` limpio · `check-architecture` sin el ciclo nuevo.

## A medias
### H1.S1.M4 — Evidencia visual con doble revisión
- Qué anda: 27 capturas (390/768/1440, 7 escenas + tema oscuro), `recorrido-final.log` sin errores de consola ni de red, sin desborde horizontal. Dos revisiones independientes hallaron defectos que se corrigieron (ver `evidencia/doble-revision.md`).
- Qué no anda: el **juego final** no pasó por una nueva revisión independiente (la regla 35.1.4 la exige tras cada recaptura). No hay captura de una orden Rechazada ni del estado «Subiendo» (la maqueta termina la subida al instante).
- Qué falta exactamente: una tercera revisión independiente del juego final; decidir si se siembra una orden Rechazada en la bandeja de la maqueta.
- Dónde quedó: `docs/trabajo/2026-10-31-ordenes-compactas-laboratorio-imagenologia/evidencia/`.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H2.S1.M1 Marketplace de servicios (`/my-services`, directorio de laboratorios, catálogo de farmacia) | TODO | Decidir pantalla por pantalla; el usuario pidió el máximo alcance y el estándar de composición-rules §5 |
| H3.S1.M1 App Flutter | TODO | La app no tiene signup/login ni flujos; es un proyecto aparte y este entorno no tiene Flutter SDK |
| Dos PRs (`dev` y `test`) | No abiertos | El usuario no pidió abrirlos; el de `test` sale de una rama desde `test` con cherry-pick |

## Evidencia
```text
yarn ng test (141 archivos)  → Test Files 141 passed · Tests 2026 passed
playwright hito2 · laboratorio → 2 passed (1440 y 390 px)
recorrido-final.log → descarga … iguales=true · tras recargar: Subidos · errores de consola/red: ninguno (390/768/1440)
```
Archivos en `evidencia/`: `01…08-*.png`, `doble-revision.md`, `recorrido-final.log` y dos logs de tandas previas (`recorrido-1.log`, `recorrido-2-flujo.log`, superados).

## No cubierto
- Petición/respuesta de red: el simulador responde dentro del navegador, así que no hay tráfico HTTP que mostrar; lo observado es la UI, el estado persistido en `sessionStorage` y la descarga.
- Contra la API real: nada (no existe el contrato).
- Teclado, foco visible, contraste medido, estados de carga y de error en navegador, tema oscuro en 768.
- Orden **Rechazada** en pantalla (solo tests) y estado «Subiendo» con progreso (solo test del componente).
- `yarn test` completo (4985 pruebas): se corrió solo lo afectado.

## Desvíos del plan
- La rama salía de `master` (413 commits atrás de `dev`): se rebasó sobre `origin/dev`.
- Se pidió «tres puntos»: se usó `app-row-actions` (ADR-0012), cuyo disparador dice «Acciones» con ícono.
- `lab-portal.handlers.ts` está congelado en 1008 líneas: las órdenes se movieron a `lab-orders.handlers.ts`; aun así el original quedó en **1009** (+1 sobre el techo). `app.routes.ts` (2486) ya superaba su techo de 2273 en `dev`.
- Se actualizaron dos Playwright que dependían de pantallas retiradas: `hito2-laboratory-insurance` (reescrito al flujo de Órdenes) y `modales-fuera-de-consulta` (se quitó el caso del modal «Recibir muestra», que ya no existe).

## Riesgos residuales
- `LabReception` y `LaboratoryResults` quedan en el repo sin ruta (código muerto con sus tests); `ResultUploadQueue` y `picked-files` se reusan. Borrarlos es una decisión aparte.
- `Pedida` en prioridad 1 hace la tabla más justa en tablet.
- Hallazgos de componentes compartidos sin tocar (menú pegado al borde en 390, pestañas cortadas, botón «Acciones» de ≈40 px).
- El servidor `ng serve` que levanté fue detenido; no queda ningún proceso en segundo plano.

## Decisiones y ambigüedades
- «Subidos» se tomó como estado final tras Procesada (confirmado por el usuario); Cancelada y Rechazada salen de una orden recibida/borrador (cancelar) o recibida (rechazar). La UI **no ofrece** cancelar ni rechazar: el pedido listó solo cuatro acciones. Confirmar con el usuario si el laboratorio debe poder rechazar.
- Alcance: laboratorio + imagenología (cuenta `DIAGNOSTIC_CENTER`), sin farmacia (confirmado).
- «Horarios y equipos» aparece en la captura del usuario pero no existe en `dev`; no se tocó.
