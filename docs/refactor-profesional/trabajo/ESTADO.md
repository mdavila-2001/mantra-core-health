# Estado

## Alta de médico: cada habilitación con su fecha y su respaldo, y el colegio de la profesión — 2026-10-27

El paso «Su habilitación para ejercer» tiene tres renglones —matrícula, registro del SEDES y registro en el colegio—,
cada uno con **su** número, **su** fecha de inscripción y **su** respaldo PDF. El colegio sale del título profesional
elegido antes («Registro en el Colegio Médico de Bolivia», «… de Odontólogos de Bolivia»); es obligatorio cuando el
título tiene colegio conocido. Viajan `sedesLicenseIssueDate` y `collegeLicenseNumber`/`collegeName`/
`collegeLicenseIssueDate`/`collegeLicenseFileId`, que la API recibe desde la rama `claude/relaxed-cannon-nt2pik` de
`mantra-core-health-api` (tercera fila de `jurisdiction_authorizations`, concepto `JURISDICTION_PROFESSIONAL_COLLEGE`).
**Sin esa rama de la API mergeada, la API real rechaza estos campos**: hay que mergear las dos juntas.

**Verificado en navegador** (Chromium contra `ng serve --configuration development,demo`, 21 verificaciones con
[`playwright/registro-habilitacion.mjs`](../../../playwright/registro-habilitacion.mjs); capturas en
`evidencias/registro-habilitacion-2026-10-27/`): tres renglones en orden con número, fecha y respaldo; los tres en una
fila a 1440 px; la tarjeta a lo ancho (holgura 113/113 px); el colegio cambia con el título; sin el número del colegio
el paso no avanza y lo dice en su renglón; sin desborde a 390 px, donde se apilan; oscuro capturado. **No se verificó**
contra la API real ni la subida real de un PDF en el navegador (la subida se prueba por unidad).

**Gates**: `tsc -p tsconfig.app.json` 0 · `eslint --max-warnings=0` sobre lo tocado 0 · specs del alta, de
`practitioner-fields`, del cliente IAM y del editor de perfil pasan. No se corrió la suite entera ni los `check-*.mjs`.

---

## Contabilidad: llave Doctor / Contador — 2026-10-26

`/administration/accounting` tiene una sola llave «Versión: Doctor | Contador». **Doctor** (por omisión) muestra el
resumen y tres registros: gastos, activos y deudas. **Contador** suma las pestañas Transacciones y Cuentas e
«Informes contables», con los enlaces a la vista contable y al balance y libro diario (antes, «¿Lleva usted la
contabilidad?» al pie del Resumen; ahora también desde Registros). La elección se recuerda en el navegador
(`mantra.contabilidad.version`). Es lo que se ve, no un permiso: la API sigue siendo la autoridad. Portado desde
`mockup`; el glosario «¿Qué significa cada cosa?» de esa rama todavía no existe en `dev`/`test`, así que aquí no se
filtra.

**Verificado en navegador** (Chromium contra `ng serve --configuration demo`, 12 verificaciones con
[`playwright/contabilidad-version.mjs`](../../../playwright/contabilidad-version.mjs); capturas en
`evidencias/contabilidad-version-2026-10-26-dev/`): pestañas de Registros por versión; la versión sobrevive a
recargar; volver a Doctor desde «Cuentas» cae en «Gastos»; sin desborde horizontal a 390 px. **No se verificó** contra
la API real (la contabilidad simple sólo existe con el simulador), ni con otros roles, ni en otros navegadores.

**Gates** (2026-10-26, sobre `dev`): `tsc -p tsconfig.app.json` sin errores · `eslint --max-warnings=0` sobre
`src/app/features/accounting` 0 · 95 pruebas de las 7 specs del módulo contable pasan (7 nuevas). No se corrió la
suite entera ni los `check-*.mjs`.

---

## «Servicios recibidos» en la historia — 2026-10-25

La historia del paciente (`/my-account/medical-record`, 6.ª pestaña), la ficha del médico (última pestaña) y el
PDF de «Descargar historia completa» muestran las intervenciones médicas realizadas y las vacunas. Contrato:
[`contracts/received-services.md`](../../contracts/received-services.md).

**Verificado en navegador** (Chromium contra `yarn start:demo`, 22 verificaciones con
[`playwright/servicios-recibidos.mjs`](../../../playwright/servicios-recibidos.mjs); capturas en
`evidencias/servicios-recibidos-2026-10-25/`): una sola tarjeta centrada (holgura 40/40 px) a todo el ancho del
área; las dos intervenciones y las dos vacunas con su costo y «Sin cobro registrado» para el titular; la médica
lee lo mismo **sin importes**; la ficha monta el panel solo al abrir su pestaña; sin desborde horizontal a 390 px;
`?seccion=recetas` sigue abriendo Recetas. **No se verificó** contra la API real (solo el simulador), ni con otros
roles, ni en otros navegadores, ni el PDF descargado visto abierto (sus bloques se prueban por unidad).

**Gates** (2026-10-25): `tsc -p tsconfig.app.json` 0 · `eslint --max-warnings=0` sobre lo tocado 0 · pruebas en
grupos por carpeta (la suite entera junta aborta en el entorno por un fallo de esbuild): 11.776 pasan y 6 fallan
igual sobre la base sin este cambio (`billing` maqueta/API real, `patient-list` ×2, `received-claims`,
`pharmacy-inbox`, `design-system-sample`). `check-api-contract-drift` y `check-doc-coverage` ya no nombran este
cambio; el resto de sus hallazgos ya estaba. `check-max-lines`: los archivos con techo que se tocaron
(`medical-record.ts`, `patient-chart.ts`, `patient-chart.html`) no crecen.

---

## Rescate de `wt-e2e` — 2026-10-14

- Se rescató de `wt-e2e` (sucio y 68 commits atrás) solo lo que sigue siendo válido sobre `origin/dev`: jerarquía de encabezados de la agenda (h3→h2, h4→h3), `<main>` anidado de la tienda de farmacia, nombre accesible de la marca en la cabecera pública, contraste de textos de estado (`--text-secondary`), `playwright/mac-motion-a11y.spec.ts`, la ampliación de `consulta-rejilla.spec.ts` y el cierre de verificación del 12/10.
- Descartado a propósito: registro de paciente, selector de ambulancias paralelo (la versión mergeada es #1079), `symptom-check`, `shell-layout`, `mock-banner`, tokens heatmap y `check-tokens.mjs`; y los cambios de specs que borran pruebas o cambian comportamiento sin cobertura. Las cifras de suite del 12 y 13/10 de `wt-e2e` no se trasladan: eran de un árbol que no es `dev`.
- El banco de componentes migra sus tres `<select>` nativos a `app-select` (verificado en navegador con `ng serve --configuration demo`).

**Actualización 2026-10-05:** piloto visual de `/dashboard` ejecutado para personal, administración y paciente. Jerarquía de jornada, accesos, reporte y próxima cita revisada en navegador; el mapa de actividad ya conserva contraste AA en claro/oscuro. Build y typecheck pasan; las 4 pruebas de navegador y la prueba unitaria mensual (29/29) pasan. `yarn lint` global sigue rojo por 256 errores ajenos a este piloto; lint del archivo E2E nuevo pasa.

Recorrido visual de `/schedule` y del menú móvil del encabezado verificado en Chromium con rol médico simulado: día, semana, mes e histórico del 3 de octubre con reservas/estados; grilla del modal con desplazamiento interno y dos columnas en la semana móvil. La vista mensual oscura a 320/390 px ya muestra conteos compactos (`N libres`/`Bloq.`), causas completas en nombres accesibles y sin overflow horizontal del documento. En «Más accesos», «Tutoriales» navegó a `/tutorials`, Escape cerró el menú y devolvió el foco; el documento no desborda a 320/390 px. **Cierre visual dentro del recorrido documentado**, sin afirmar cobertura de otros roles, navegadores o API real. Capturas y límites en `PLAN_PANEL_PRINCIPAL.md`, `EVIDENCIAS.md` y `QA_FINAL.md`.

---

**Última tarea verificada:** rama `justin/refac-ux-todo` · 2026-09-18 (tercera tanda: «todo pasa por el rediseño»).
**Alcance:** las 139 (médica) + 151 (paciente) + 275 (superadmin) combinaciones ruta × ancho del barrido
`playwright/refac-ux-barrido.spec.ts`, en 1440/768/390. Barrido fresco: médica 5/5, paciente 6/6,
superadmin 10/10; lo que queda marcado está justificado en `HALLAZGOS.md` § «Tercera tanda».

## Tercera tanda — qué se corrigió (verificado en navegador)

| Pantalla | Defecto | Arreglo |
|---|---|---|
| Evoluciones | 64 tarjetas, 12 000 px | `app-data-table`, 5 000 px; la fila abre la evolución |
| Encuesta (médico) | asociación a media página; respuestas sin su pregunta | a lo ancho; `<dl>` pregunta → respuesta |
| Nueva cotización | `.cotizacion__grilla` sin `display:grid`; plan apilado | mitades y tercios; 1 columna en 390 |
| Contabilidad | 6 indicadores en 4 columnas (2 huecos) | 3/2/1 columnas |
| Formularios | código largo desbordaba la tarjeta | `overflow-wrap:anywhere` |
| Solicitudes de vínculo | 64 casillas en una columna, 3 500 px | rejilla, 1 250 px |
| `file-input` (átomo) | `image/*` se mostraba «*» | «Imagen · PDF», test nuevo |
| Acceso delegado (sets) | editor de ítems en 1/3 del ancho | fila completa, campos a 2 columnas |
| Terminología | nota de ayuda a media página | caja a lo ancho, texto acotado |
| Agenda | aria-label del seguro sin el texto visible (WCAG 2.5.3) | «Aseguradora: ver la solicitud …, paciente» |

## Gates (2026-09-18)

`lint` 0 · `typecheck` 0 · `build` 0 (22 avisos de presupuesto, igual que la base) ·
`yarn test` 522/524 archivos; los 9 fallos son los preexistentes (work-history 7, instituciones 2).

## Bloqueos

Ninguno. D-05 aprobada y ejecutada.
