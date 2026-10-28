# Estado

## Alta de organización médica: paridad con imagenología + registro del SEDES + director médico — 2026-10-28

`/auth/register/medical-center` (hospital, clínica, consultorio, enfermería, otra) pedía tipo, razón social, tipo societario,
cinco PDF y un nombre+correo+clave. Ahora pide lo mismo que el centro de imagenología, sin los estudios por modalidad, más
los dos datos propios de un establecimiento de salud del contrato
(`healthFacilityRegistrationNumber` y `medicalDirector` con matrícula). Doce páginas: La organización (tipo, razón social,
tipo societario, NIT) → Datos del establecimiento (nº de registro ante el SEDES) → Director médico (nombre en partes,
matrícula, correo, teléfono opcional) → Documentación legal (los cinco PDF, **en una sola vista**, con `sinPartir`) → Casa
central en el mapa → Sucursales (opcional, hasta 50, con carga en lote) → Representante legal → Poder del representante →
Gerencia general / comercial / marketing (opcionales, todo o nada) → Su acceso.

- **Contrato enviado** (`POST /iam/auth/register-organization`): `organization.medicalFacility` (NIT, nº de registro,
  director, `headquarters`, `branches`), `legalRepresentative`, `executives`, `timeZone`, y el `owner` en partes (`name`,
  `middleName`, `lastName`, `motherLastName`, sin `displayName`). El owner es el representante legal, como en imagenología.
  Todo lo nuevo es aditivo: sin los bloques el cuerpo es el de siempre.
- **Se conserva**: catálogos de tipo / país / jurisdicción por código, `entreLasOpciones`, `signupErrorMessage`, código
  generado de la razón social, papeles opcionales por tipo societario (UNIPERSONAL sin constitución **ni poder**;
  PROFESIONAL_INDEPENDIENTE sin constitución ni matrícula de comercio pero **con** poder, como la API), pantalla de éxito
  con el mismo título («¡Bienvenido a AloVida! Su organización médica ya tiene cuenta»); ahora el aviso dice que queda en
  revisión / pendiente de verificación y nombra el correo al que fue la verificación.
- **Se extrajo a `features/auth/shared-registration/`** (la carpeta se llama así, no `registro-compartido`):
  `branches-editor/` (lista de sucursales con mapa por sucursal + lote CSV), `executives.ts` (controles, páginas y bloque de
  las tres gerencias) y `nameParts()` en `name-fields/person-name.ts` (nombre en partes para `owner` y `medicalDirector`).
  Ya existían y se reutilizaron: `app-paginated-form`, `app-map-location-picker`, `app-inline-name-fields`,
  `app-dropzone-pdf`, `legal-documents`, `password-policy`, `registration-help`, `onboarding-draft-banner`.
- **Desvío — `register-imaging-center` NO se migró** a las piezas extraídas: sus specs llaman a sus propios métodos
  (`agregarSucursal`, `escribirNombreDeSucursal`…), y migrarlo obligaba a cambiar esos specs (`NO_TEST_WEAKENING`). Las tres
  altas existentes (laboratorio, imagenología, farmacia) conservan su copia de las sucursales y de las gerencias; migrarlas
  es un trabajo aparte. Queda duplicado lo mínimo: el `SucursalDeclarada` de `branches-editor` tiene tres campos menos que el
  de imagenología (sin descripción ni enlace, que `medicalFacility.branches` no declara).
- **Borrador y telemetría**: formType nuevo `medical-center` (`OnboardingFormType`, filtro de `web-analytics`). El borrador
  **no guarda** la contraseña (lo hace `sinDatosPesadosNiSecretos`) **ni los `fileId` de los papeles** (la pre-carga puede
  vencer y la pantalla no sabría mostrarlos): quien retoma los vuelve a elegir. La API acepta cualquier `formType` como
  cadena; el embudo de `/telemetry/onboarding` no tiene pasos propios para `medical-center` (cae a los por omisión).
- **Gerencias a medias**: imagenología las descarta en silencio; acá, si alguna tiene algo y el bloque no está completo, no
  se envía y la pantalla pide completarlas o vaciarlas.
- **Simulador**: `core/mock/handlers/medical-facility.validation.ts` (+`core/data-access/iam/medical-facility.rules.ts`,
  compartido con la pantalla) valida `medicalFacility` como el `ValidationPipe`: NIT, nº de registro, director, coordenadas
  ambas o ninguna, hasta 50 sucursales (400) y 422 con un `tenantType` que no sea médico; responde
  `medicalFacilityRegistered: true`. Se corrigieron dos desajustes previos del simulador frente a la API: faltaba
  `PROFESIONAL_INDEPENDIENTE` en `VS_LEGAL_ENTITY_TYPE` y exigía constitución y matrícula a ese tipo.
- **Contrato del simulador a mano**: `api-contract.generated.ts` se parchó para declarar `medicalFacility`
  (`RegisterMedicalFacilityDto`, `RegisterMedicalDirectorDto`, `RegisterMedicalFacilitySiteDto`; nombres provisionales).
  Es un archivo generado: **hay que regenerarlo con `yarn contract:refresh` cuando la rama de la API con `medicalFacility`
  esté mergeada** (hoy `node scripts/gen-mock-contract.mjs --check` ya lo daba viejo por `SetPrimaryPractitionerDto`).

**Verificado en navegador** (Chromium contra `ng serve --configuration development,demo`, 172 verificaciones con
[`playwright/alta-organizacion-medica.mjs`](../../../playwright/alta-organizacion-medica.mjs); capturas, request y
respuesta en [`capturas/alta-organizacion-medica-2026-10-28/`](capturas/alta-organizacion-medica-2026-10-28/)): las 12
páginas a 1440 y a 390 px, sin desborde horizontal, la tarjeta centrada (holgura 80/80 px a 1440, 89 % del ancho) y a lo
ancho; el NIT, el registro del SEDES y la matrícula inválidos frenan y lo dicen; los cinco papeles caben en una vista; una
sucursal a medias frena y dice qué falta; la mutación completa UI → cuerpo HTTP exacto (`medicalFacility`, representante con
poder, tres gerencias, owner en partes) → respuesta del simulador (`medicalFacilityRegistered: true`) → pantalla de éxito; una
UNIPERSONAL sin constitución ni poder; un 409 real del simulador (correo repetido) con el mensaje en pantalla y el reintento
que sale bien. La petición se lee con un espía sobre el `HttpClient` del cliente (el simulador contesta dentro de la
aplicación: no hay petición de red que ver).

**No se verificó**: contra la API real ni contra Postgres (la rama de la API con `medicalFacility` va aparte; la
persistencia → recarga → UI sólo existe con la API real: el simulador no guarda la organización nueva); el 422 desde el
navegador (el formulario lo bloquea antes: lo cubren los specs del simulador y del cliente); la calle y el municipio
deducidos del punto (el sandbox no tiene red hacia el geocodificador: el campo queda en «Buscando…»); tema oscuro; 320, 768,
1024 y 1920 px (sólo 1440 y 390); lector de pantalla y teclado más allá de lo que miden los specs.
`playwright/cm-11-medical-center.spec.ts` se actualizó al flujo nuevo y su recorrido llega a la pantalla de éxito, pero la
prueba falla al final por un 404 de `/glossary-data/manifest.json` en la consola (fixture no generada en este entorno, no
tiene que ver con el alta) y las otras dos pruebas del archivo (la tarjeta en el selector de cuentas y «configurar
práctica») fallan en este entorno porque el selector sólo muestra Paciente y Médico: no se contrastó contra la base sin el
cambio. `playwright/cm-11-organizacion-medica-api-real.spec.ts` se adaptó a las páginas nuevas **sin ejecutarse** (exige la
API real, Postgres y el front en `real-api`); sus dos pruebas de la página «Su cuenta» (nombre, correo y clave en un
renglón) se reorientaron a la página del director médico porque aquella página ya no existe.

**Gates** (2026-10-28, sobre la rama, tras `yarn install --immutable`): `yarn lint` exit 0 · `yarn typecheck` exit 0 ·
`yarn build` exit 0 · pruebas: `yarn ng test` con todo junto muere en este entorno por un `fatal error: all goroutines are
asleep - deadlock!` de esbuild (ya anotado el 2026-10-25), así que se corrió por grupos de carpetas: `core` 3.492 · `shared`
2.399 de 2.402 · `features/auth+account+auth-providers` 2.579 (incluye `register-imaging-center.spec.ts` **sin tocar**) ·
`features/admin+clinical-record+agenda` 1.862 · el resto de `features` 2.257, es decir 12.589 pasan y 3 fallan: `pdf-theme.spec.ts`
«tinta-marca» (falla igual sobre la base, comprobado con `git stash`) y dos de `motion.spec.ts` que pasan solas y fallan sólo
dentro del grupo `shared` (no se contrastó contra la base en grupo). `check-*.mjs`: los dieciséis que se corrieron fallan o
pasan igual que antes del cambio (salida de antes y después comparada); el único que se movió es `check-max-lines`, donde
`auth.handlers.ts` (881 → 900), `concepts.ts` (1676 → 1679) e `iam.types.ts` (1025 → 1027) ya estaban por encima de su techo
congelado. `gen-mock-contract.mjs --check` ya daba viejo el contrato antes (`SetPrimaryPractitionerDto`) y ahora además
señala `medicalFacility` hasta que se regenere con la rama de la API.

---

## Glosario: ficha del término (port desde `mockup`) — 2026-10-28

Port del arreglo de la ficha `/glossary/:conceptId` pedido por el cliente («Biopsia»), hecho primero en `mockup`
(rama `claude/glosario-ficha-mockup`, con su evidencia en `evidencias/glosario-ficha-2026-10-28/`). Aquí el
glosario ya traía soluciones propias que se conservan: la fuente de «Datos» agrupada en chips (`fuentesAgrupadas`,
«MedlinePlus ×4»), las referencias en chips y la portada ilustrada de la cabecera. Se porta lo que faltaba:

- `app-relation-groups` modo `spread` (sólo la ficha): con el bloque ≥ 52 rem la columna de más de 6 vecinos toma el
  ancho principal y reparte sus vecinos en columnas de 15 rem, y las cortas van en un riel de 16–20 rem a su
  derecha; más angosto, se apilan a todo el ancho. Vecinos sin subrayado salvo al pasar/enfocar.
- Artículo: el cuerpo, tope 48 rem, centrado en su columna (sin franja vacía a la derecha); viñetas en las listas.
- «Explicado simple» como rótulo y el resumen en el cuerpo grande, sin acotar a 80ch.
- Pestañas del rediseño: `--r-lg` en vez de `--r-full` (la activa era una cúpula).

---


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
