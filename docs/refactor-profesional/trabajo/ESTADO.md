# Estado

## Alta de organización médica: segunda pasada de correcciones — 2026-10-28

Dos re-revisiones (código y visual) no hallaron HIGH; la visual dio 91/100 (umbral 92) por dos MEDIUM. Esta pasada corrige sólo
los siete puntos que pidieron. **No se auto-aprueba.**

1. **Nombre de sucursal: 200, no 300.** `branches-editor` usa `MEDICAL_SITE_NAME_MAX` (200, el de la API y el del simulador).
   Ya no corta en silencio lo escrito ni lo que trae el CSV: el nombre de 201 caracteres se conserva, se marca inválido
   (`El nombre no puede pasar de 200 caracteres.`, enseguida y sin esperar a «Siguiente») y la lista deja de ser válida;
   200 pasa. Specs en el editor (200 pasa / 201 no, escrito y por lote).
2. **Calle, distrito y nombre de sucursal ya no miden 1694 px.** `app-map-location-picker` ganó el input opt-in `disposicion`
   (`apilada` por omisión): la casa central usa `dos-columnas` (Calle | Distrito) y cada sucursal `tres-columnas`, con el nombre
   proyectado dentro del bloque (`[campo-previo]`) como primer campo de la rejilla: nombre | calle | distrito desde 1120 px, de a dos
   desde 672 px, uno por renglón debajo; los avisos y la ficha de la localidad cruzan toda la fila. Imagenología, laboratorio,
   farmacia y aseguradora no pasan el input: **mismo DOM y sin reglas CSS nuevas que los alcancen**. Comprobado en navegador:
   la geometría del selector de imagenología (central y una sucursal, a 1920/1440/1024/768/390) es **idéntica** entre `HEAD`
   (4bdfa85fa) y el código nuevo
   (`correcciones-2/head-imagenologia.json` vs `ahora-imagenologia.json`, coordenada por coordenada). Medido en la casa central: a 1920,
   Calle y Distrito 815/815 px (antes 1.668); en la sucursal, nombre/calle/distrito 493/519/519 (antes 1.608); a 1440, 333/359/359.
   Quedan sin medir el departamento/provincia/municipio de la ficha: el sandbox no tiene red hacia el geocodificador y la ficha queda
   en «Buscando…».
3. **Ayudas.** La tarjeta «Con este correo se entra» se movió de «Representante legal» a «Su acceso» (con la contraseña); el
   representante tiene ahora una tarjeta propia sin el correo. La de «Gerencia general» dice «Las tres gerencias, o ninguna». Specs que
   atan las ayudas a su página: toda ayuda es de una página que existe; una tarjeta que habla del correo está en una página que
   pide un correo; el correo del representante se explica en «Su acceso» y no en «Representante legal».
4. **Borradores viejos.** `sucursalesConIdsUnicos` renombra los ids repetidos al siguiente libre (la primera conserva el suyo);
   `fijarSucursales` —que también recibe lo restaurado— lo aplica. Specs del helper y de `restaurarBorrador`.
5. **Nombre completo de gerencia (3–200).** Con el bloque en uso, primer nombre **y** apellido paterno son obligatorios, y un nombre
   completo de 1–2 caracteres es inválido (`nombreCompletoCorto`; mensaje en `app-inline-name-fields`). Alcanza sólo a las gerencias:
   `nameGroup` de las demás altas no cambió. **Cambio de criterio respecto de la pasada anterior**: antes bastaba una parte del nombre
   («un apellido solo cuenta como nombre»); el spec que lo afirmaba pasó a afirmar lo contrario.
6. **Gerencias a medias.** «Primer nombre» y «Apellido paterno» llevan asterisco cuando el bloque está en uso (y celular y correo,
   por las páginas), y bajo «Apellido paterno» sale «Escriba el apellido paterno.». Probado el caso nombre cargado y apellido ausente
   (spec del componente, del grupo y de `app-inline-name-fields`: dos asteriscos, mensaje bajo el apellido, ninguno bajo el nombre).
   Con el bloque vacío no hay asteriscos ni mensajes.
7. **Diálogo de lote y simulador.** `app-branch-bulk-import` tiene el input opcional `maxSucursales`: el alta médica pasa 50 y el
   diálogo dice «Hasta 50 sucursales en total; las que sobren no se agregan.»; sin el input sigue diciendo «Hasta 300 sucursales por
   archivo» (organización, ficha de sucursales y las otras altas, sin cambio). El simulador rechaza TLD numérico o con dígitos
   (`a@b.12`) con `esCorreoComoLaApi`; el patrón de los formularios no cambió.

**Verificado** (de a un proceso por vez): `yarn lint` exit 0 · `yarn typecheck` exit 0 · `yarn build`
(`NG_BUILD_PARALLEL_TS=0 NODE_OPTIONS=--max-old-space-size=8192`) exit 0 · `gen-mock-contract.mjs --check` pasa · `yarn ng test`
dirigido (register-medical-center, shared-registration, core/data-access/iam, mock/handlers/auth*, imagenología, laboratorio, farmacia,
organización, paciente, web-analytics, branch-bulk-import, organization-branches y organization-detail): 35 archivos, 819 pruebas,
todas pasan. **Navegador**: `playwright/alta-organizacion-medica.mjs` a 1920, 1440, 1024, 768 y 390 px en claro y oscuro: 1246 de
1246 verificaciones, que ahora incluyen la disposición de lo deducido de la casa central y de la sucursal por ancho y que ninguna
casilla de texto pase de 900 px. Evidencia en
[`correcciones-2/`](capturas/alta-organizacion-medica-2026-10-28/correcciones-2/) (los `.json` completos y ocho capturas).
`check-max-lines` sigue rojo en la base: `map-location-picker.ts` pasó de 757 a 758 líneas (techo 600; una línea, la del input);
el resto igual.

**No se ejecutó**: el spec `cm-11-organizacion-medica-api-real.spec.ts` ni `cm-11-medical-center.spec.ts` (sin API real; sin tocar en
esta pasada), la ficha de departamento/provincia/municipio (sin geocodificador), la suite completa. Fuera de alcance, tal como se pidió:
aviso de borrador, `--text-danger`, spinner del localizador, tamaño táctil de «Quitar», extracción de `register-medical-center.ts`,
accesibilidad del mapa y el spec declarativo de disposición.

---

## Alta de organización médica: correcciones tras la auditoría de tres revisores — 2026-10-28

Los revisores auditaron `register-medical-center/`, `shared-registration/`, `core/data-access/iam/` y el simulador. Se corrigió lo
que pidieron (A–L) y nada más; **no se auto-aprueba**: los revisores re-auditan aparte.

- **A · ids de sucursal duplicados.** `BranchesEditor` repartía `sucursal-N` con un contador por instancia; el formulario paginado
  destruye y recrea el editor al cambiar de página y al restaurar un borrador, así que repetía `sucursal-1`. Ahora parte del mayor
  id de la lista (y del contador del editor, que se conserva para no reusar el número de una quitada). Specs: crear dos, recrear el
  editor y agregar; editar la nueva sin tocar las otras; restaurar un borrador y cargar en lote; ids salteados. Comprobado por
  mutación: con el arreglo revertido fallan 4 de los specs nuevos.
- **B · «   » pasaba `required`.** NIT, registro del SEDES, matrícula del director, documento del representante, razón social y
  primer nombre/apellido de director y representante cuentan ahora como dato que falta (`required`, con el mensaje de «falta» del
  campo). Pieza nueva `shared-registration/trimmed-text.ts` (`noSoloEspacios`, `largoRecortado`); `nameGroup(obligatorio,
  viajaEnPartes)` lo pide sólo si se lo piden, así que las demás altas no cambian. La razón social no estaba en la lista de los
  revisores: es el mismo defecto y se corrigió con él.
- **C · borrador.** `guardarBorrador` quita `password` por su cuenta (además de `OnboardingDraftService`); el spec asevera que ni la
  clave ni ningún `fileId` aparece en ningún argumento de `saveProgress`.
- **D · fuerza de las pruebas.** El spec afirma la disposición de **todas** las páginas, y que toda página de dos o más campos
  declare columnas. En `cm-11-organizacion-medica-api-real.spec.ts` la aserción de «una columna» se reemplazó por la medición real
  de la página del director (nombre en su renglón; matrícula, correo y teléfono en un renglón desde 1120 px, de a dos desde 672 px,
  una columna debajo). **Ese spec no se ejecutó** (exige la API real, Postgres y el front en `real-api`): sólo se comprobó con
  `tsc`.
- **E · columnas (regla 6 del cliente).** Organización a tres columnas; **Datos del establecimiento** (NIT + registro del SEDES) y
  gerencias a dos; director a tres con el nombre en su renglón (`ancho: 'completo'`); representante a dos. Para no dejar casillas
  sueltas (una página de un solo campo medía 1.614 px a 1920) se movieron **dos campos de página, sin tocar el contrato**: el NIT
  pasó de la primera a «Datos del establecimiento», y el correo del representante —que es el usuario de la cuenta— pasó a «Su
  acceso», junto a la contraseña. Las páginas del poder, el mapa, las sucursales y los papeles son zonas de carga o mapas, no
  casillas. En 672–1119 px el motor cruza el último campo de una cantidad impar (regla de `paginated-form.css`): en «La
  organización» el tipo societario ocupa el renglón entero (809 px a 1024).
- **F · gerencias.** El texto ya no dice «Todo este paso es opcional»: dice que son las tres o ninguna. Cada celular, correo y primer
  nombre vacío es `required` mientras haya algo escrito en el bloque (se revalidan entre sí), así que el motor frena en la página de
  la gerencia que falta con el mensaje junto al campo, y «Enviar» lleva a la primera afectada. La pantalla además marca las
  casillas del nombre al bloquear (`alRechazarPagina`). Se conserva el aviso de arriba como red de seguridad.
- **G · correos.** Director, representante y gerencias usan el patrón estricto de `register-patient` (extraído a
  `core/data-access/iam/strict-email.ts`; el alta de paciente lo importa sin cambiar de comportamiento).
- **H · `middleName` plegado.** Segundo + tercero + agregados no pueden pasar de 100 (`nombresAdicionalesLargos`, con el mensaje que
  ya mostraba `app-inline-name-fields`). Spec 60 + 1 + 59 (no) y 49 + 1 + 50 (sí).
- **I · analítica.** Se quitó «Organización médica» del filtro; `medical-center` sigue en `OnboardingFormType`.
- **J · contrato.** `api-contract.generated.ts` regenerado con `gen-mock-contract.mjs --api-ref claude/happy-noether-3qtam8`
  (e394a98c): los DTO se llaman `MedicalFacilityDto`, `MedicalDirectorDto`, `MedicalFacilityHeadquartersDto` y
  `MedicalFacilitySiteDto` (nada del front usaba los nombres provisionales); `--check` pasa. El simulador acepta `headquarters` y su
  nombre como opcionales (como la API: nace «Casa central»), valida IsEmail estricto, nombre de sede 200, 1–10 líneas de ≤ 500,
  `middleName`/`motherLastName` 100, teléfono 7–30, y devuelve 400 de forma antes que 422 de negocio. El cliente ya no manda la clave
  `headquarters` si no la hay. **Un spec del simulador cambió de sentido**: «400 — falta la casa central» pasó a «200 — la casa
  central es opcional», porque aquel comportamiento contradecía a la API real. No se validó el `owner` en el simulador (nunca se
  hizo).
- **K · duplicaciones y accesibilidad.** Un solo tope de 50 (`MAX_MEDICAL_FACILITY_BRANCHES`, pasado por `[maximo]`);
  `MEDICAL_TENANT_TYPES` salió a favor de `isMedicalOrganizationType`; comentario CSS corregido; el aviso del lote dice la verdad
  («se toman el nombre y el punto; la dirección se deduce del punto»); el error de una sucursal sale por `app-form-field`/`app-input`
  (nombre y mapa) en vez del `<p role="alert">`, y al quitar una el foco pasa a la vecina o a «Agregar sucursal».
- **L · techos de líneas.** `check-max-lines` sigue rojo en la base; la salida es la misma antes y después salvo `register-patient.ts`
  (3.374 → 3.368). No se tocaron `auth.handlers.ts`, `concepts.ts` ni `iam.types.ts`.

**Verificado** (rama, tras el reinicio del contenedor, de a un proceso por vez): `yarn lint` exit 0 · `yarn typecheck` exit 0 ·
`yarn build` exit 0 (con `NG_BUILD_PARALLEL_TS=0 NODE_OPTIONS=--max-old-space-size=8192`) · `gen-mock-contract.mjs --check` pasa ·
`yarn ng test` dirigido (register-medical-center, shared-registration, core/data-access/iam, mock/handlers/auth*,
register-imaging-center, register-laboratory, register-patient, register-pharmacy, register-organization, web-analytics): 32 archivos,
769 pruebas, todas pasan. **Navegador**: `playwright/alta-organizacion-medica.mjs` contra el servidor de desarrollo con la
configuración `development,demo`, a 1920, 1440, 1024, 768 y 390 px en **claro y oscuro**: 1186 de 1186 verificaciones (sin desborde,
tarjeta centrada, disposición en columnas por ancho, ningún campo corto sobre el 60 % de la rejilla, gerencias a medias, sucursal a
medias, la mutación completa en cada ancho, la UNIPERSONAL y el 409). Mediciones por página en
[`correcciones/mediciones.json`](capturas/alta-organizacion-medica-2026-10-28/correcciones/mediciones.json) y veredictos en
`veredictos.json`; se conservan sólo las capturas de las páginas tocadas (el script regenera todas). A 1920 px: matrícula/correo/
teléfono 504/504/413 px, NIT y SEDES 789/789 px, correo y contraseña 789/759 px; antes, una casilla por renglón (documento y correo del
representante 1.644 px, contraseña 1.614 px, medidos con el código anterior a esta corrección).

**No se ejecutó**: `cm-11-organizacion-medica-api-real.spec.ts` (sin API real) ni `cm-11-medical-center.spec.ts` (actualizados al
flujo nuevo, sólo `tsc`); la persistencia → recarga → UI (el simulador no guarda la organización); la suite completa (`yarn ng test`
entero) ni los `check-*.mjs` salvo `check-max-lines` y `gen-mock-contract --check`; geocodificación inversa (sin red). Fuera de
alcance, tal como se pidió: aviso «Borrador guardado», `--text-danger` en oscuro, spinner del localizador, tamaño táctil de «Quitar»
del dropzone y los tipos `medical-center` del embudo de telemetría.

---

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
