# Coordinación entre sesiones que editan este repo

Archivo vivo. Existe para que dos personas (o dos agentes) trabajando a la vez sobre
`justin/j3-t13-auth-y-cva` no se pisen. **Si vas a editar, agregá tu bloque antes de tocar nada.**

---

## Sesión en curso · Carril 1 — catálogo de servicios, presupuestos y PDF

**Empezó:** 2026-08-14 · **Ramas:** `carril-1/catalogo-presupuestos-pdf` en los dos repos,
cada una en su propio `git worktree` (`../mantra-core-health-carril1` y
`../mantra-core-health-redesa-api-carril1`) para no pisar el trabajo sin commitear que ya
había en ambos working trees (contabilidad en el backend, tutoriales/perfil público acá).
**Base:** `origin/dev` acá, `origin/master` en el backend.

Ver `CARRIL-1-catalogo-presupuestos-pdf.md` y `CARRILES-2026-08-14-README.md` para el plan
completo. Este bloque documenta un bloqueador real que ese plan ya anticipaba y cambia el
alcance de lo que este carril entrega hoy.

### 🔴 Bloqueador: `billing.budgets`/`billing.budget_lines` no sirven para presupuestos por paciente

El punto 5 del reclamo (presupuesto/cotización por paciente y procedimiento, precio libre por
doctor sobre el catálogo fijo) iba a apoyarse en `billing.budgets`/`billing.budget_lines`. Al
auditar las entidades (`mantra-core-health-redesa-api/src/modules/billing/entities/budgets.entity.ts`
y `budget_lines.entity.ts`) resultó que **están modeladas como presupuesto fiscal por centro de
costo**, no como presupuesto/cotización clínica:

- `budgets`: `practiceId`, `fiscalYearId`, `name`, `statusConceptId` — **sin `patientId` en
  ningún lado**.
- `budget_lines`: `budgetId`, `accountId`, `costCenterId`, `fiscalPeriodId`, `amount` — **sin
  referencia a `service_catalog`**, sin `quantity` ni `unitPrice` propios.

Confirmado que no hay otra entidad de respaldo: `grep` de `patientId`/`patient_id` en todo
`src/modules/billing/entities/*.entity.ts` no da resultados, y una búsqueda de
`quote`/`cotizacion`/`presupuesto` en el resto del backend tampoco encuentra nada relevante (solo
falsos positivos de otros dominios — ads, marketing). La forma que el punto 5 necesita ya existe,
pero en otro lado: `billing.invoices` (`patientProfileId`) + `billing.invoice_lines`
(`serviceId`, `quantity`, `unitPrice`, `description`) — repurposar esa tabla para cotizaciones
borrador se descartó porque `ledger.service.ts`, `dunning.service.ts`,
`patient-statements.service.ts` y `kpi-snapshots.service.ts` ya asumen que todo lo que hay en
`invoices` es contabilizable de verdad.

**Decisión (con el usuario, 2026-08-14):** extender `budgets`/`budget_lines` — agregar
`patient_profile_id` (uuid, FK a `profiles.patient_profiles`) a `budgets`, y a `budget_lines`
`service_catalog_id` (uuid, FK a `billing.service_catalog`), `quantity` (numeric),
`unit_price` (numeric, el precio que puso el doctor — nunca `service_catalog.default_price` a
ciegas) y `description` (varchar, opcional) — vía el pipeline `.puml` → `gen_ddl.py` →
`SQL/patches/`, que no vive en ninguno de los dos repos git (ver la advertencia de
`CARRILES-2026-08-14-README.md`). No se tocó ningún patch a mano.

**Queda pendiente para quien tenga acceso a ese pipeline.** En cuanto las columnas existan,
completo `BillingBudgetsController`/`BillingBudgetsService` (backend) y `budget-block` +
`budgets.client.ts` (frontend) exactamente como los describe `CARRIL-1-catalogo-presupuestos-pdf.md`.

### Qué entra en esta entrega, entonces

- **Backend:** `GET|POST /billing/service-catalog` completo (punto 3). Commit
  `4c2b36cc` en `mantra-core-health-redesa-api`. `yarn test` (4686/4687), `yarn typecheck` y
  `yarn lint` limpios sobre mis archivos; `yarn test:integration` corrido contra el stack local
  (15/18 suites OK — los 3 rojos son preexistentes y ajenos a este carril: P14
  (`identity-verification-cycle`, ya documentado y fuera de alcance de todos los carriles),
  `vademecum` (falta `SQL/patches/2026-07-30_vademecum_dev_seed.sql`, que no existe en esta
  máquina) y `audit-worm`).
- **Frontend:** cliente + pantalla admin del catálogo de servicios (`administration/services-catalog`),
  y `pdf-export.ts` como utilidad genérica reusable — ver detalle abajo, en curso.
- **Lo que NO entra:** `budget-block` (patient-chart), `budgets.client.ts`, y el backend de
  `billing-budgets`. Bloqueados por lo de arriba.

### Archivos nuevos (no chocan con nada)

```
src/app/core/data-access/services-catalog/services-catalog.client.ts  + .types.ts + .spec.ts
src/app/features/admin/services-catalog/services-catalog.ts           + .html + .css + .spec.ts
src/app/shared/utils/pdf-export/pdf-export.ts                         + .spec.ts
```

### Archivos existentes que toco (de la tabla de compartidos)

| Archivo | Qué le hago | Cuándo |
|---|---|---|
| `package.json` | Agrego `jspdf` | Último commit de la rama |
| `src/app/core/navigation/navigation.map.ts` | Una fila nueva al final del grupo **Administración**: `administration/services-catalog` | Último commit de la rama |
| `src/app/app.routes.ts` | Entrada en `PANTALLAS_DIFERIDAS` para esa sección | Último commit de la rama |

**No toco** `patient-chart.ts`/`.html` en esta entrega — el `budget-block` que iba a colgar ahí
está bloqueado (ver arriba). Cuando el schema exista, esa fila se agrega en una rama/PR aparte
sin reabrir esta.

### Lo que NO toco

`medication-block/`, `diagnosis-block/`, `registrarEncuentro()`/`cerrarEncuentro()`,
`accounting.client.ts` (leo `GET /practices` directo desde mi propio cliente para el selector de
práctica, no importo el cliente de contabilidad — son dos dominios distintos aunque el endpoint
sea el mismo), y todo `redsat/`.
---

## Sesión 2026-08-14 · Carril 4 — punto 10, laboratorios e imagenología

**Rama:** `carril-4/laboratorios-imagenologia` (los dos repos) · **Base:** `dev` en frontend,
`master` en backend (`src/modules/diagnostics/` y `src/modules/clinical/` son idénticos entre
`master` y `origin/dev`, así que la base no cambia nada de lo que toco) ·
**Plan:** `CARRIL-4-laboratorios-imagenologia.md` · `CARRILES-2026-08-14-README.md`

### Tres correcciones al plan del carril, encontradas al leer el código

1. **El carril no era «casi enteramente frontend».** El plan decía que los 20 endpoints ya
   construidos probablemente alcanzaban. No alcanzaban: `diagnostics` **no tenía ninguna
   lectura por paciente**. Se podía abrir una orden de trabajo, acesionar un espécimen, ingerir
   el mensaje del analizador y liberar el informe, y nadie podía preguntar qué se le pidió a una
   persona ni qué volvió. Es el mismo defecto que ya había tenido `scheduling` —lo dice su
   propia fila en `navigation.map.ts`— y que `ClinicalReadService` nombra para `clinical`.
2. **El alta de la orden ya existía, pero en otro módulo.** No hay que extender
   `diagnostics-lab`/`diagnostics-imaging`: una orden diagnóstica **es** una orden de servicio
   con categoría, y se crea con `POST /clinical/service-requests`, que ya acepta
   `patientProfileId` + `encounterId` + `codeConceptId`. Un alta propia en `diagnostics` habría
   sido una segunda puerta a la misma tabla.
3. **No hace falta ninguna columna nueva, así que el bloqueador de `SQL/` no aplica.**
   `clinical.service_requests` ya tiene `patient_profile_id`, `encounter_id` y
   `category_concept_id`; `clinical.diagnostic_reports` ya tiene `patient_profile_id` y
   `service_request_id`. Lo único que faltaba era el **concepto** de categoría «imagenología»
   (existía sólo `SR_LAB`), y eso se declara en `diagnostics.concepts.ts` — que es exactamente
   para lo que `defineModuleConcepts` espacia las claves por módulo, sin tocar ningún archivo
   compartido ni ningún patch.

### Qué creo (no choca con nada)

**Backend** — todo dentro de `src/modules/diagnostics/`: `dto/orders.dto.ts`,
`repositories/diagnostic-orders.repository.ts`, `services/diagnostics-orders.service.ts`,
`controllers/diagnostics-orders.controller.ts` (+ sus dos `.spec.ts`).
Endpoint nuevo: `GET /diagnostics/patients/:patientProfileId/orders`.

**Frontend** — `core/data-access/diagnostics/` (client + types + spec),
`features/diagnostics/` (la cola del laboratorio) y
`features/clinical-record/patient-chart/diagnostics-block/`.

### Qué toco de la tabla de archivos compartidos, y por qué

| Archivo | Qué le agrego |
|---|---|
| `navigation.map.ts` | una fila `diagnostics`, grupo **Atención**, al final del grupo. Roles `CLINICIAN`/`PRACTITIONER`, que son los `@Roles` reales de los 4 controladores de M20 y del de órdenes de M08 |
| `app.routes.ts` | una entrada en `PANTALLAS_DIFERIDAS` |
| `patient-chart.ts` (+ `.html`) | import de `DiagnosticsBlock` + una entrada en el ensamblado y un bloque en la plantilla, al final. **No** toco `registrarEncuentro`/`cerrarEncuentro` |
| `patient-chart.spec.ts` | un `responderCircuitoDiagnostico()` en el `afterEach`. Hizo falta porque mi bloque **lee lo suyo** (el circuito diagnóstico no sale de `GET /clinical/patients/:id/summary`), y esa petición aparece en toda prueba que pinte la ficha |
| `diagnostics.concepts.ts` | `SERVICE_REQUEST_CATEGORY_IMAGING`. Es de mi módulo, no compartido |

### Aviso para el Carril 3 (nos cruzamos en el mismo working tree)

A mitad de sesión, `patient-chart.spec.ts` quedó en rojo por `<app-procedures-block>`, que
dejaba tres peticiones abiertas que el `afterEach` del expediente no drenaba
(`GET /procedure-cases`, `GET /dental-procedures`, `GET /dental-procedures/catalog`). **No las
toqué** —son de tu carril— y las resolviste vos mismo mientras tanto, con
`responderHistoricoDeProcedimientos()`. Queda anotado porque las dos adiciones viven en el
**mismo `afterEach`**: si hay conflicto al mezclar es de dos bloques contiguos y se aceptan los
dos. Con las dos puestas, la suite entera queda verde (213 archivos, 2013 pruebas).

Mi commit **no incluye** tu mitad: los archivos compartidos se pusieron en el índice con sólo
mis líneas (`git hash-object` + `git update-index`), porque el working tree tenía las dos
adiciones entremezcladas y `git add` del archivo entero se habría llevado tu trabajo a medio
cablear dentro de mi rama.

### Lo que NO toco

`agenda.ts`/`booking-new.ts` (los leí como referencia) · `medication-block/` ·
`diagnosis-block/` (distinto de mi `diagnostics-block/`: otro dominio y otro archivo) ·
`procedures-block/` (carril 3) · `specialty-form-block/` (carril 2) · `budget-block/` (carril 1) ·
todo `redsat/` · `package.json` (ninguno de los dos repos) ·
`src/modules/clinical/` en el backend (leo sus entidades y sus conceptos, no los edito) · `SQL/`.

---

## Sesión 2026-08-14 · Carril 3 — punto 7, histórico de procedimientos (cirugía y odontología)

**Rama:** `carril-3/procedimientos-quirurgicos` (los dos repos) · **Base:** `dev` en frontend,
`master` en backend · **Plan:** `CARRIL-3-procedimientos-quirurgicos.md` ·
`CARRILES-2026-08-14-README.md`

### Dos correcciones al plan del carril, encontradas al leer el código

El documento del carril daba por buenas dos cosas que el repo no sostiene. Las dos cambian
qué hay que escribir, así que quedan acá antes que en el commit:

1. **La parte quirúrgica *sí* necesita backend.** El plan decía que alcanzaba con confirmar
   los 28 endpoints y, como mucho, agregar el filtro por paciente. El filtro **ya existe**
   (`ListCasesQueryDto.patientProfileId`, `periop.dto.ts:531`). Lo que no existe es la
   **lectura de hallazgos, implantes y pasos operatorios**: se escriben por `POST` y
   `GET /procedure-cases/:id` no los devuelve (`CaseDetailDto` trae equipo, diagnósticos,
   órdenes, plan e informes, y nada más). Sin eso, la definición de hecho del carril —«se ve
   su histórico con equipo, hallazgos e implantes»— es inalcanzable desde el frontend. Es el
   mismo defecto que `clinical.client.ts` ya nombra: escrituras que la pantalla no puede
   volver a leer.
2. **Odontología no necesita tabla nueva, así que el bloqueador de `SQL/` no aplica.**
   `clinical.procedures` es una tabla de procedimientos **general** (paciente, código,
   profesional, fecha, `note_text`, categoría) y `procedures_perioperative.procedure_body_sites`
   cuelga de ella con `body_site_concept_id` + `laterality_concept_id`: pieza y cuadrante. Los
   conceptos se siembran **desde TypeScript** (`defineModuleConcepts`, UUIDv5 determinista), no
   desde `SQL/`. El histórico odontológico entra entero en tablas que ya existen. **No hay
   patch de DDL en este carril y no hay que coordinar con quien tenga el modelo.**

### Archivos nuevos (no chocan con nada)

```text
backend  src/modules/procedures_perioperative/procedures_perioperative.concepts.ts
backend  src/modules/procedures_perioperative/repositories/periop-dental.repository.ts
backend  src/modules/procedures_perioperative/services/periop-dental.service.ts (+ .spec.ts)
backend  src/modules/procedures_perioperative/controllers/dental.controller.ts (+ .spec.ts)
backend  test/integration/dental-procedures.int-spec.ts
frontend src/app/core/data-access/procedures/procedures.client.ts (+ .types.ts + .spec.ts)
frontend src/app/features/clinical-record/patient-chart/procedures-block/ (ts+html+css+spec)
```

### Archivos existentes que toco, y por qué

| Repo | Archivo | Qué le hago |
|---|---|---|
| backend | `procedures_perioperative/dto/periop.dto.ts` | tres arrays nuevos **al final** de `CaseDetailDto` (`operativeSteps`, `findings`, `implants`) |
| backend | `procedures_perioperative/services/periop-cases.service.ts` | `getCaseDetail` suma tres lecturas al `Promise.all` |
| backend | `procedures_perioperative/repositories/periop-intraop.repository.ts` | tres `find*ByCase` nuevos, al final |
| backend | `procedures_perioperative/procedures_perioperative.module.ts` | registra el controller/service/repo odontológicos |
| backend | **`src/common/seed/module-concepts.ts`** | **compartido**: un `import` y un `...SPREAD` al final del arreglo. Ningún otro carril declaró conceptos todavía; si otro lo hace, son dos adiciones en líneas distintas |
| frontend | `patient-chart.ts` (+ `.html`) | import de `procedures-block` + una entrada en el ensamblado, **en el último commit** |
| frontend | `patient-chart.spec.ts` | un `responderHistoricoDeProcedimientos()` en el `afterEach`, al lado del del carril 4 — mis tres lecturas aparecen en toda prueba que pinte la ficha |
| frontend | **`proxy.conf.json`, `proxy.conf.docker.json`, `deploy/nginx.conf`** | **compartidos**: el prefijo `/procedure-cases`, al final de cada lista. Los tres o ninguno — `yarn check:prefijos` (`scripts/check-api-prefixes.mjs`) falla si se olvida uno, y el modo de fallo es el peor: anda en desarrollo y devuelve `index.html` en producción |

**Corrección a este mismo bloque, ya escrito:** al empezar leí la ficha contra `master`, donde
`medication-block/` y `diagnosis-block/` no existen, y anoté acá que el molde del plan era
imaginario. **Es al revés:** sobre `dev` los dos bloques están, y el molde del plan es exacto.
`procedures-block` sigue ese molde —`input.required<string>()` llamado `patientProfileId`, una
etiqueta en la plantilla al final del ensamblado— y no toca el arreglo `bloques()`, que es de
filas de una misma tabla. Quien venga de los carriles 1, 2 o 5: **arranquen de `dev`**, no de
`master`.

**Respuesta al aviso del carril 4:** drenadas. `patient-chart.spec.ts` tiene ahora un
`responderHistoricoDeProcedimientos()` al lado de tu `responderCircuitoDiagnostico()`, en el
mismo `afterEach` y con el mismo patrón. Las 75 pruebas de `patient-chart/**` pasan con los dos
bloques montados. Si hay conflicto al mezclar es de dos líneas contiguas: se aceptan las dos.

**Mi bloque no toma `[encounterId]`,** a diferencia de los tuyos y de los otros dos: un
histórico es de la persona, no de la consulta de hoy, y se lee igual sin encuentro abierto.
Tampoco emite `(cambio)` — mismo criterio que vos usaste para `diagnostics-block`.

### Lo que NO toco

`navigation.map.ts` · `app.routes.ts` · `package.json` (ninguno de los dos repos) ·
`registrarEncuentro()`/`cerrarEncuentro()` · `medication`/`diagnosis`/`specialty-form`/`budget` ·
todo `redsat/` · `src/modules/clinical/` (leo sus entidades, no las edito) · `SQL/`.

---

## Sesión 2026-08-13 · Port del sistema de diseño y las vistas de la bóveda

**Rama:** `pablo/redsat-vistas`, apilada sobre `pablo/contabilidad-frontend`.
**Por qué apilada y no desde `dev`:** los dos documentos que escribí
(`docs/design-system/port-redsat.md` y el bloque nuevo de
`docs/performance/budgets.md`) ya viajaron dentro de `b9ba311`, en la rama de
contabilidad. Naciendo desde `dev` los tendría duplicados y chocarían al
mezclar. Apilada, el PR muestra sólo el port y GitHub lo reapunta a `dev` en
cuanto el #73 entre.

Gracias por `f7a1371` — desacoplar las rutas REDSAT del PR de contabilidad fue
lo correcto. Las volví a cablear **acá**, que es donde corresponde.

### Qué entra

- **El sistema de diseño de la bóveda pasa a ser el del front.**
  `src/styles/redsat.css` es generado (`scripts/sync-redsat.mjs`) desde
  `SALUD/Vistas/HTML/_assets/redsat.css`. Se carga **después** de
  `src/styles.css`, y conviven: los tokens son disjuntos (castellano vs inglés).
- **126 pantallas portadas** desde las maquetas de la bóveda a
  `src/app/features/redsat/`, con sus rutas y sus dos marcos.
- **El armazón autenticado pasa al marco REDSAT.** `shell-layout.html` dejó de
  delegar en el organismo `app-shell`.

### Archivos nuevos (no chocan con nada)

`src/styles/`, `src/app/core/redsat/`, `src/app/features/redsat/`,
`public/redsat/`, `scripts/sync-redsat.mjs`, `scripts/port-vistas-redsat.mjs`,
`cypress/e2e/redsat-port.cy.ts`.

### Archivos existentes que toco, y por qué

| Archivo | Qué le hago |
| --- | --- |
| `angular.json` | agrega `src/styles/redsat.css` a `styles` |
| `src/index.html` | el script anti-parpadeo estampa también `data-tema` |
| `src/app/core/tokens/theme.service.ts` | segundo atributo de tema, para la hoja de la bóveda |
| `src/app/app.ts` | instala el runtime REDSAT y estampa el arquetipo de la ruta |
| `src/app/app.routes.ts` | `...REDSAT_ROUTES` al principio (6 líneas) |
| `src/app/features/shell-layout/*` | el marco, ahora REDSAT |
| `mkdocs.yml` | una entrada de nav |

### Lo que NO toco — es todo tuyo

`src/app/shared/components/organisms/{shell,side-nav,header}/` quedaron
**intactos**: el organismo `app-shell` sigue existiendo y lo usa la vitrina.
Tampoco toco `core/navigation/`, `core/auth/`, ni ninguna pantalla de features
fuera de `shell-layout`.

### Dos cosas que te afectan si tocás rutas

1. **`/directorio`, no `/organizaciones`.** El proxy desvía a la API todo lo que
   empieza con `/org`: esa ruta la respondía el backend con un 404. Misma trampa
   que documenta `proxy.conf.json`.
2. **Los segmentos nuevos** son `/inicio`, `/buscar`, `/accesos`,
   `/datos-compartidos`, `/terminologia`, `/directorio`, `/personas`.

### Verificación

`yarn test` 1873/1873 · `yarn lint` limpio · `yarn ng build` ok · 6 de 7 checks
verdes (`check-doc-coverage` sigue rojo por `AccountingClient`, que es
preexistente y no es mío). Contenedor `mantra-core-health-dev` recreado y
comprobado sirviendo la hoja, las tipografías y las rutas.

---

## Sesión 2026-08-08 · Atención (agenda + archivo clínico) y recorrido con usuarios reales

**Rama:** `pablo/combobox-referencia-y-ancla-accion` · **Base:** `22ca1c7`

### Qué se encendió, y por qué se podía

Las dos secciones del grupo **Atención** dejaron de ser un cartel. No hizo falta
backend nuevo: sus lecturas ya existían y nadie las había cableado.

| Sección | Lectura que la desbloquea |
|---|---|
| `/agenda` | `GET /scheduling/resources` · `/slots` · `/bookings` · `/bookings/:id` |
| `/clinico` + `/clinico/:profileId` | `GET /clinical/patients/:id/summary` · `GET /charts/patients/:id/chart` |
| Bloque nuevo en la ficha de paciente | `GET /authz/care-relationships` (V06-01) |

Se comprobó **contra los controllers**, no contra la tabla del vault, que el propio
documento advierte que no se actualiza sola.

Lo que **sigue** en placeholder y por qué: `administracion/organizaciones` (M04) y
`facturacion` (M17/M42) no tienen `GET` de colección. No se tocaron.

### Archivos nuevos

```text
src/app/core/data-access/scheduling/     cliente de agenda (+ tipos y spec)
src/app/core/data-access/clinical/       cliente de expediente (+ tipos y spec)
src/app/core/data-access/authz/          bases legítimas de acceso (+ tipos y spec)
src/app/features/agenda/                 pantalla de Agenda
src/app/features/clinical-record/        Archivo clínico + patient-chart/
e2e/real/                                recorrido con usuarios reales
e2e/recorrido/05-atencion.spec.ts        recorrido visual de las dos secciones nuevas
playwright.real.config.ts · scripts/run-recorrido-real.mjs
docs/testing/recorrido-con-usuarios-reales.md
```

### Archivos existentes tocados (poco, y con motivo)

| Archivo | Qué | Por qué |
|---|---|---|
| `app.routes.ts` | `agenda`, `clinico` y `clinico/:profileId` | encender las secciones |
| `navigation.map.ts` | las dos pasan a `disponible` | su lectura ya existe |
| `navigation.types.ts` | `SUPERADMIN` ve todas las secciones | es la regla del `RolesGuard` del backend; sin esto el menú escondía secciones que la API sí responde |
| `terminology.client.ts` | `readConceptLabels` trocea de a 200 | el endpoint declara ese tope y un expediente lo pasa sin esfuerzo |
| `select.html` · `select.ts` | la selección se marca con `[selected]` | **defecto real**: un select que nacía con valor mostraba el placeholder |
| `app.config.ts` | `LOCALE_ID: 'es-BO'` | `<html lang="es">` desde siempre, pero la agenda decía «Monday 10 Aug» |
| `proxy.conf*.json` | `/scheduling`, `/charts`, `/clinical`, `/authz` | y **sin** `/admin`: se comía `/administracion/**` |
| `patient-detail.*` | bloque de relaciones asistenciales | V06-01 |
| `evidencia.ts` · `generate-recorrido-report.mjs` | `EVIDENCIAS_DIR` | dos recorridos que no deben pisarse |

### Cinco defectos que encontró el recorrido con usuarios reales

Ninguno era visible con la red simulada, y ese es el argumento entero de la suite
nueva (`yarn recorrido:real`, ver `docs/testing/recorrido-con-usuarios-reales.md`):

1. **`/admin` en el proxy desviaba `/administracion/pacientes` a la API.** La
   sección quedaba en blanco con un `Cannot GET` de NestJS.
2. **`GET /scheduling/bookings` responde `422` sin acotar.** No existe «la agenda
   de toda la organización»; la pantalla se rediseñó alrededor de eso.
3. **`app-select` mostraba el placeholder cuando nacía con valor.** Es del sistema
   de diseño, no de la agenda; con formularios no se veía.
4. **Fechas en inglés.** Faltaba `LOCALE_ID`.
5. **La agenda confundía «no hay» con «no podés ver».** A un profesional recién
   registrado, `GET /scheduling/resources` le responde `403`, y la pantalla se
   caía a una lista vacía y decía «esta organización todavía no tiene recursos
   agendables». El M34 separa S3 de S5 exactamente por esto.

### Lo que queda dicho, no arreglado

- **Una recarga = un canje de refresh token**, y `token/refresh` está limitado a
  diez por minuto. Once recargas en un minuto cierran la sesión. Es por diseño
  —el access token no se persiste— pero conviene decidirlo a conciencia.
- **La suite real deja cuentas de prueba en la base**, igual que los smokes del
  backend.

### Verificación

`yarn lint` · `yarn typecheck` · `yarn test` (1297) · `yarn build` ·
`yarn e2e` (7) · `yarn recorrido` (40 pruebas, 674 capturas) ·
`yarn recorrido:real` (5 pruebas, 46 capturas, cero hallazgos).

---

## Sesión en curso · cierre de Fase 3 (J4, J8, J9 + Home)

**Empezó:** 2026-08-01 · **Rama:** `justin/j3-t13-auth-y-cva` · **Base:** `8d6b1d7`

### Archivos que estoy creando (nuevos, no deberían chocar)

```
src/app/core/http/api-error.ts              J4 · forma estable del error de la API
src/app/core/http/api-error.spec.ts
src/app/core/auth/auth.service.ts           J8 · sesión persistida, login/logout
src/app/core/auth/auth.service.spec.ts
src/app/core/auth/auth.guard.ts             J8 · authGuard / guestGuard / tenantGuard
src/app/core/auth/auth.guard.spec.ts
src/app/core/auth/session.storage.ts        J8 · persistencia del refresh token
src/app/core/layout/breakpoints.ts           tarjeta 10 · el shell pasa a cajón en móvil
src/app/core/data-access/public/             cliente del directorio público (carpeta nueva)
src/app/features/auth/login/                 J9 · pantalla de ingreso
src/app/features/auth/select-organization/   J9 · elección de organización
src/app/features/auth/forgot-password/       recuperación · sobre TU endpoint
src/app/features/auth/reset-password/        recuperación · sobre TU endpoint
src/app/features/shell-layout/               armazón de las pantallas con sesión
src/app/features/dashboard/                  panel autenticado (reemplaza el Home de Angular)
```

### Archivos existentes que estoy modificando

| Archivo | Qué le hago |
|---|---|
| `src/app/app.routes.ts` | Reestructura completa: `/auth/login`, `/auth/organizacion`, área protegida bajo el Shell |
| `src/app/app.routes.server.ts` | Las rutas con sesión pasan a `RenderMode.Client` (ver más abajo) |
| `src/app/app.config.ts` | Agrega el arranque de `AuthService` |
| `src/app/core/http/auth.interceptor.ts` | Solo la constante `LOGIN_ROUTE`: `/auth` → `/auth/login` |
| `src/app/features/home/` | **Se elimina**: era el boilerplate de Angular |
| `src/app/features/auth/auth.ts` | **Se elimina**: era `<p>auth works!</p>` |

### Lo que NO estoy tocando — es todo tuyo

- `src/app/shared/components/**` entero (átomos, moléculas, organismos) y sus `.css`
- `src/app/features/design-system-sample/**` (la vitrina)
- `src/app/core/tokens/**`, `src/app/core/view-state/**`
- `src/app/core/data-access/terminology/**` — es tuyo entero
- `src/styles.css`

### Respuesta a tu bloque · gracias, y dos cosas

**Usé tu recuperación de contraseña.** Están las dos pantallas: `/auth/recuperar` (pide el enlace)
y `/auth/restablecer?token=…` (lo consume). El «¿Olvidaste tu contraseña?» del login ya apunta ahí,
y respeté lo que marcaste: la pantalla **no interpreta el resultado exitoso**, muestra tu mensaje
tal cual y no dice en ningún caso si la cuenta existe. Hay una prueba que lo fija buscando que el
texto no contenga «no existe», «no encontramos» ni «no está registrado».

Toqué **dos archivos de `core/data-access/iam/`** (`iam.client.ts` y `iam.types.ts`) para agregar
`requestPasswordReset`, `resetPassword` y `logout`. Dijiste que sólo tocabas `terminology/`, así que
no deberíamos chocar, pero queda dicho. También agregué `forgot-password` y `reset-password` a
`PUBLIC_PATHS` del interceptor: sin eso, un 401 de recuperación dispararía un intento de refresco.

**Lo que dejé sin usar de lo tuyo:** el `$expand` de terminología, porque ninguna pantalla de las
que escribí tiene un campo de vocabulario. Tu cliente queda listo para la primera que lo necesite.

### Segunda ronda · usé los cuatro cierres del backend

Vi tu reescritura de `PENDIENTES-BACKEND.md`. Los cuatro están consumidos y verificados contra la
API ya reconstruida:

- **`FORBIDDEN_IDENTITY_HINTS` borrada**, como pediste. `api-error.ts` ramifica sobre
  `IDENTITY_VERIFICATION_REQUIRED` y guarda `details.reason`. Un detalle que quizá te interese:
  **`no-person-linked` no ofrece el trámite de verificación** — mandar a verificar la identidad de
  una persona que todavía no está vinculada a la cuenta sería un callejón con cartel de salida—.
  Los otros dos subcasos sí lo ofrecen.
- **`POST /iam/auth/logout` se llama al cerrar sesión.** Verificado en el navegador: después del
  logout, reusar el refresh token da 401.
- **Claims `name` y `tenantNames` en uso.** El encabezado dice «Administrador Postman» y la
  elección de organización muestra «Mantra Core Default Tenant». Ambos con respaldo al identificador
  acortado si el claim falta, porque los omitís cuando están vacíos.
- **La recuperación de contraseña ahora sí responde**: pedir el enlace da 202 contra la API real.

**El `correlationId` ya está arreglado** (PR #25 de la API, mergeado). Viajaba como número aunque el
DTO lo declarara `string`: `pino-http` numera las peticiones y el tipo inline del filtro lo declaraba
`string` con un cast que silenciaba la contradicción, así que el compilador nunca la vio. Se
normaliza en el filtro, no en cada cliente, porque el contrato publicado es el del servidor.

Toqué **solo** `all-exceptions.filter.ts` y su spec, en una rama aparte, para no arrastrar tus 167
archivos en curso. De paso quedaron cubiertos dos casos que se perdían: `x-request-id` repetido
—Express lo entrega como array y el cast dejaba pasar el array entero— y los `NaN`, que ahora quedan
`undefined` en vez de convertirse en el texto «NaN».

**Un aviso de proceso:** en una corrida vi `data-table.spec.ts` fallar entero y a la siguiente pasar
sin tocar nada. Si te aparece, mirá si no estábamos corriendo `yarn test` los dos a la vez.

---

## Sesión en curso · cola de Pablo (backend) + cliente de terminología

**Empezó:** 2026-08-01 · **Rama:** `justin/j3-t13-auth-y-cva` · **Base:** `8d6b1d7`

Casi todo mi trabajo está en **el otro repositorio** (`mantra-core-health-redesa-api`). Acá toco
sólo lo que ese trabajo desbloquea, dentro de lo que tu bloque marca como mío.

### Archivos que estoy creando (nuevos, no chocan con los tuyos)

```
src/app/core/data-access/terminology/terminology.types.ts    P3 · contrato del $expand de lectura
src/app/core/data-access/terminology/terminology.client.ts
src/app/core/data-access/terminology/terminology.client.spec.ts
```

Reemplaza el `README.md` de esa carpeta, que documentaba por qué estaba vacía.

### Lo que NO estoy tocando

Nada de lo tuyo: ni `core/auth/**`, ni `core/http/**`, ni `features/**`, ni `app.routes.ts`,
ni `app.config.ts`. El resto de `core/data-access/**` tampoco cambia.

### Lo que cambió del lado de la API y te sirve

- **`GET /terminology/value-sets/:id/$expand`** ya existe: autenticado, **sin exigir rol de
  administración**, paginado por cursor. Verificado contra la API viva.
- **`POST /iam/auth/forgot-password`** y **`POST /iam/auth/reset-password`** ya existen, ambos
  públicos. El enlace «¿Olvidó su clave?» del diseño ya tiene a dónde apuntar: `forgot-password`
  responde **202 y el mismo mensaje siempre**, exista o no la cuenta — no muestres «ese correo no
  está registrado», el backend no te lo va a decir a propósito.
- **La cuenta de demostración se siembra sola** al arrancar la API si están
  `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`; ya no hace falta `yarn postman:bootstrap`
  a mano.

---

## Dos decisiones que te afectan si tocás rutas

**1. Las rutas con sesión no se pueden prerenderizar.** La sesión vive en el navegador
(`localStorage` + memoria) y el servidor no la ve, así que prerenderizar una pantalla protegida
produce HTML de «no autenticado» que después parpadea al hidratar. Por eso el área protegida va
con `RenderMode.Client` y solo `/auth/**` sigue prerenderizada.

**2. El guard espera a que la sesión se restaure.** Al recargar, `AuthService` cambia el refresh
token guardado por un par nuevo (una petición). Si el guard leyera el store antes de eso, echaría
al login a alguien que sí tiene sesión. `authGuard` hace `await auth.ensureRestored()` primero.
Si agregás un guard nuevo sobre el área protegida, hacé lo mismo.

---

## Cómo levantar todo

```bash
# Almacenes (nunca el servicio `api` del compose: arranca con DDL propio)
docker compose up -d postgres mongodb redis opensearch minio

corepack yarn start          # API, en su repo, puerto 3000
corepack yarn start          # frontend, acá, puerto 4200
```

**Cuenta de demostración** (la siembra `yarn postman:bootstrap` en el repo de la API):

```
admin@redesa.test / S3cret-passw0rd
```

Verificada hoy contra la API viva: devuelve 200 con roles `SECURITY_ADMIN`, `SUPERADMIN` y un
tenant. Es la que usa la pantalla de login para la demo.

---

## Sesión en curso · endurecimiento para producción (código)

Cierro los pendientes de código del portal documental: seguridad, errores,
accesibilidad, sesión y pruebas. **No toco nada de telemetría** — ver abajo.

### Archivos que estoy creando (nuevos, no chocan)

```text
src/server/security-headers.ts        + .spec.ts
src/app/core/build/build-info.ts
src/app/core/errors/error-reporter.ts + .spec.ts
src/app/core/errors/app-error-handler.ts
src/app/shared/a11y/announce-on-appear.ts + .spec.ts
src/app/features/error-recovery/
src/app/features/not-found/
src/app/features/identity-verification/
src/app/features/dashboard/dashboard.spec.ts
src/app/features/shell-layout/shell-layout.spec.ts
src/app/core/http/token-refresh.service.spec.ts
```

### Archivos existentes que estoy modificando

| Archivo | Qué |
|---|---|
| `src/server.ts` | Cabeceras de seguridad + CSP por hash |
| `src/app/app.config.ts` | `ErrorHandler` propio, cierre de sesión entre pestañas |
| `src/app/app.routes.ts` | Rutas `/error`, `/identidad/verificar`, 404 en el comodín |
| `src/app/core/http/error-to-view-state.ts` | `IDENTITY_VERIFICATION_ROUTE` apuntaba a la API, no al router |
| `src/app/core/http/auth.interceptor.ts` | Refresco proactivo con `isAccessTokenExpired` |
| `src/app/core/auth/auth.service.ts` · `refresh-token.storage.ts` | Organización persistida, oyente de `storage` |
| Las 6 plantillas de `features/auth/` | Directiva `appAnuncio` (región viva + foco) |
| `src/app/features/shell-layout/shell-layout.ts` | Ítem de menú de la pantalla nueva |
| `src/app/shared/index.ts` | Exporta `AnnounceOnAppear` |

### 🔴 Telemetría: la dejé fuera, está tuya

Tu trabajo de OpenTelemetry (`TelemetryEnvironment`, el manifiesto de las seis
`PUBLIC_TELEMETRY_*`, `docs/observability/angular/`) estaba **a medio camino**:
`yarn env:generate` fallaba y `tsc` daba
`Property 'telemetry' is missing in type`.

**No lo commiteé y no lo perdí.** Está respaldado en:

```text
/tmp/telemetria-en-curso/{generate-env.mjs,environment.types.ts,
                          environment.ts,environment.development.ts}
```

Para retomarlo: esos cuatro archivos son tuyos tal como los dejaste. Lo único
que necesitás saber es que **yo agregué cosas a dos de ellos** después de tu
copia, así que conviene reaplicar lo tuyo encima de lo que está en `dev` en vez
de restaurar el respaldo tal cual:

| Archivo | Lo que agregué yo |
|---|---|
| `src/environments/environment.types.ts` | La interfaz `BuildInfo` (versión, commit, `builtAt`), **antes** de `Environment` |
| `scripts/generate-env.mjs` | `readBuildInfo()` y la emisión de `export const buildInfo` en `render()`. **No toca el MANIFIESTO** |

Tu `EnvironmentOverrides` y mi `BuildInfo` no se pisan: son declaraciones
distintas en el mismo archivo. Y `buildInfo` no pasa por el manifiesto a
propósito — no es configuración que alguien publique, es la huella del build.

**Lo que te dejo servido:** `src/server.ts` ya emite `connect-src` a partir de
`PUBLIC_API_BASE_URL`. Si el endpoint de trazas queda relativo (`/otel/v1/traces`,
como dice tu `01-architecture-design.md`), **la CSP no necesita ningún cambio**:
`connect-src 'self'` ya lo cubre. Si terminara en un subdominio propio, hay que
agregarlo en `contentSecurityPolicy()` y ahí tenés la prueba que lo fija.

### Lo que NO estoy tocando — es todo tuyo

```text
docs/observability/angular/**
Todo lo de OpenTelemetry: SDK, spans, sampler, propagación
El MANIFIESTO de scripts/generate-env.mjs
```

---

## Actualización · segunda tanda

### Tu trabajo está en tu worktree, y no lo toqué

Encontré `.claude/worktrees/otel-jaeger-tracing` con la rama
`feat/otel-jaeger-tracing`. Comparé lo que tenés ahí contra los respaldos de
`/tmp/o1` y `/tmp/o2`: **lo tuyo está más avanzado que mis copias** —tenés
`observability.providers.ts`, `error-telemetry.ts`, `router-tracing.ts`, los
specs, y cuatro documentos más en `docs/observability/angular/`—.

Así que **no restauré nada**. Restaurar habría sido pisar tu trabajo con una
versión vieja. Los respaldos siguen en `/tmp/o1` y `/tmp/o2` por si acaso, pero
podés ignorarlos.

### Dos cosas que cambié y te afectan

| Qué | Por qué te importa |
|---|---|
| `.gitignore` ahora ignora `.claude/` | Tu worktree vive ahí dentro. Sin esto, el repositorio se contendría a sí mismo |
| `eslint.config.js` fija `tsconfigRootDir` | Tu worktree tiene su propio `tsconfig.json`, y typescript-eslint encontraba **dos raíces candidatas** y se negaba a elegir: `yarn lint` se caía entero con 508 errores de parseo. Ahora la raíz está dicha en voz alta y deja de depender de qué haya en el disco |

El segundo lo vas a agradecer: sin él, `yarn lint` no corre mientras tu worktree
exista.

### Lo que agregué en esta tanda

```text
e2e/                                        Playwright · 7 journeys de sesión
playwright.config.ts
src/testing/a11y.ts                         ayudante de axe-core
src/app/shared/components/a11y.spec.ts      auditoría de 13 componentes
src/app/core/http/timeout.interceptor.ts    30 s · 120 s en subidas
src/app/core/auth/idle-logout.ts            15 min con aviso a los 13
.github/workflows/ci.yml                    job `e2e`
```

Y toqué `src/app/core/auth/auth.service.ts` (el orden al cerrar sesión) y
`src/app/shared/components/atoms/select/select.ts` (`ariaLabel`). Ninguno de los
dos entra en tu superficie.

### Lo que sigue siendo tuyo, sin cambios

```text
docs/observability/angular/**
Todo lo de OpenTelemetry: SDK, spans, sampler, propagación
El MANIFIESTO de scripts/generate-env.mjs
src/app/core/observability/**
src/server/telemetry/**
```

`docs/observability/error-reporting.md` y `docs/observability/tracing.md` sí los
edité: tenían enlaces a anclas que renombré en `error-boundaries.md` y afirmaban
que la captura de errores no existía. Son párrafos sueltos, no tu contenido de
OpenTelemetry.

---

## Sesión cerrada · I2 organismo de estado de trámite (status-seal)

**Empezó:** 2026-08-05 · **Rama:** `itzan/i2-organismos-estado` · **Base:** `aeeb7fc`
**Cerró:** 2026-08-06 · PR #21 mergeado a `dev` y rama borrada. El organismo `status-seal`
y el mapa `case-status.ts` quedaron disponibles para todos.

### Archivos que estoy creando (nuevos, no deberían chocar)

```text
src/app/shared/components/organisms/status-seal/         I2 · sello de estado de trámite/caso
src/app/features/identity-verification/case-status.ts    I2 · mapa status_concept_id → variante del sello
src/app/features/identity-verification/case-status.spec.ts
```

### Archivos existentes que estoy modificando

| Archivo | Qué le hago |
|---|---|
| `src/app/shared/components/organisms/index.ts` | Export del organismo nuevo |
| `src/app/features/design-system-sample/organisms-gallery/*` | Sección nueva del sello (h3 — no toco las 26 secciones h2 de la vitrina principal) |
| `src/app/features/identity-verification/identity-verification.{ts,html,spec.ts}` | El estado del caso pasa de texto crudo al sello, dentro del `<dd>` existente |
| `src/app/shared/components/a11y.spec.ts` | Línea del organismo nuevo en la auditoría central |
| `docs/components/catalog.md` · `docs/reports/generated/{component-inventory,module-graph}.md` | Alta del organismo (gates de doc-coverage e inventario) |
| `docs/routes/design-system.md` · `docs/governance/documentation-policy.md` | Conteos al día: 49 componentes / 15 organismos |
| `docs/routes/identidad-verificar.md` | Lista de componentes de la ruta al día |
| `scripts/lib/scan.mjs` · `scripts/generate-inventory.mjs` | Fix mínimo de portabilidad Windows (`URL.pathname` → `fileURLToPath`, backslashes → `/`): sin él, todos los gates de docs/inventario crashean en Windows |

### Lo que NO estoy tocando — es todo tuyo

- `src/app/core/**` completo (auth, http, data-access, tokens, view-state, observability)
- `src/app/features/auth/**` · `dashboard/**` · `shell-layout/**`
- `src/styles.css` y `src/app/shared/components/tone/**` (consumo los tonos, no los cambio)
- `src/app/app.routes.ts` y todo el ruteo · `e2e/**` · `.github/**`

---

## Sesión en curso · W2 vistas Fase 0 — identity_assurance, delegated_access, auth_providers

**Empezó:** 2026-08-07 · **Rama:** `itzan/w2-vistas-fase0-identidad-acceso` · **Base:** `e33e190` (dev)

Carril W2 del plan de la semana: las 37 vistas de Fase 0 de M27/M29/M40. Se construye por
fases (V27-01 primero, después autoservicio V27, V29 completo, V40, y V27 admin al final).
Las tablas sin `GET` de colección quedan en `ViewState` S3 con TODO, como manda el plan.

**Rehecha sobre `dev` el 2026-08-10.** W2 se entregó como cadena de cuatro PRs apilados
(#34 → #37), y la cadena se mergeó en orden inverso: cada eslabón entró en su propia base
antes de que esa base recibiera al siguiente, así que el contenido nunca llegó a `dev` —
`itzan/w2-pr1` quedó con la mitad de W2 y los módulos M40 y M27 admin quedaron sin PR que
los llevara. La entrega vive ahora en **una sola rama** sobre `dev` al día. Las cuatro
`itzan/w2-pr1…pr4` quedan obsoletas.

### Archivos que estoy creando (nuevos, no deberían chocar)

```text
src/app/features/identity-assurance/**       vistas M27 (casos propios, verificaciones, admin)
src/app/features/delegated-access/**         vistas M29 (asignaciones, delegados, permisos…)
src/app/features/auth-providers/**           vistas M40 (proveedores, claves, vínculos…)
src/app/core/data-access/delegated-access/   client nuevo M29 (mismo molde que los existentes)
src/app/core/data-access/auth-providers/     client nuevo M40
```

### Archivos existentes que estoy modificando

| Archivo | Qué le hago |
|---|---|
| `src/app/core/data-access/identity/*` | Agrego el listado propio (`GET /identity/me/verification-cases`) y `requestTenantVerification` (`POST /identity/me/tenants/:id/verification`) — solo métodos nuevos, no toco los existentes |
| `src/app/core/navigation/navigation.map.ts` | Filas nuevas para las secciones de mis 3 módulos (incluye rol `IDENTITY_ADMIN`, que hoy no existe en el mapa) |
| `src/app/app.routes.ts` | Filas en `PANTALLAS_DIFERIDAS` para mis secciones + rutas hijas de detalle (`identidad/casos/:caseId`) con la sección madre en `data` — no reestructuro nada |
| `app.routes.spec.ts` · `shell-layout.spec.ts` · `navigation.service.spec.ts` | Solo las listas esperadas del menú/rutas, que fijan inventario: cada sección nueva las mueve. En `app.routes.spec` la promesa de huérfanas ahora distingue fichas de detalle y les exige la sección madre en `data` |
| `src/app/features/identity-verification/*` | Extendido (F2): selector de trámite con las 4 variantes de autoservicio — paciente, profesional, matrícula y organización (esta última elige entre los tenants del token). El flujo paciente no cambia |
| `docs/**` (catálogo, rutas, inventario) | Solo las altas que exijan los gates de documentación |

### Lo que NO estoy tocando — es todo tuyo

- `src/app/shared/components/**` (átomos, moléculas, organismos) y `src/styles.css` — si un
  hueco del banco me obliga a una pieza nueva, la propongo acá antes de escribirla
- `src/app/features/auth/**` · `admin/**` · `dashboard/**` · `shell-layout/**` · la vitrina
- `src/app/core/auth/**` · `core/http/**` · `core/tokens/**` · `core/view-state/**`
- `.github/**` · todo lo de OpenTelemetry y telemetría
- `cypress/**`, con **una sola excepción declarada**: la lista de rutas esperadas del menú en
  `cypress/e2e/navigation/navegacion.cy.ts`. W2 suma `identidad/casos` al registro de
  navegación, y esa sección no exige rol, así que aparece en el menú de cualquier sesión y el
  `deep.equal` del spec deja de cerrar. Se agrega la ruta a la lista y nada más: ni la lógica
  de la suite ni sus otros casos se tocan. Es la misma regla que ya aplicamos en el resto de
  la entrega — una expectativa derivada viaja con el cambio que la provoca

---

## Sesión en curso · E2 rediseño de auth con Stitch (familia expediente)

**Empezó:** 2026-08-07 · **Rama:** `ender/e2-auth-stitch` · **Base:** `f8e2435`

Rediseño **solo visual** de las pantallas de autenticación siguiendo los Stitch.
Familia base **expediente**; kardex solo como acento donde encaje; **MFA fuera de
alcance** (sería pantalla/ruta/contrato nuevos). Stitch guía estructura, jerarquía,
disposición y densidad: **no** se copian Tailwind, hex, fuentes ni tokens de
Material. Color y tipografía salen **exclusivamente** de los tokens REDSAT de
`styles.css`. Sin cambios de lógica, rutas, contratos, `data-testid` ni accesibilidad.

### Archivos que voy a modificar (por lotes; empiezo por Lote 1)

| Archivo | Qué |
|---|---|
| `src/app/features/auth/login/login.{html,css}` | **Lote 1** · jerarquía tipo documento (membrete/reglas/anexo) |
| `features/auth/{register-patient,tenant-selection,forgot-password,reset-password,verify-email}/*.{html,css}` | Lotes siguientes (aún no tocados) |
| `shared/components/organisms/auth-split.{html,css}` | **Solo si** un lote lo exige (columna de marca); a coordinar |

### Lo que NO estoy tocando

- Ningún `.ts` / `.spec.ts`, ni rutas, ni `e2e/**`, ni `.github/**`.
- `src/styles.css`, `core/**`, y el resto de `shared/components/**`.

---

## Sesión en curso · IT2 · el Acto 3 recorrido en un navegador

**Empezó:** 2026-08-11 · **Rama:** `itzan/it2-recorrido-acto3-navegador` · **Base:** `85463fe`

Último tramo de IT2. Las tres entregas anteriores —el refresco del historial, la
cola de admin y su endpoint— ya están en `dev` (PR #47 y #49 acá, #45 en la API).
Falta lo que la tarjeta pide para darla por terminada: **el ciclo corrido dos
veces seguidas, con capturas**.

### Archivos tocados (solo estos dos)

| Archivo | Qué |
|---|---|
| `cypress/e2e/real/07-cola-de-revision.cy.ts` | Nuevo. Los cuatro pasos del Acto 3, **todos por pantalla**: el paciente sube su documento en `/identidad/verificar`, el caso aparece en la cola, el revisor lo escala y lo aprueba con los formularios de M27, y el titular lo ve aprobado |
| `cypress/support/real/sesion.ts` | Arregla una carrera de hidratación en `entrar()` que rompía **cualquier** ingreso de la suite `real` |

Sólo dos transiciones quedan fuera de la interfaz —ninguna del guion— porque no
tienen pantalla propia: la consulta del catálogo que resuelve el motivo de la
revisión, y la lectura que comprueba que un caso escalado sigue en la cola.

### Cómo se corre contra la API viva — leé esto antes de tocar `cypress/e2e/real/`

La suite `real` **no llega al backend con su invocación por defecto**: el arnés
sirve la aplicación con `PUBLIC_API_BASE_URL` vacío y una API simulada delante,
así que todo `/identity` vuelve `404`. Para recorrer de verdad hacen falta las
dos variables, y por motivos distintos:

```
corepack yarn start                       # ng serve usa proxy.conf.json → API real en :3000
E2E_SUITE=real E2E_BASE_URL=http://localhost:4200 corepack yarn test:e2e --spec "<ruta>"
```

- `E2E_BASE_URL` puesta ⇒ `levantarServidor: false` ⇒ **el arnés no se levanta**.
- `E2E_SUITE=real` ⇒ saca `cypress/e2e/real/**` del `excludeSpecPattern`. Sin
  ella el mensaje es «no spec files were found», que no menciona la exclusión.

### La carrera de hidratación, para quien la herede

La aplicación se sirve con render del servidor: el formulario existe en el HTML
antes de que Angular lo hidrate, y las teclas pulsadas en esa ventana se pierden.
Medido en dos corridas seguidas: se tecleó `CI-E2E-…` y quedó `E2E-…` (tres
caracteres) y después `I-E2E-…` (uno). Número variable ⇒ carrera, no `maxlength`.

El síntoma engaña: `POST /iam/auth/login` responde **401 con las credenciales
correctas**, y la culpa parece del dato. `esperarAplicacionLista()` no lo cubre —
comprueba que la aplicación pintó, no que el campo escuche.

### Lo que NO estoy tocando

- `src/**` entero: esta entrega no cambia una línea de la aplicación.
- `cypress/harness/**` (el arnés y su API simulada), `cypress/e2e/` fuera de
  `real/07-…`, rutas, `navigation.map.ts`, `app.routes.ts`, `.github/**`.

---

## Sesión cerrada · IT2 · estados de caso con datos reales (el sello del titular)

**Empezó:** 2026-08-12 (nocturna) · **Rama:** `itzan/it2-estados-caso-sello` · **Base:** `c6081bb` (dev)
**Cerrada:** mergeada como #57 el 2026-08-12 por la mañana.

El delta que le falta a IT2 sobre el 07 ya mergeado: asertar el **sello del titular
ANTES** (En revisión) y **DESPUÉS** (Aprobado/Rechazado) en `/identidad/casos` y en el
detalle `/identidad/casos/:caseId`, con captura de cada estado. Contexto del P14,
medido contra la API viva: el 500 del registro solo salta cuando el payload lleva el
nombre en **4 partes** (lo que manda la pantalla del front — eso sigue roto y es del
carril backend, PR #56); el contrato viejo de `actores.ts` registra **201**, así que
esta suite crea sus actores igual que el 06 y el 07, sin ningún fallback.

---

## Sesión en curso · IT1 · los dos recorridos del viernes (rev. 2)

**Empezó:** 2026-08-12 · **Rama:** `itzan/it1-recorridos-viernes` · **Base:** `c6081bb`,
con `origin/dev` (`2b359b9`, incluye #57/#58/#59) mergeado el 2026-08-12 por la tarde.

Estructura de los dos caminos que se recorren el viernes con el cliente, al
estilo del 07: los tramos que ya están en `dev` corren y quedan verdes; los que
esperan merges ajenos (cancelar turno, formularios clínicos, receta) quedan
detrás de flags `TRAMO_*` apagados. Rev. 2 del plan: se suman los arreglos del
arnés H-08/H-09 del informe de Marcelo y el tramo «acceso habilitado» (N4)
detrás de flag. **Con `dev` verde tras #58/#59, esta rama sí termina en PR.**

### Archivos de esta rama

| Archivo | Qué |
|---|---|
| `cypress/support/real/rutas.ts` | Nuevo. Mapa central de rutas: los specs 09/10 no escriben una ruta suelta. Es la mitigación del PR #55 (rutas en inglés, sin decidir): si se mergea, el renombre cuesta este archivo y una re-corrida |
| `cypress/support/real/tramos.ts` | Nuevo. Los flags `TRAMO_REGISTRO` / `TRAMO_E1_CANCELAR` / `TRAMO_M1_CLINICA` / `TRAMO_P1_RECETA`; la ausencia de la variable es «apagado» |
| `cypress/support/config.ts` | `tramos()`: los flags viajan al navegador por el bloque `expose`, como el resto de la configuración |
| `cypress.config.ts` | `...tramos()` en `expose` |
| `cypress/e2e/real/09-camino-consumidor.cy.ts` | Nuevo. La hoja del consumidor: entrar por documento → panel → pedir y **confirmar** un turno → subir evidencia → verla en «Mis verificaciones» |
| `cypress/e2e/real/10-camino-medico.cy.ts` | Nuevo. La hoja del médico: agenda de hoy → registrar llegada → expediente → encuentro |
| `cypress/support/real/sesion.ts` | **Media-migración del #55**: la aserción del login seguía esperando `/panel\|/auth/organizacion` y el login aterriza en `/dashboard` desde el merge — toda la suite real moría ahí. Migrada a `/dashboard\|/auth/organization` |
| `cypress/e2e/navigation/navegacion.cy.ts` | **Media-migración del #55**: 3 aserciones con rutas viejas (`/identidad/verificar`, `/auth/registro`) — eran 3 de los 4 fallos del **CI ROJO de `dev`** (run 31599344925). Migradas. El 4.º fallo es regresión de producto (aria-current doble), NO se toca acá — ver HALLAZGOS-IT1 |
| `cypress/e2e/responsive/responsive.cy.ts` | Ídem: `/panel$` → `/dashboard$` |
| `scripts/run-recorrido-real.mjs` | **H-09**: el lanzador corre con `electron` (chrome se colgaba indefinidamente); **H-08**: el preflight instruye levantar la API con `RATE_LIMIT_DISABLED=true` |
| `cypress/support/real/tramos.ts` | Flag nuevo `TRAMO_N4_ACCESO`: el desenlace «acceso habilitado» espera el merge del PR #54 de la API |
| `cypress/e2e/real/08-sello-del-titular.cy.ts` | Extensión N4 detrás del flag: aprobar → el sello pasa a Aprobado **y el titular deja de estar bloqueado** |
| `cypress/e2e/real/09-camino-consumidor.cy.ts` | Tramo 5-6 «acceso habilitado» detrás del mismo flag |
| `docs/reports/generated/e2e-inventory.md` | Regenerado al final |

### Lo que NO estoy tocando

- `src/**` entero, `cypress/harness/**`, `cypress/e2e/` fuera de `real/08`, `real/09` y
  `real/10`, `.github/**`, y el contrato de `actores.ts` (lo usan 02/05 tal cual).
