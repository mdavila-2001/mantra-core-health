# Hallazgos — fase 01

> Observados en `http://localhost:4310` (rama `mockup`, backend simulado), Chromium vía
> Playwright MCP, 1440×900 y 390×844, tema del sistema (claro). Capturas en
> `capturas/antes/`. Severidad (P0–P3) separada de confianza (alta/media/baja).

| ID | Ruta · rol · estado | Problema | Evidencia | Sev. | Conf. | Req. | Decisión |
|---|---|---|---|---|---|---|---|
| H-01 | Todas las rutas · médica · 390 px | `NotFoundError: insertBefore` en cada navegación; el selector de organización **nunca** bajaba al cajón y quedaba apretado en el header | consola (≥ 20 errores; lista truncada en 20); causa en `alovida-runtime.service.ts` `ubicar()`: la marca vive dentro de `.app-side-nav__cabecera` | P1 | alta | R07, R10 | **Corregido** `79957540` + 2 pruebas |
| H-02 | Entorno · `yarn start` | Un clon limpio de `mockup` no arranca: `angular.json` exige `proxy.conf.mjs` y `.gitignore` (`/*.mjs`) lo excluye | log de `ng serve` | P1 (equipo) | alta | R01, R12 | **Corregido** `8519df72` |
| H-03 | `/my-account/appointments` · paciente | La acción principal «Agendar una cita» está **al final**, después de todo el historial: ~2 900 px de scroll en escritorio, ~3 700 en móvil | `pac-my-account_appointments-1440.png`; `appointments.html:315` | P2 | alta | R03, R07 | **Corregido** `36c0864d` (R-01) |
| H-04 | ídem | La lista sigue el orden del servidor (ascendente): las citas **ya atendidas** van primero y la próxima queda enterrada entre ellas | captura: 27 Ago, 9 Sept, 16 Sept «Atendido» encabezan | P2 | alta | R03 | **Corregido** `36c0864d` (R-02) |
| H-05 | ídem · 390 px | Los 4 filtros (texto, estado, desde, hasta) ocupan **toda la primera pantalla** antes de la primera cita | `pac-my-account_appointments-390.png` | P2 | alta | R06, R09 | **Corregido** `36c0864d` (R-03) |
| H-06 | ídem · 1440 px | El selector «Todos los estad…» y los campos «DD/MM/AAA…» salen **recortados** | captura 1440 | P3 | alta | R04 | **Corregido** `36c0864d` + `36104a9d` |
| H-07 | ídem | La tarjeta no jerarquiza: fecha, hora, agenda y motivo con el mismo peso; el estado flota centrado a la derecha | captura 1440 | P3 | media | R04 | **Corregido** `36c0864d` |
| H-08 | 17 reglas CSS · varias rutas | `text-transform: capitalize` sobre fechas en castellano: «Viernes 18 **De** Septiembre» | `01-paciente-inicio-1440.png`; `grep` en `src/**/*.css`; la receta correcta ya existe en `day-view.css:36` | P3 | alta | R04 | **Corregido** `7ea3cd77` (3 reglas con «de»; las de mes abreviado quedan) |
| H-09 | `/schedule` · médica · 1440 px | La columna «Acciones» de la tabla se corta: el último ícono queda fuera del contenedor | `med-schedule-1440.png` | P2 | alta | R06, R09 | **Corregido** a 1440 `c1390ab1`; a 1280 quedan 49 px, con sombra de indicio. `rowLabel` en 21 tablas más: `19a76565` |
| H-10 | `/dashboard` · médica | El panel abre con métricas internas («29 secciones disponibles · 0 más en construcción») por encima de la tarea principal | `med-dashboard-1440.png` | P3 | media | R03 | **Corregido** `9025e688` (D-05: la agenda como acción del encabezado, cifras al final) |
| H-11 | `docs/design-system/motion.md` | La doc dice «no hay tokens de movimiento» y `styles.css:129-138` sí los declara (`--dur-*`, `--ease-*`); 65 transiciones siguen con duraciones sueltas (60 × `0.15s`) | `grep` | P3 | alta | R08, R12 | **Corregido** `a5a831e1` (93 transiciones; `--mov-*` alias) |
| H-12 | `alovida.css:560` y `auth-split.css` | Animaciones infinitas decorativas (`nav-pulso 7s`, `auth-*-respira`) | CSS | P3 | alta | R08 | Aceptado: quedan anuladas por el bloque global `prefers-reduced-motion`; se documenta, no se retira (identidad de marca) |
| H-13 | `agenda.spec.ts` · «una solicitud sin responder no ofrece moverla» | La prueba falla: se ofrece «Mover la cita» en una solicitud pendiente | falla idéntica con `src/` de `1f8e8bfd` | P2 | alta | — | **Preexistente, no tocado**: es regla de negocio de la agenda, fuera del refactor visual |
| H-14 | Toda ruta bajo `ng serve` | La CSP con hash bloquea un script en línea que inyecta el servidor de desarrollo («Executing inline script violates … script-src») | consola en la primera carga | P3 | media | R10 | **Cerrado: sólo desarrollo.** En el SSR de producción la CSP incluye el hash y la consola queda en 0 errores (medido en `/posts`, `/auth`, `/directory`). Causa: sin `dist/` la CSP de `ng serve` no conoce el script que inyecta el render |
| H-15 | `/my-account/appointments` · 1280 px | «Hasta» baja sola a una segunda fila | medición de posiciones | P3 | alta | R04 | **Corregido** `9b157e5c` (rejilla con container queries) |
| H-16 | `data-table` (24 pantallas) | «Ver el detalle de …» y «Seleccionar la fila …» usaban el uuid de la fila como nombre accesible | `aria-label` medido en `/schedule` a 390 px | P2 | alta | R10 | **Corregido** `c1390ab1` (entrada `rowLabel`, respaldo «la fila N») |
| H-17 | Suite Vitest | 10 pruebas rojas en `work-history`, `instituciones` y `agenda` | 10 rojas / 145 verdes, **idéntico** con `src/` de `1f8e8bfd` | — | alta | R12 | Preexistente, no tocado |
| H-18 | `yarn lint` | 2 `<img>` sin `alt` en `tools/promo/deck-aseguradoras.html` | salida de eslint | P3 | alta | R10 | **Corregido** `b3908f77` (logos decorativos, `alt=""`) |
| H-19 | `/my-account/diagnostic-results` | «Descargar Archivo 1» y «Compartir con un profesional» idénticos en cada tarjeta: con lector de pantalla no se sabe de qué estudio | `aria-label` medido | P2 | alta | R10 | **Corregido** `73ccd9e7` |
| H-20 | `/my-account/diagnostic-orders` | «Reservar hora» deshabilitado con «Próximamente», aunque reservar en laboratorio ya existe en «Mis citas» (J2) | captura + código | P2 | alta | R03, R07 | **Corregido** `df1b8ab7` (`?resource=lab`) |

## No se encontró

- Desborde horizontal: **0** en 22 celdas del paciente y 28 de la médica (`scrollWidth − innerWidth ≤ 0`).
- Errores de consola en el recorrido del paciente: **0** tras la primera carga (el oyente se enganchaba después del login, por eso este barrido no vio H-14).

## Piloto elegido

**«Mis citas» del paciente** (`/my-account/appointments`). Razones: es la tarea principal del
rol más numeroso, concentra 5 hallazgos (H-03…H-07) de descubribilidad, orden, densidad
móvil y jerarquía, tiene estados completos ya modelados (loading/ready/empty/error, sin
resultados, lista de espera) y una suite de 1 475 líneas que protege el comportamiento.


## Tercera tanda (2026-09-18) — marcas del barrido que se dejan, con motivo

- **`paginated-form`** (≈60 formularios de operación de superadmin): una columna y marcador en la
  barra de avance son decisiones documentadas en su CSS; páginas de 1–4 campos, §5 admite una columna.
- **Aspectos médicos** (paciente): una columna documentada — respuestas libres de largo muy distinto.
- **`work-history`** (my-practice): botones repetidos por sede; zona de otra sesión con 7 tests rojos
  preexistentes. No se toca.
- **Enlaces MINSA/OMS** en formularios clínicos: mismo destino (MINSA) o destino distinto dentro de la
  tarjeta de su formulario (OMS ×3); observación menor.
- **`rebota` / `sin-enlace`**: rutas fuera del rol del actor e hijas con parámetro sin enlace directo.
- **Composición** en filtros, buscadores, títulos de cabecera y botones alineados al inicio: legítimo.
