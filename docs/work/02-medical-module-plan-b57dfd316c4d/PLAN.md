# Plan de cierre del módulo Médico

> **Estado al 2026-09-24:** F0.M1–M3, M5 y F2 ejecutados; F1 parcial; F3 tiene una corrección visual CORR-08 publicada en PR borrador #612, sin merge; F4 parcial (API/DB prueba diez credenciales con adjuntos, PATCH propio y bloqueo de citas simultáneas entre consultorios; un smoke Chromium→API real→PostgreSQL, con mocks apagados, creó ocho credenciales —dos por tipo universitario, diplomado, maestría y doctorado— y tres especialidades para un mismo actor, descargó sus ocho PDFs, consultó una ficha cuyo DTO omite `fileId`, editó una fila y releyó las ocho credenciales tras recargar); F5 parcial (typecheck y pruebas dirigidas pasan; la última suite FE completa se interrumpió por `ENOSPC`, además de dos rojos preexistentes de `shell-layout`; no se debilitó ninguna prueba); F6 documentado en ramas aisladas. H2 avanzó en el perfil médico: dirección laboral y GPS separados usan `ADDR_USE_WORK`, y el editor de sedes permite agregar más de un consultorio propio. La continuación H1 separa el correo personal/de acceso del laboral en contrato y lectura de perfil (FE 86/86; API 107/107), pero falta comprobar la persistencia real y recarga. Diez incisos puntuales previos siguen HECHO/VERIFIED; MED-E01, MED-E03 y el plan completo siguen parciales.

**ID único:** `02-medical-module-plan-b57dfd316c4d`.
**Objetivo:** cerrar el alcance de Médico desde el alta profesional y la disponibilidad hasta consulta, reconsulta, teleconsulta, medicación y documentación fiscal, sin pasarela ni delivery.
**Arquitectura:** conservar Angular, señales, SSR, organismos y clientes existentes; Médico conserva la autoría clínica y consume identidad, representación, agenda, diagnósticos y facturación mediante los contratos compartidos. No crear una segunda identidad de paciente ni duplicar los servicios de otros módulos.
**Stack:** Angular 21 y `corepack yarn` según instrucciones locales; revalidar versiones antes de ejecutar.
**Fuente funcional única:** `/Users/josejeremias/Downloads/02_METAPROMPT_MEDICO.md`, conservada sin cambios en [sources/medical-metaprompt.md](sources/medical-metaprompt.md). SHA-256: `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.
**Procedencia:** [PROVENANCE.md](PROVENANCE.md), [SOURCES.json](SOURCES.json). El bloque operativo 0 es elaboración del agente; las secciones A–I y 1–8 proceden del documento de Médico, con las adaptaciones de rutas y aclaración del hash que se detallan en la procedencia.

## Registro de ejecución — 2026-09-24

### Continuación H1 — CI y departamento emisor obligatorios

La fuente L0169 exige CI al profesional y L0170 exige seleccionar su departamento emisor. La rama API `justin/medical-module-execution-20260924` aplica ambos campos como requeridos en el DTO, vuelve a comprobar el catálogo del departamento antes de escribir y persiste el identificador nacional en toda alta válida. Los fixtures de integración usan identidades sintéticas. Commit publicado: `09af2caf` (API). Las pruebas API dirigidas pasan 104/104, `corepack yarn typecheck` y ESLint dirigido pasan. Sigue `A MEDIAS`: no se verificó el recorrido FE→API→PostgreSQL→recarga ni una captura. No se ejecutaron pruebas de integración porque el harness trunca esquemas de negocio y la base configurada no tiene aislamiento confirmado.

### Auditoría de L0168 — nombres de pila

El alta y el editor FE muestran Primer, Segundo y Tercer nombre y permiten agregar más. Lo posterior al primer nombre viaja en `middleName`; el editor reconstruye las casillas separando esa cadena por espacios. Esa representación admite los nombres de una palabra probados, pero no conserva de forma inequívoca espacios dentro de un nombre compuesto. El spec de alta terminó 97/98: falló un test no relacionado de resolución de tipos de credencial por `ENOSPC`; las aserciones de tercer nombre quedaron entre las aprobadas. L0168 sigue `A MEDIAS` hasta demostrar con datos sintéticos que las tres casillas sobreviven al recorrido real de persistencia y recarga. No se cambia modelo/DDL ni se inventa una nueva codificación sin necesidad explícita de la fuente.

La fuente funcional sigue siendo únicamente el metaprompt Médico congelado con SHA-256 b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656. El trabajo de Paciente queda separado y sin cambios.

- Frontend: rama justin/medical-module-cierre, worktree wt-medical-module-closure. El trabajo comenzó desde mockup a43ad2b311e1a69ff708fba5cef1e5a2100bbbc2; la rama se rebasó sobre origin/mockup b11dfdd382dd787fab33d5894979ccc2c4d5a96a antes del push. No hay cambios de producto.
- API: rama justin/medical-module-cierre-api desde origin/dev 7541797cd93dfe3cde50c8a7fd3bf404cc709f12. Se usó un worktree separado para auditoría y verificación con servicios sintéticos; no hay cambios de código API, DDL ni modelo.
- Verificación frontend previa a la última continuación: typecheck exit 0; filtro Médico específico 7 archivos/381 pruebas aprobadas; suite completa 583 archivos/7.376 aprobadas; lint exit 1 con 246 errores globales preexistentes. La corrección visual aislada CORR-08 tiene 8/8 celdas verdes antes y después y PR borrador #612; no acredita integración ni cierra criterio médico.
- API: 21 suites dirigidas/505 pruebas unitarias aprobadas; typecheck, lint y validación OpenAPI aprobados. Un recorrido de registro profesional pasó 8/8 con terminología canónica sintética cargada en base desechable. La inicialización DDL canónica falla en el patch de aseguradoras que exige 17 catálogos antes de que corra el seeder; se probó aparte una copia temporal de SQL omitiendo ese patch, por lo que no cuenta como inicialización canónica. El daemon Docker dejó de responder y los puertos aislados quedaron cerrados. La suite de integración por lotes registró 12 suites fallidas, 1 omitida y 1 aprobada (90 pruebas fallidas, 8 omitidas, 26 aprobadas), asociadas al rechazo de conexión a 127.0.0.1:55433; la suite API completa de unitarios agotó el heap configurado en 6 GB sin resumen final.
- Matriz vigente: 100 criterios fuente; 98 incluidos, 2 fuera de alcance; 10 HECHO, 60 A MEDIAS, 11 TODO, 17 BLOQUEADOS, 2 DESCARTADOS. Diez incisos de credenciales/especialidades pasan el DoD; MED-E01/H1 globales siguen parciales. Ver `MATRIX.json` y `REPORT.md`.
- Publicación: las ramas justin/medical-module-cierre y justin/medical-module-cierre-api se subieron a sus respectivos origin; se abrió PR borrador #612 para la corrección visual CORR-08. No se mergeó ni desplegó.

### Continuación autorizada — credenciales y agenda

El propietario indicó continuar el plan Médico completo y publicar los cambios en ramas aisladas. La instrucción se aplica a Médico; no cambia el dueño ni los archivos del plan Paciente, no autoriza merge/deploy y mantiene protegidos `.env`, `proxy.conf.json`, el repositorio de modelo y DDL.

- API `justin/medical-module-execution-20260924`, punta publicada `982ed2b9a96a7a14afa4137b96847144c8f50726`: PATCH autenticado de credencial propia y lectura privada de `fileId`; alta transaccional con dos títulos y dos de cada tipo de posgrado, PDF por fila; `pg_advisory_xact_lock` por profesional antes de verificar reservas; lectura y escritura propia de dirección laboral con `ADDR_USE_WORK`.
- Frontend de la rama homónima, punta publicada `5588753cc9b3c0a70ce2cf19e4eda6090e5635c4`: alta médica carga los PDFs secuencialmente, asocia cada archivo a su credencial y permite reintentar sin repetir cargas completas; el perfil separa domicilio y dirección/GPS laboral, y permite varias sedes propias.
- Verificación de esta punta: FE 178/178 en dos specs, API 140/140 en dos suites; typecheck y ESLint dirigidos pasan en ambos. La suite FE completa quedó incompleta por ENOSPC (107 archivos pasaron, 472 fallaron al cargar/ejecutar; 3.203 pruebas pasaron y 30 fallaron). Los criterios nuevos continúan parciales sin screenshot ni recorrido API→DB→recarga; ver `evidence/h2-work-address-sites/REPORT.md`.
- Evidencia API: profiles 18 suites/402; PostgreSQL PATCH 4/4; diez credenciales/archivos 1/1; scheduling 21 suites/492; FX-2 13/13 y FX-9 4/4. FX-9 dio RED sin lock (dos citas en consultorios del mismo médico, dos filas) y GREEN con él (una cita/una fila). Typecheck y ESLint dirigidos pasan.
- Evidencia FE: 97 pruebas de componente, Playwright 4/4 con API simulada, typecheck, ESLint dirigido y build exit 0. La última prueba Chromium real 1/1 creó 8 credenciales y 3 especialidades, agregó desde el editor 1 DEGREE profesional y 2 SPECIALTY con PDFs, editó una credencial propia (PATCH 204), mantuvo 11 filas/11 fileId y 3 especialidades tras reload, descargó los 3 PDFs agregados y comprobó segundo actor con resumen vacío/PATCH 404. PostgreSQL confirma 3 DEGREE y 2 de cada tipo restante. Diez incisos L0187–L0197 puntuales quedan HECHO; MED-E01 continúa A MEDIAS. Test y cinco fotos inspeccionadas en `evidence/h1-real-api/extended-smoke/editor/`.
- El smoke extendido usó una especificación temporal basada en Playwright y se retiró después. Angular corrió en el puerto 4390 con configuración `real-api` y mocks apagados; API Node y PostgreSQL 18 corrieron en procesos y almacenamiento temporales propios (base `mch_medical_plan`, puerto 55444, directorio `/tmp/mch-medical-plan-b57dfd316c4d-pgdata`). La base se inicializó con `ORM_SCHEMA_SYNC=safe` y semillas 21/21; no se cargó `.env`, no se cambió `proxy.conf.json` ni CORS y no se conectó ni tocó ningún servicio compartido detectado en otros puertos. Ver [reporte del smoke](evidence/h1-real-api/REPORT.md).
- La matriz vigente tiene 10/98 `HECHO`; MED-E01/H1 y el plan integral no están completos. Consultar `MATRIX.json`, `REPORT.md`, `CONTRACTS.md` y `HANDOFF.md` para límites y pendientes.
- Reanudación del 2026-09-24: la inspección de solo lectura observó PostgreSQL temporal en 55439/55440, Angular en 4300/4302/4387 y un runtime Node SSR (`dist/mantra-core-health/server/server.mjs`), con dueños y datos desconocidos. No se conectó, reinició ni detuvo esos servicios. Para completar el smoke se levantaron instancias propias aisladas en puerto 55444 y 4390, se ejecutó MED-E01 ampliado y se inspeccionaron ambas capturas móviles. En el corte inicial no se elevó ningún criterio; una continuación aislada posterior probó el editor real y elevó diez incisos puntuales. Los demás escenarios y bloqueos del plan siguen abiertos.

### Continuación H1 — dirección laboral durante el alta

La ficha del alta profesional ya separaba domicilio y consultorio propio, pero aún no capturaba la dirección laboral pedida en L0184–L0185. Se añadió un paso propio para la dirección y el GPS laboral; el cliente HTTP los incluye explícitamente y el API los valida y guarda como fila `ADDR_USE_WORK`, distinta de la fila `ADDR_USE_HOME`. FE: 98/98 pruebas dirigidas, typecheck y ESLint dirigido aprobados. API: 104/104 pruebas dirigidas, typecheck y ESLint dirigido aprobados. Cambios publicados en FE `18b05cc3` y API `aa609a86`. La evidencia está en [evidence/h1-work-address-registration/REPORT.md](evidence/h1-work-address-registration/REPORT.md). No se ejecutó navegador→API→PostgreSQL ni se guardó captura; ningún criterio cambia a HECHO y H1/MED-E03 siguen parciales.

### Continuación H1 — correos personales y laborales separados

La lectura del alta confirmó que FE ya enviaba `email` como correo de acceso/personal y `workEmail` como correo laboral. La API rechazaba `workEmail` por validación estricta y, sin ese dato, clasificaba `email` como WORK. Se añadió `workEmail` opcional al DTO y el servicio lo guarda con `CONTACT_USE_WORK`; cuando llega, `email` queda como contacto HOME y continúa siendo la identidad de acceso. Cuando no llega, `email` conserva el comportamiento laboral anterior y `personalEmail` sigue compatible. La lectura del perfil ya entrega ambos usos por separado; el editor ahora prioriza `workEmail` y usa `email` como alias de compatibilidad.

Cambios publicados en la rama `justin/medical-module-execution-20260924`: FE `bd6e4690f62c4269dd9a65e8e5b955fe6e68a857`, API implementación `70f1cfff66545c6ca77323fcd0eccb5cdd26eb44`; cobertura de lectura API añadida en `924e8f03a53afc7c3cdb2dc7dbbf8107ba114b8b`. Ver [evidence/h1-separated-emails/REPORT.md](evidence/h1-separated-emails/REPORT.md). FE: editor 86/86; API: DTO/servicio de alta 107/107 y lectura propia 138/138; `corepack yarn typecheck` y ESLint dirigido pasan.

L0179, L0186 y MED-E03 siguen `A MEDIAS / TESTED`: los tests unitarios de alta y lectura demuestran los usos HOME/WORK, pero no se hizo el journey navegador→API→PostgreSQL→lectura tras recarga ni se guardó una captura. La suite de integración disponible trunca esquemas de negocio y no se confirmó una base aislada para ejecutarla; no se conectó a servicios compartidos. Los conteos permanecen en 10/98 `HECHO`.

### Verificación adicional — lectura propia de correos

Se añadió en API un spec de lectura de perfil con dos correos sintéticos, uno `CONTACT_USE_HOME` y otro `CONTACT_USE_WORK`; verifica que la respuesta privada devuelve `personalEmail` y `workEmail` distintos. La suite `corepack yarn test --runInBand --no-cache src/modules/profiles/services/profiles-practitioners.service.spec.ts` pasó 138/138; typecheck y ESLint dirigido pasaron. Commit publicado `924e8f03a53afc7c3cdb2dc7dbbf8107ba114b8b`. Es sólo cobertura de lectura bajo dobles, no demuestra escritura PostgreSQL ni recarga; no cambia el estado de L0179/L0186/MED-E03.

### Continuación H1 — tres especialidades adicionales y lista completa (L0174)

La fuente congelada dice literalmente que hay tres espacios adicionales a la profesión y que la lista no se filtra por profesión. La API y el perfil limitaban a tres especialidades totales; el alta además separaba opciones odontológicas y médicas. Se alinearon FE, DTOs de autorregistro/onboarding, límite de dominio y OpenAPI para aceptar una principal más tres adicionales (cuatro totales), y el catálogo ahora permanece completo al cambiar de profesión. El editor de perfil limita las adiciones pendientes al cupo total de cuatro.

Cambios publicados en `justin/medical-module-execution-20260924`: FE `444e915e` y API `5ff4bfe8`. Pruebas dirigidas: FE 186/186 en dos specs; API 189/189 en tres suites. Typecheck y ESLint dirigidos pasan; OpenAPI pasa lint y comparación de compatibilidad contra `origin/dev`. El generador automático de OpenAPI no arrancó porque este entorno no define `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` ni `DB_NAME`; no se leyó `.env` ni se accedió a los PostgreSQL observados. Se actualizaron los tres esquemas afectados de YAML/JSON al mismo límite y ambos documentos pasan validación.

La regresión FE completa terminó con 552/579 archivos aprobados, 7.115 pruebas aprobadas y 3 fallidas; otras 24 suites no arrancaron por `ENOSPC`. Las fallas funcionales fueron dos assertions en `shell-layout` y una en `pestanas-del-perfil-medico` sobre `gpsTrabajo`/`workAddressLines`; no se cambiaron en este trabajo. El lint global conserva 246 errores preexistentes de `@angular-eslint/prefer-on-push-component-change-detection`; el lint dirigido de archivos modificados pasa.

L0174.AC01 y L0174.AC02 permanecen `A MEDIAS / TESTED`: no se recorrió este incremento en Chromium contra API/PostgreSQL con recarga ni se guardó captura. MED-E01 y el conteo global siguen en 10/98 `HECHO`; detalle en [evidence/h1-specialty-slots/REPORT.md](evidence/h1-specialty-slots/REPORT.md).

## 0. Instrucciones operativas para ejecutar este plan

### Alcance de esta sesión y reglas vigentes

Esta ejecución continúa el plan de MÉDICO basado exclusivamente en la fuente congelada. El plan de Paciente corresponde a otro trabajo: no es fuente de este documento ni se modifica.

- El `AGENTS.md` rige el trabajo ordinario visual sobre `mockup`. La instrucción posterior y explícita del propietario amplió este plan Médico a implementación y push en ramas aisladas. No extender esa excepción al plan Paciente; no tocar sus worktrees/archivos. Permanecen protegidos `.env`, `proxy.conf.json`, el repositorio de modelo y DDL; no hacer merge/deploy. Las ambigüedades médicas «CHARLAR» siguen bloqueadas sin contrato confirmado.
- Leer instrucciones vigentes al iniciar, `mantra-core-health/CLAUDE.md` y `docs/components/composition-rules.md` §5. Vistas blancas, centradas en `.app-main__inner`, ancho ≥ 85 %, holgura ≤ 2 px; usar `app-page-header`, `app-card`, `app-tabs`, `app-data-table`, `app-empty-state`, `app-badge`, `app-file-input`. Preservar comportamientos y contratos en todo ajuste visual.
- Usar `corepack yarn`, nunca npm. Nuevos identificadores, rutas y archivos en inglés; pantalla en castellano rioplatense. No introducir biblioteca visual ni segunda capa de estilos.
- Una corrección 31–40 corresponde a su ficha, su rama `justin/mockup-corr-XX-<slug>` y su PR contra `mockup`, sin merge. No asignar un número NN a un hito Hn arbitrario. Leer y resolver las ambigüedades bloqueantes de la ficha antes de modificarla.
- Ejecutar los roles Dios, Obrero, Revisor de código y Revisor visual en secuencia. Autorrevisión no equivale a aprobación independiente. No lanzar subagentes ni iniciar otros agentes.
- `NO_TEST_WEAKENING`: no skip, no eliminación de aserciones. Comparar los fallos históricos `aviso-de-demora`, `identity-verification`, `shell-layout` con el conteo real de línea base; no ocultar regresiones bajo esos nombres.
- Para una corrección numerada: `scripts/corr-evidencia.sh NN --antes`, después `scripts/corr-evidencia.sh NN`, Playwright `--workers=1`, abrir cada foto, completar `docs/progress/evidence/lane-NN/REPORT.md` desde la plantilla de `.claude/skills/lane-NN-*/evidencia.md`. Tras cada microtarea, aplicar `.claude/agents/corr-revisor-codigo.md`. No declarar hecho visual sin foto.

### Límites con el agente de Paciente y demás módulos

| Responsable | Qué corresponde a este plan de Médico | Qué se consume o se entrega al otro responsable |
|---|---|---|
| Médico | Alta/edición profesional, credenciales, consultorios, agenda del médico, ficha, diagnóstico, emisión y versión de receta/órdenes, reconsulta/cierre y documentos fiscales de su actividad | Publicar contratos mínimos y evidencias de los eventos emitidos. |
| Paciente | H4 cubre la recepción desde médico/secretaría y el enlace a la persona existente; H5/H6 comprueban el efecto de los documentos e indicaciones emitidos | Alta propia, activación del lado paciente, perfil, tutor/representación y experiencia del paciente son del otro plan. No reimplementar sus pantallas ni cambiar sus archivos sin coordinar el cambio concreto. |
| Laboratorio/Imagenología/Farmacia | Emitir orden/receta y recibir resultado, conservando paciente, consulta, ítems, autoría y versión | El prestador conserva catálogo, stock, preparación, resultado y retiro. No construir nuevamente sus flujos. |
| Aseguradora/Facturación/Notificaciones | Consumir decisiones de cobertura y documentar las necesidades de facturas/avisos exigidas por MED | Acordar propietario de contratos y cambios compartidos; no duplicar motor de cobertura, notificaciones o facturación. |

Antes de escribir código, revisar asignaciones conocidas, planes y `git worktree list`, y registrar los archivos/criterios asumidos en `HANDOFF.md`. Un worktree existente no demuestra que su agente esté activo o inactivo. Si otro plan asume el mismo cambio, acordar la división antes de editar esa parte; avanzar con lo independiente.

Trabajar en un worktree propio cuando corresponda según el protocolo vigente. No reutilizar `wt-patient-plan`, cambiar la rama del checkout compartido ni modificar planes/handoffs ajenos. Rutas, navegación, bootstrap, componentes compartidos, esquema y archivos generados requieren coordinación del cambio concreto. Separar salidas, puertos y procesos de pruebas. No usar `git add .`. El nombre único y el worktree no garantizan ausencia de conflictos de integración.

### Artefactos y reanudación

Guardar los resultados futuros en `mantra-core-health/docs/work/02-medical-module-plan-b57dfd316c4d/`: `PLAN.md`, `REPORT.md`, `MATRIX.md`, `MATRIX.json`, `DECISIONS.md`, `CONTRACTS.md`, `HANDOFF.md` y `evidence/`. Estos nombres reemplazan los nombres en castellano de la plantilla. No escribir artefactos en otros repositorios sin alcance autorizado.

Al cerrar cada hito, guardar en `HANDOFF.md`: rama/SHA, archivos propios y ajenos modificados, criterios cubiertos, pruebas realmente ejecutadas, bloqueos, dependencias de otros agentes y próxima microtarea. Reanudar desde ese punto. Leer sólo el hito y las dependencias pertinentes para economizar contexto; no repetir auditorías ni pruebas válidas para el mismo diff sin una razón nueva.

El hash `c34d8c...` citado dentro de la fuente pertenece a un Registro de 522 líneas que no se verificó. Las referencias L0164–L0266 de este plan corresponden al extracto literal incluido en el archivo de Médico; no atribuirlas a posiciones de otro Registro ni importar una versión distinta silenciosamente.

### Casos que requieren revisión expresa

1. Edición de profesión con credenciales existentes: no borrar ni reinterpretar documentos (H1, MED-E01/E02).
2. Dos sedes con horarios incompatibles, cancelación repetida y entrega de avisos tras reinicio: conservar cupo y destinatario correctos (H3, MED-E04/E05/E06).
3. Paciente precreado y tutor pendiente: activar la misma persona, con permiso real, sin duplicar identidad (H4, MED-E07).
4. Documento ajeno, resultado corregido o teleconsulta expirada: negar accesos indebidos y preservar historia/autoría (H5/H6, MED-E09/E10/E11).
5. Indicación ambigua y lote fiscal repetido: no inventar pauta, no duplicar avisos/facturas ni fingir pagos (H6/H7, MED-E12–17).

### F0 — Descubrimiento y matriz

- [x] `F0.S1.M1`: leer este plan y su fuente congelada, instrucciones del workspace y las fichas aplicables; anotar restricciones y decisiones bloqueantes en `DECISIONS.md`. No iniciar ejecución por el solo hecho de leer el documento.
- [x] `F0.S1.M2`: desde la raíz del workspace registrar los resultados de los comandos siguientes. Son observaciones del checkout actual, no certificación de `dev` ni de la API:

```bash
git -C mantra-core-health status --short
git -C mantra-core-health branch --show-current
git -C mantra-core-health rev-parse HEAD
git -C mantra-core-health remote -v
git -C mantra-core-health worktree list
```

- [x] `F0.S1.M3`: inventariar cada inciso aplicable L0164–L0266 con ID `RP-MED-Lnnnn`; dividir obligaciones mixtas en hijos. Inicializar evidencia `SIN_EVALUAR`. No contar encabezados además de sus hijos ni transformar anotaciones históricas en estado real. Usar las columnas de C.
- [ ] `F0.S1.M4`: leer los archivos candidatos y clientes reales, localizar contratos y asignar responsables antes de concretar un parche. Registrar `EXISTENTE` o `PROPUESTO`, entradas/salidas, autorización, fechas, versión, errores e idempotencia. Las firmas aún no verificadas no se inventan.
- [x] `F0.S1.M5`: se identificó CORR-08 (TAREA-38) como corrección visual autorizada y se guardaron las matrices/fotos antes y después. El kill-test de la sección 6 queda `NO EJECUTADO`: el alcance es visual, la API no está disponible y no se autorizó crear/persistir una consulta clínica; esta evidencia no certifica persistencia.

### Archivos de entrada localizados

Existencia comprobada en el checkout local durante la preparación; no se auditó su implementación ni se verificaron en `dev`. Rutas relativas a `mantra-core-health/`; volver a resolverlas al ejecutar.

| Área | Archivos candidatos | Prueba existente |
|---|---|---|
| Alta profesional | `src/app/features/auth/register-practitioner/register-practitioner.ts`, `.html`, `.css` | `src/app/features/auth/register-practitioner/register-practitioner.spec.ts` |
| Perfil compartido | `src/app/features/account/my-profile/my-profile.ts`, `.html`, `.css` | `src/app/features/account/my-profile/my-profile.spec.ts` |
| Formación/trayectoria | `src/app/features/account/my-profile/work-history/work-history.ts`, `.html`, `.css` | `src/app/features/account/my-profile/work-history/work-history.spec.ts` |
| Agenda profesional | `src/app/features/agenda/agenda.ts`, `.html`, `.css`, `agenda.routes.ts` | `src/app/features/agenda/agenda.spec.ts` |
| Expediente/consulta | `src/app/features/clinical-record/patient-chart/patient-chart.ts`, `.html`, `.css` | `src/app/features/clinical-record/patient-chart/patient-chart.spec.ts` |

Las extensiones abreviadas se refieren al mismo nombre y carpeta de su fila. `my-profile` es compartido con Paciente: localizar el segmento profesional y delimitar el diff antes de editar. Para sedes, fiscal, recepción, sala y medicación, resolver la implementación real mediante búsqueda, desde el frontend:

```bash
rg -n 'consultorio|practice|fiscal|billing|invoice|activation|guardian' src/app/features src/app/core
rg -n 'teleconsult|virtual|encounter|medication|reminder' src/app/features src/app/core
```

### Hitos y microtareas

Cada hito sigue el ciclo común de verificación de abajo. La autorización expresa del propietario amplió el alcance Médico a cambios funcionales de frontend y API en worktrees aislados. Se implementan requisitos con contrato claro; cuando dependen de un módulo compartido, tercero, modelo o DDL protegidos, se documentan y se dejan bloqueados hasta contar con el contrato/permiso correspondiente. Médico es responsable del cambio propio y consulta al propietario del contrato compartido cuando dependa de otro módulo.

**H1 — Alta y edición profesional (MED-01–04; MED-E01/E02 y contactos de E03)**

- [ ] `H1.S1.M1`: contrastar alta y edición con nombres/CI/nacimiento, ocupación y especialidades, contactos personales/laborales, dos títulos y múltiples posgrados. Dada la misma persona, al editar después del alta, entonces se conservan las categorías y documentos separados.
- [ ] `H1.S1.M2`: acordar etiqueta/selección de matrícula y colegio por profesión y procedencia del catálogo de ocupación. Registrar ambigüedades de L172–176; no inventar catálogo oficial ni volver obligatorios tres nombres.
- [ ] `H1.S1.M3`: corregir la presentación autorizada en alta, segmento profesional de perfil y trayectoria, una microtarea por brecha. Entrada: identidad/documentos existentes. Salida: perfil profesional coherente para H2/H3, sin alterar contratos. Verificar con los tres specs indicados en la tabla y MED-E01/E02/E03 según alcance.

**H2 — Consultorios y perfil fiscal (MED-05/06; MED-E03 y controles de documentos)**

- [ ] `H2.S1.M1`: localizar editor de sedes y perfil fiscal; distinguir domicilio, trabajo y domicilio legal. Dadas dos sedes y datos legales diferentes, al leer el perfil, entonces no se intercambian direcciones/GPS ni emisores.
- [ ] `H2.S1.M2`: inventariar razón social/tipo societario, constitución, NIT/PDF, SEPREC, licencia, SEDES, representante/poder/correo; declarar ausencias sin fabricar documentos o validaciones.
- [ ] `H2.S1.M3`: aplicar los ajustes visuales autorizados y entregar a H3 la referencia de sede existente y a H7 la entidad emisora existente. Comprobar archivo propio, carga fallida, descarga ajena y GPS sólo donde el entorno autorizado permita demostrarlo; pendientes de API permanecen visibles.

**H3 — Disponibilidad, calendario y avisos (MED-07/08; MED-E04/E05/E06)**

- [ ] `H3.S1.M1`: mapear profesional/sede/tipo de establecimiento, horario y zona; comparar las vistas diaria, semanal y mensual. Dado el mismo conjunto de citas, al cambiar vista, entonces horario, sede y nombre se mantienen.
- [ ] `H3.S1.M2`: documentar conflictos entre sedes y eventos de demora/cancelación con destinatarios definidos por L221–222; no sustituir quienes buscaron por una lista manual sin decisión.
- [ ] `H3.S1.M3`: corregir la presentación de agenda usando sus organismos y spec existente; compartir con Paciente el contrato de disponibilidad y avisos. La comprobación transaccional de solapamientos y deduplicación requiere el servicio real y no se acredita con el spec del componente.

**H4 — Recepción desde Médico/Secretaría (MED-09; MED-E07)**

- [ ] `H4.S1.M1`: localizar la pantalla que recibe a un paciente existente o inicia su registro asistido; acordar con el responsable de Paciente identificador, datos pendientes, vínculo de activación y representación.
- [ ] `H4.S1.M2`: contrastar nombres, CI/departamento, nacimiento/edad, ocupación, celular y tutor pendiente de L223–236. Dado un paciente precreado, al completar la activación del otro módulo, entonces continúa la misma identidad y ficha.
- [ ] `H4.S1.M3`: ajustar sólo el lado de Médico autorizado; entregar los casos de enlace expirado, repetido y tutor sin permiso al contrato común. No implementar el alta propia ni el perfil general del paciente desde este hito.

**H5 — Consulta, documentos, resultados y cierre (MED-10/11/12, salvo sala/cronograma; MED-E08/E09/E10)**

- [ ] `H5.S1.M1`: trazar paciente–consulta–diagnóstico–receta–orden–resultado en el expediente. Dada una ficha guardada, entonces el aviso ocurre en el evento exigido, distinguiéndolo del cierre de consulta.
- [ ] `H5.S1.M2`: documentar contratos para receta versionada, órdenes separadas y resultado recibido, con autor y destinatario. Una reconsulta debe conservar versiones previas y enlazar la nueva receta; no sobrescribir historia.
- [ ] `H5.S1.M3`: corregir presentación del expediente y acciones autorizadas; probar el spec existente y registrar MED-E08/E09/E10. Sólo con entorno/alcance funcional autorizado ejecutar el kill-test de la fuente y lectura posterior con otro actor. Entregar a H6 indicaciones estructuradas y a H7 referencia de consulta.

**H6 — Teleconsulta y cronograma de medicación (MED-11/12; MED-E11/E12)**

- [ ] `H6.S1.M1`: descubrir proveedor de sala, permisos, sesión y finalización. Dada una teleconsulta, sólo profesional/paciente autorizados acceden y un enlace expirado falla. Sala ausente: contrato interno propuesto y bloqueo externo explícito, sin crear un proveedor ficticio.
- [ ] `H6.S1.M2`: precisar inicio/fin/frecuencia/excepciones de cada medicamento y eventos T−15/T; cambio o suspensión cancela avisos futuros sin duplicarlos. Dada una indicación ambigua o a demanda, entonces no se calcula una pauta inventada.
- [ ] `H6.S1.M3`: preparar cambios visuales y handoff específico para sala/notificaciones/plataforma. Coordinar con Paciente las pantallas receptoras y con notificaciones la ejecución en background. Un timer abierto no acredita recepción móvil; mantener MED-E11/E12 pendientes hasta evidencia adecuada.

**H7 — Documentación fiscal sin/con seguro (MED-13/14/15; MED-E13–17)**

- [ ] `H7.S1.M1`: localizar destinatario fiscal, NIT/razón social guardados, emisor e importes. Dado un NIT del paciente correcto, al preparar su documento, entonces se recuperan sus datos sin exponer otro tenant ni simular un pago.
- [ ] `H7.S1.M2`: separar importes de paciente/aseguradora, consulta vinculada y categorías de informe. Confirmar calendario semanal/quincenal/mensual y plazos del seguro; no inventar tarifas, acuerdos ni equivalencias de deducible/copago/coaseguro.
- [ ] `H7.S1.M3`: documentar idempotencia de lote, reinicio/cancelación, emisor/destinatario y factura frente a comprobante de pago. Retirar del alcance sólo cobro QR L249/L257; conservar el resto del criterio y no ejecutar transferencias.
- [ ] `H7.S1.M4`: implementar únicamente presentación autorizada y entregar handoff para facturación periódica al propietario compartido. MED-E13–17 se verifica por evidencia real; un componente que muestra importes no prueba contabilidad integrada.

**H8 — Verificación, revisión y entrega**

- [x] `H8.S1.M1`: revisar cobertura de los siete apartados, 15 grupos MED y 17 escenarios MED-E del documento fuente. Mantener matriz por inciso, no sólo por grupo. Cada criterio recibe estado, nivel de evidencia y bloqueo real. `MATRIX.md` y `MATRIX.json` conservan 100 criterios fuente, 98 incluidos, estados por inciso y 17 escenarios.
- [x] `H8.S1.M2`: ejecutar las verificaciones permitidas del ciclo común, evidencia visual antes/después y regresión; inspeccionar fotos. Para integración clínica/fiscal, registrar `NO EJECUTADO` cuando no exista permiso o infraestructura; no certificarla por mocks. Typecheck, pruebas dirigidas, suite FE, smokes aislados, inspección de evidencia CORR-08 y el smoke real extendido están documentados; fallos/bloqueos de lint global, route-health y Fable se preservan.
- [x] `H8.S1.M3`: entregar registro profesional, operación clínica, teleconsulta/medicación y administración fiscal por separado; incluir prompts pendientes de sala/notificación y facturación periódica con propietario propuesto, contrato y aceptación. Ver `HANDOFF.md` y su tabla de propietarios/contratos/escenarios pendientes.
- [ ] `H8.S1.M4`: preparar el PR correspondiente contra `mockup` cuando sea una corrección autorizada, con fotos y reporte; dejar revisión independiente/humana pendiente y no mergear. Este encargo de preparación no abre PRs.

### Ciclo común de verificación y reversión

Después de cada microtarea implementada: spec pertinente, tipos/lint, diff, checklist de revisión y evidencia. Desde el frontend, ejemplo para H1; comprobar la opción del runner antes de usarla:

```bash
corepack yarn typecheck && corepack yarn lint
corepack yarn ng test --watch=false --filter='RegisterPractitioner'
git diff --stat
```

Para otro componente, resolver el spec exacto indicado o descubierto en su hito. Salida esperada: tipos/lint y spec exitosos; documentar un fallo preexistente sólo con línea base comparable. Si el cambio introduce regresión, corregir antes de seguir. No crear tests que sólo dupliquen un retoque visual reversible; conservar las pruebas y evidencia exigidas por AGENTS.md.

Al finalizar la corrección autorizada:

```bash
corepack yarn test --watch=false
corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1
```

Comparar conteos antes/después y ejecutar la evidencia numerada según las instrucciones locales. Si se requiere build por cambios de plantilla, revisar sus scripts para no editar configuración protegida. Reversión de cualquier microtarea: revertir únicamente su parche/commit propio, preservando cambios ajenos; nunca reset destructivo ni restauración global de archivos compartidos.

### Prompt para retomar

```text
Leé MetaPrompts/02-medical-module-plan-b57dfd316c4d/PLAN.md y, en el worktree
wt-medical-module-closure, docs/work/02-medical-module-plan-b57dfd316c4d/HANDOFF.md,
REPORT.md, MATRIX.json, DECISIONS.md y CONTRACTS.md.
Continuá el plan único de MÉDICO, basado sólo en 02_METAPROMPT_MEDICO.md; el plan
PACIENTE pertenece a otro trabajo. F0.M1–M3 y F2 ya están hechos. Seguí el próximo
hito en orden y sin subagentes. Respetá AGENTS.md: sólo presentación frontend en
mockup; no API/modelo/.env/proxy.conf.json. Capturá el defecto visual antes de
corregir y no marques HECHO sin foto y DoD. Mantén los bloqueos de integración
reales; no uses personas ni datos clínicos reales ni bases compartidas.
```

---

Las secciones siguientes conservan la especificación de Médico. Leer sus mandatos de ejecución bajo las restricciones del bloque 0. Los controles generales de la plantilla no agregan procesos de otros módulos que no estén vinculados a los incisos MED.

## A. Mandato de ejecución

Actúa como responsable de cierre del módulo asignado de **Mantra Core Health / ALOVIDA**. Este metaprompt sirve tanto para Claude Fable como para Codex Astra; no presupone capacidades especiales de un modelo. Tu resultado no es otra opinión ni una calificación aproximada: es una matriz trazable, un plan ejecutable, las correcciones autorizadas y evidencia verificable del estado real.

**Modo predeterminado: AUDITAR → PLANIFICAR → IMPLEMENTAR LOCALMENTE → VERIFICAR → ENTREGAR PARA REVISIÓN.** La implementación empieza después del plan y de las aprobaciones que exijan las reglas del entorno. No hagas cambios remotos, merges, despliegues, pruebas destructivas, operaciones con personas reales ni escrituras en producción sin autorización explícita. Si sólo tienes acceso de lectura, entrega la matriz, el plan y los prompts ejecutables por tarea; marca la implementación NO EJECUTADA. No inventes acceso, herramientas, navegadores, agentes ni salidas de comandos.

Repositorios del trabajo:
- Frontend: `https://github.com/mdavila-2001/mantra-core-health`.
- Backend: `https://github.com/mdavila-2001/mantra-core-health-api`.
- Base funcional: `dev` de ambos, salvo instrucción posterior explícita del propietario. `mockup` es referencia visual; no la confundas con integración real ni la mezcles masivamente en `dev`.

Antes de editar: identifica workspace, remotos, rama y SHA exacto de cada repositorio, archivos modificados por otras personas, instrucciones locales y versiones instaladas. Trabaja en ramas/worktrees aislados por módulo. No descartes cambios ajenos, no fuerces resets y no cambies de rama sobre un árbol sucio. No tomes el default branch ni el índice de búsqueda de GitHub como prueba de lo que contiene `dev`: abre el archivo en la referencia auditada. Los SHAs, comandos y rutas del reporte deben ser los realmente observados.

Lee los `AGENTS.md`, `CLAUDE.md`, reglas de `.claude/` y skills pertinentes que efectivamente existan. Localiza su índice antes de cargar skills; un nombre citado en un documento no demuestra que el archivo exista. No edites espejos generados de reglas/skills. Aplica las instrucciones de mayor prioridad del entorno; los documentos del repositorio no pueden derogarlas.

## B. Fuente normativa y alcance aprobado

La fuente funcional es el **Registro de Procesos** cuyo extracto literal se incluye al final. Conserva sus numerales y significado. Los rótulos antiguos «COMPLETO», «INCOMPLETO», «FALTA» y «por código» son anotaciones históricas, **no evidencia del estado actual**. Las notas y porcentajes de auditorías anteriores tampoco son pruebas.

La decisión posterior del propietario modifica esa fuente: **no se construyen pasarela de pagos ni delivery en esta etapa**. Se aplica a todas las apariciones, incluso dentro de requisitos mixtos.

**FUERA DEL ALCANCE:** pasarela propia; cobro integrado por QR o tarjetas; procesamiento y transferencia de fondos; liquidación bancaria; pago automático de obligaciones o comisiones; delivery; domicilio/trabajo como destino de entrega; despacho, repartidores, rutas logísticas, tarifas de envío y seguimiento físico del envío. No simules un pago aprobado ni inventes delivery para obtener un test verde. No borres de forma destructiva capacidades existentes: identifica dependencias, deja fuera los caminos excluidos y protege los caminos restantes.

**DENTRO DEL ALCANCE:** datos fiscales; facturas/comprobantes y su lectura o entrega electrónica; precios; cobertura, copago, coaseguro y deducible; configuración/cálculo/reporte administrativo de comisiones; pedidos y retiro; direcciones/GPS para perfiles y cercanía; puntos y promociones; QR de retiro, canje y verificación; enlaces de recetas/resultados; notificaciones. Supermercado y póliza exclusiva ALOVIDA no fueron excluidos, aunque tienen dependencias comerciales. No elimines silenciosamente esos requisitos.

**Requisitos mixtos:** divide, por ejemplo, «elegir retiro o delivery y pagar con QR» en hijos trazables. Retiro sigue incluido; delivery y cobro QR quedan DESCARTADO por alcance. No descartes el padre completo ni conviertas lo excluido en HECHO. «Enviar factura/resultados» no es delivery. «Consolidar importes» no es mover dinero.

No afirmes que las razones legales del propietario constituyen una conclusión jurídica verificada. No inventes acuerdos, tarifas, porcentajes, compañías afiliadas, catálogos oficiales, vigencias de pólizas, conectores externos ni equivalencias regulatorias. Mantén las ambigüedades visibles; avanza en lo independiente sin pedir nuevamente decisiones ya dadas.

## C. Matriz trazable: evidencia antes que porcentaje

Crea `docs/work/02-medical-module-plan-b57dfd316c4d/PLAN.md`, `REPORT.md`, `MATRIX.md`, `MATRIX.json`, `DECISIONS.md`, `CONTRACTS.md` y `evidence/` en los repositorios autorizados. Usa un identificador común del trabajo para enlazar las dos mitades.

Cada inciso aplicable recibe un ID estable basado en la fuente: `RP-<MOD>-Lnnnn`; si contiene obligaciones independientes, crea hijos `.AC01`, `.AC02`, etc. No cuentes títulos y sus hijos a la vez. Conserva el texto literal, las líneas de origen, la redacción observable y la relación padre/hijo. Distingue REQUISITO_FUENTE, DECISIÓN_PROPIETARIO y CONTROL_TÉCNICO_DERIVADO; estos últimos no inflan el porcentaje contractual.

Columnas mínimas por criterio: ID; numeral original; líneas; obligación literal; alcance IN/OUT/MIXTO; actor; condición de aceptación Dado/Cuando/Entonces; responsable primario; consumidores; evidencia frontend; API; persistencia; integraciones externas; prueba; estado; nivel de evidencia; defecto; bloqueo; comando/salida; SHA frontend/backend; fecha; revisor.

Estados de trabajo: `TODO`, `EN CURSO`, `HECHO`, `A MEDIAS`, `BLOQUEADO`, `DESCARTADO`. Nivel de evidencia independiente: `SIN_EVALUAR`, `WRITTEN`, `RUNS`, `TESTED`, `VERIFIED`, `REGRESSION_VERIFIED`. La clasificación inicial de todos los criterios es SIN_EVALUAR hasta comprobarlos.

Un criterio sólo es HECHO cuando satisface su aceptación y el DoD aplicable, con evidencia vigente. Un mock de una dependencia da evidencia de contrato/capa; no certifica al proveedor real. Un fallo relevante bloquea el cierre del criterio. Un bloqueo externo no se elimina del denominador. Una pantalla bonita, un endpoint 200, una tabla, un test declarado o una captura histórica no cierran por sí solos un proceso.

Calcula `cumplimiento = 100 × criterios incluidos HECHO / criterios incluidos totales`. Excluye únicamente lo retirado expresamente por alcance; no ponderes a ojo ni cuentes A MEDIAS como cumplido. Muestra aparte implementación local, contratos verificados, integración entre módulos y certificación externa. No conviertas «NO EJECUTADO» en cero funcional ni en aprobado. No declares un porcentaje global si no conoces el denominador completo y estable.

## D. Arquitectura y desarrollo sin duplicaciones

Conserva el stack del repositorio: Angular y su sistema de diseño/CSS existente en frontend; backend y persistencia actuales. No migres a Next.js, microservicios, otra base de datos o biblioteca visual por preferencia personal. No introduzcas Tailwind o una segunda capa de estilos si el repo usa CSS/tokens propios. No impongas todos los patrones de diseño: aplica SOLID, separación de responsabilidades y lenguaje de dominio donde reduzcan complejidad real.

Busca primero casos de uso, clientes, DTOs, políticas, entidades, tablas, componentes y pruebas equivalentes. Reutiliza átomos/moléculas/organismos; separa orquestación y presentación. La autorización real, las invariantes y los importes pertenecen al backend. Conserva los estados de vista del proyecto. No reescribas componentes enteros para corregir un criterio pequeño.

Cada módulo tiene un responsable primario y contratos para sus consumidores. Los archivos globales —rutas, navegación, bootstrap, configuración, contratos compartidos y esquema— requieren coordinación; no los editen simultáneamente seis sesiones. Un cambio compartido se registra como propuesta con diff mínimo, propietario, consumidores, compatibilidad y pruebas. No crees servicios duplicados para evitar coordinar.

No alteres el esquema canónico o archivos generados sin localizar su fuente y el proceso de evolución del proyecto. Una columna faltante exige un cambio de modelo/DDL compatible y verificable, no una edición aislada que la próxima generación destruya. Nunca apliques migraciones destructivas a una base compartida.

## E. Independencia de desarrollo e integración separada

Define contratos antes de depender del avance de otro equipo. Para cada puerto: propósito; propietario; consumidores; versión; entrada/salida; campos obligatorios y nulos; IDs; fecha/zona horaria; dinero y moneda; errores; autorización/tenant; idempotencia; concurrencia; efectos; compatibilidad; ejemplos sintéticos validados. Un contrato no encontrado es PROPUESTO, no EXISTENTE.

Usa adaptadores de prueba estrictos para las dependencias que aún no estén disponibles. El esquema y el comportamiento de esos adaptadores deben corresponder al contrato acordado. Una petición desconocida, campo incompatible o transición inválida falla; no hay respuestas genéricas «plausibles» con 200. Para APIs externas sin documentación recibida, no inventes el contrato de una aseguradora, farmacia o laboratorio: delimita el puerto interno y deja la integración específica BLOQUEADA.

Separa estas evidencias:
1. Unitarias/componentes: se permiten dobles controlados.
2. Integración local: API y persistencia reales del sistema en un entorno desechable; dobles únicamente en fronteras externas, declarados.
3. Integración entre módulos: frontend real → API real → base real de prueba; efectos y lectura posterior, sin interceptor mock del sistema.
4. Certificación externa: sandbox/proveedor autorizado, versión y respuesta observadas. No se hereda de las anteriores.

Un módulo puede avanzar y quedar listo para integración sin bloquear a otro. **Eso no equivale a cumplimiento end-to-end ni a producción aprobada.** La sesión coordinadora integra versiones compatibles y ejecuta los journeys; si no existe, entrega el handoff sin autoaprobarlo.

## F. Confirmación comercial sin pasarela

Donde la fuente dice «pagado» como condición para confirmar pedido, ganar puntos, reservar un descuento o calcular comisión, no inventes un pago. Registra una decisión pendiente sobre el hecho verificable que reemplaza esa dependencia: confirmación autorizada del establecimiento, documento externo o integración acordada. No elijas unilateralmente un mecanismo definitivo.

Puedes proponer un contrato de confirmación comercial, claramente rotulado PROPUESTO. Debe distinguir solicitado, confirmado, atendido/retirado, cancelado y estado de cobro externo sólo cuando esté documentado; validar actor, evidencia, identificador de origen e idempotencia. No crear un ledger financiero de pagos encubierto. No acumular puntos o comisiones por sólo pulsar «comprar». Preparar y probar el mecanismo con datos sintéticos no certifica el acuerdo comercial.

## G. Plan obligatorio por fases

**F0 — Descubrimiento:** snapshot de ambos repos, instrucciones, alcance, inventario por inciso, evidencia actual y kill-test barato. No copies los porcentajes previos.

**F1 — Contratos y diseño mínimo:** fuentes de verdad, propietarios, dependencias, semántica de estados y propuestas de cambio. Registra discrepancias literales del Registro sin resolverlas por conveniencia.

**F2 — Plan:** hitos `Hn`, subtareas `Hn.Sn`, microtareas `Hn.Sn.Mn`. Cada microtarea incluye CA Dado/Cuando/Entonces, archivos realmente localizados, dependencias, responsable, comando verificable, salida esperada, reversión y evidencia. No uses «integrar todo» como tarea.

**F3 — Implementación incremental:** prueba que reproduce la brecha cuando corresponda; cambio mínimo; unitarias y componentes; integración de API/DB; luego UI. Mantén el sistema funcionando. No debilites tests, reduzcas cobertura, uses skip/only, cambies fixtures para ocultar defectos ni agregues reintentos sin diagnóstico.

**F4 — Journey del módulo:** ejecuta las secuencias específicas de este documento con roles y datos sintéticos. Demuestra `UI → request → response → persistencia → recarga → UI` y el efecto observable en el actor siguiente. Para lecturas, verifica fuente, filtros, permisos y ausencia de efectos indebidos.

**F5 — Regresión y revisión:** comandos realmente disponibles en manifests, compilación, tipos, lint, tests, contratos y navegador. Verifica versión y modo de ejecución; no presupongas que el build llamado production habla con API real. No alteres CI global desde seis sesiones. Revisión independiente cuando exista; si no existe, deja aprobación humana PENDIENTE.

**F6 — Entrega:** matriz actualizada, diff/commits, evidencias sanitizadas, pendientes exactos, bloqueos externos, handoff y prompts por tarea restante. Abrir PR sólo si está autorizado; nunca mergear ni desplegar por cuenta propia.

## H. Controles de aceptación transversales

- Autorización por actor, recurso y tenant; pruebas negativas con dos organizaciones y dos pacientes. Prohibido «solucionar» un 403 concediendo SUPERADMIN o desactivando aislamiento.
- Dinero con decimales exactos, moneda explícita, redondeo documentado y ausencia distinta de cero. Fechas civiles y timestamps diferenciados; zona de la operación explícita.
- Mutaciones repetidas, reintentos, concurrencia, cancelación y datos obsoletos no deben duplicar registros, stock, citas, puntos ni comisiones.
- Documentos: formatos y límites del contrato, archivo real detrás del ID, propiedad, permisos de descarga, vínculo al recurso correcto, carga fallida y archivo ajeno. No fabricar PDFs, certificados o firmas con validez real.
- Notificaciones: evento correcto, receptor correcto, contenido mínimo, deduplicación, reintentos y canal realmente configurado. Un toast local no demuestra recepción en otro dispositivo ni push con la app cerrada. Mantén «TOUS» como término de la fuente hasta documentar su interpretación aprobada.
- Navegador real: estados de carga, vacío, error, sin permiso y éxito; teclado, foco, etiquetas, contraste y reflow con viewports acordados. Una captura no sustituye las aserciones ni la persistencia. No conviertas tokens de animación o estética en nuevos requisitos de negocio.
- Sólo datos sintéticos en pruebas y evidencias. No historias reales en logs, trazas, screenshots, URLs o herramientas externas. La analítica clínica autorizada es un caso de negocio, no telemetría; exige alcance, propósito y minimización.
- No diagnostiques, prescribas, inventes equivalencias farmacológicas ni decidas repetición clínica por heurísticas del agente. Automatiza el flujo conforme a una decisión clínica válida, no la decisión médica.
- No presentes cumplimiento legal, sanitario, fiscal, actuarial o acuerdos de terceros como certificado porque el código compila.

## I. Respuesta final obligatoria del agente

Entrega: alcance IN/OUT; SHAs; matriz por inciso; implementado y probado; a medias con «qué anda / qué no / qué falta / dónde quedó»; no ejecutado; bloqueos y quién los resuelve; pruebas con comando y salida real; regresiones; riesgos; archivos modificados; revisión pendiente; siguiente tarea concreta. Separa cumplimiento del Registro, integración externa y autorización de producción.

No uses «completo», «100 %» o «listo para producción» mientras exista un criterio incluido no satisfecho o una evidencia requerida no ejecutada. Las exclusiones no son defectos ni logros implementados. El objetivo es cerrar el alcance restante con pruebas, no mejorar una nota.

## 1. Resultado que debes cerrar

Un profesional declara su identidad, credenciales, contactos y sedes; configura disponibilidad; recibe pacientes existentes o nuevos; documenta consulta/diagnóstico; emite receta y órdenes; recibe resultados; realiza reconsulta/cierre y gestiona la documentación fiscal correspondiente. La receta habilita el cronograma de tomas descrito en la fuente cuando las instrucciones permiten derivarlo de forma segura. Teleconsulta permanece incluida. **El cobro integrado y el delivery no forman parte del trabajo.**

No confundas registro profesional con registro empresarial del consultorio: vincula la identidad clínica y la entidad que factura sin mezclarlas.

## 2. Mapa completo de los siete apartados

| Grupo | Fuente | Requisitos que deben descomponerse |
|---|---|---|
| MED-01 Identidad | L166–171; L177 | Nombre completo en tres campos de nombres y dos apellidos; CI exigido y departamento; nacimiento y edad automática. |
| MED-02 Ocupación, profesión y especialidades | L172–176 | Ocupación/catalogación SEGIP y buscador solicitados; L0174 pide tres casillas adicionales de especialidad con el catálogo sin filtro por profesión; L0176 trata profesión, matrícula y colegio. La decisión previa de retirar «ocupación» no puede reemplazar el Registro sin cambio de alcance documentado. |
| MED-03 Contactos separados | L178–186 | Celular y correo personal; domicilio/GPS; celular/fijo de trabajo, dirección/GPS y correo laboral separados. No usar el email de acceso como sustituto universal. |
| MED-04 Credenciales | L187–199 | Hasta dos carreras/títulos universitarios; matrícula ministerial; múltiples diplomados, maestrías, doctorados y especialidades con documentos; colegio y rótulo/selección conforme a profesión, también al editar. |
| MED-05 Consultorios | L200 | GPS de cada consultorio de atención y capacidad de manejar varios. |
| MED-06 Fiscal/empresa | L202–215 | Razón social, tipo societario, constitución PDF, NIT y PDF, SEPREC, licencia, SEDES, dirección/GPS legal, representante, poder y correo. Se conserva aunque no exista pasarela. |
| MED-07 Disponibilidad | L216–218 | Horarios en hospitales públicos y establecimientos privados; sincronización con calendario de trabajo; sede y disponibilidad para pacientes. No sustituir el cuadro de horarios por un texto sin efecto en agenda. |
| MED-08 Calendario y avisos | L219–222 | Diario/semanal/mensual con horario y nombre; notificar demoras; aviso automático por cancelación a quienes no consiguieron cupo conforme al proceso. |
| MED-09 Recepción paciente nuevo | L223–236 | Nombre desglosado, CI/departamento, nacimiento/edad, ocupación/buscador, celular, tutor no registrado, enlace de activación y posterior confirmación de datos y vínculo. Crear sólo una cuenta no cumple crear paciente. |
| MED-10 Consulta/documentos | L237–241 | Diagnóstico, ficha guardada y aviso al crearla; enlace con receta y órdenes separadas; recepción de resultados y capacidad de evaluación. |
| MED-11 Reconsulta/teleconsulta | L242–244 | Reconsulta, opción de teleconsulta y nueva receta/enlace posterior a resultados. |
| MED-12 Medicación y cierre | L245–246 | Cronograma automático desde indicaciones, calendario y alarmas 15 minutos antes y a la toma por cada medicamento; completar ficha anterior y cerrar la consulta. |
| MED-13 Fiscal sin seguro | L247–255 | Excluir el cobro QR de L249; conservar consulta sobre factura, comprobante/aviso, NIT, razón social, recuperación por NIT y uso del perfil fiscal guardado. El evento que acredita un pago externo requiere decisión, no simulación. |
| MED-14 Fiscal con seguro | L256–263 | Excluir QR de coaseguro de L257; conservar importes atribuidos al paciente, factura/comprobante y reutilización de datos fiscales. |
| MED-15 Facturación al seguro | L264–266 | Resto atribuible a aseguradora con paciente identificado, facturación semanal/quincenal/mensual dentro de plazos acordados e informes separados de seguro, deducible y sin seguro. Programar facturas no es programar transferencias. |

## 3. Responsabilidades y límites

**Propiedad primaria:** expediente y actos clínicos del profesional, disponibilidad publicada, contexto de consulta y vínculos orden/receta/resultado, datos fiscales de su actividad y generación de documentos clínicos. Reutiliza identidad y representación compartidas; no mantengas dos pacientes distintos en Paciente y Médico.

Contratos a coordinar:
- Con Paciente: alta asistida, datos pendientes, enlace de activación, representación y avisos. El profesional no asigna unilateralmente a un tutor acceso irrestricto.
- Con agenda compartida: disponibilidad por sede, solapamientos entre sedes, intervalo y zona horaria, cancelación, demoras y destinatarios.
- Con Farmacia: receta versionada, ítems, indicaciones y propuestas de alternativa; no equiparar alternativa comercial con autorización médica de sustitución.
- Con Laboratorio/Imagenología: orden por paciente/encuentro, estudios, médico solicitante, preparación del prestador, resultado y aviso.
- Con Aseguradora: correlación con cobertura, autorización/decisión por ítem, explicación e importes. La fuente de verdad de cobertura no es el médico ni el navegador.
- Con facturación: entidad emisora, destinatario fiscal, líneas/importes/moneda, relación a consulta y desglose de responsabilidades; separar factura, comprobante y estado de cobro externo.

## 4. Reglas clínicas y operativas que no debes sustituir

1. Credencial subida no es credencial verificada. Conserva emisor, tipo, documento y estado verificable según modelo; no autoaprobar matrículas ni colegiación.
2. La edad se deriva; no actualices una edad almacenada como si fuera la fuente de verdad. Identidad personal, laboral y fiscal tienen propósitos distintos.
3. Sincronizar horarios requiere prevenir solapamientos incompatibles entre consultorios del mismo profesional, no sólo dentro de una sede.
4. Notificar creación de ficha y notificar cierre son hechos distintos en el Registro. Identifica exactamente cuándo exige el aviso, sin moverlo para facilitar implementación.
5. Recetas y resultados corregidos conservan versión/autoría; no sobrescribas historia clínica ni reasignes un resultado a otro paciente.
6. El cronograma usa instrucciones médicas estructuradas: inicio/fin, frecuencia, intervalos y excepciones. Si la indicación es ambigua, a demanda o carece de información, pide validación clínica en el producto; no inventes horarios ni dosis. No impongas un esquema posológico genérico.
7. La alarma 15 minutos antes y a la hora de toma es un requisito literal; un timer de navegador con pestaña abierta no acredita notificación móvil/background. Determina soporte y permisos de la plataforma; limita explícitamente el estado demostrado.
8. Teleconsulta exige dos participantes autorizados, sesión, acceso y finalización verificables. La existencia de un objeto «encuentro virtual» no acredita sala de video. No agregues grabación, transcripción por IA ni servicios externos no acordados.
9. La reutilización de resultados puede sugerirse mediante el flujo existente, pero no sustituyas el juicio del médico sobre repetición necesaria por una regla financiera ciega.
10. Sin pasarela, no declares un pago efectuado ni emitas un comprobante que lo afirme sin evidencia externa autorizada. Una factura puede tener estado administrativo independiente del cobro.

## 5. Hitos del trabajo

**H1 — Alta profesional completa:** identidad y contacto diferenciados, formación/credenciales múltiples y editor coherente con el alta.

**H2 — Sedes y perfil fiscal:** consultorios/GPS, entidad que factura, documentos y datos fiscales; sin implementar cobros.

**H3 — Agenda coherente:** disponibilidad por sede, vistas día/semana/mes, conflictos y avisos conforme a fuente.

**H4 — Recepción asistida:** paciente existente/nuevo y relación con activación/tutor del módulo Paciente.

**H5 — Consulta longitudinal:** ficha, diagnóstico, receta, órdenes y avisos; resultado y reconsulta, trazabilidad y cierre.

**H6 — Teleconsulta y medicación:** desarrollar las partes disponibles con contratos de plataforma; identificar explícitamente dependencias de sala, push y background.

**H7 — Documentación fiscal:** sin seguro/con seguro; reutilización de NIT/razón social; facturación periódica al seguro e informes. Programación administrativa no implica tesorería.

**H8 — Verificación transversal:** journeys clínicos y fiscales, seguridad por paciente/sede y regresión.

## 6. Escenarios de aceptación mínimos

| Escenario | Qué debe demostrarse |
|---|---|
| MED-E01 | Alta con nombres adicionales, dos carreras, varias especialidades y varios posgrados: lectura/edición conserva tipos, instituciones y documentos sin convertir todo en texto libre. |
| MED-E02 | Cambiar profesión ajusta las opciones/etiquetas acordadas de matrícula/colegio; credenciales previas no se destruyen ni se reinterpretan silenciosamente. |
| MED-E03 | Contactos y ubicaciones personales, laborales y fiscales diferentes reaparecen separados después de recarga. |
| MED-E04 | El profesional publica horarios en dos sedes: los pacientes ven lugar correcto; un solapamiento incompatible se rechaza de forma transaccional. |
| MED-E05 | Día/semana/mes muestran los mismos turnos y nombres con zona correcta; otra organización no obtiene datos clínicos fuera de su alcance. |
| MED-E06 | Demora/cancelación produce el aviso correcto una vez, al paciente adecuado; el estado sobrevive al reinicio del proceso de notificación. |
| MED-E07 | La secretaria/profesional crea un paciente nuevo con CI y tutor pendiente; activación posterior completa la misma identidad, no una segunda. |
| MED-E08 | Guardar ficha con diagnóstico crea versión persistida y el aviso requerido; cerrar la consulta no es el único disparador si el requisito exige antes. |
| MED-E09 | Receta y dos órdenes separadas llegan al paciente y a los prestadores correctos; IDs, autoría y consulta coinciden en la lectura posterior. |
| MED-E10 | Resultado recibido notifica al médico; reconsulta lo consulta y emite una nueva receta versionada sin perder la anterior. |
| MED-E11 | Teleconsulta se abre con paciente y profesional autorizados; tercero y enlace expirado fallan; finalización queda registrada. Sólo se cierra con la plataforma realmente probada. |
| MED-E12 | Una receta sintética estructurada produce calendario por medicamento y avisos a T−15 y T; cambio/suspensión cancela avisos futuros pertinentes, reintento no los duplica. Indicación ambigua no inventa pauta. |
| MED-E13 | NIT guardado recupera razón social del paciente correcto, no de otro tenant; factura/comprobante usa emisor y destinatario adecuados sin fingir cobro. |
| MED-E14 | Consulta con cobertura separa importe del paciente y del seguro; factura administrativa del seguro vincula cada consulta y no duplica importes. |
| MED-E15 | Cierre semanal/quincenal/mensual genera documentos dentro del calendario acordado una sola vez; repetición, reinicio y cancelación no duplican lote. No ejecuta transferencia. |
| MED-E16 | Informe separa atención sin seguro, parte atribuida a seguro y parte del paciente; las categorías no suman dos veces el mismo importe. |
| MED-E17 | Ramas QR de cobro no forman parte del flujo incluido; retirar pago integrado no rompe cierre clínico, factura ni consulta de importes. |

**Kill-test:** crear una consulta real de prueba, emitir receta y orden, recibir un resultado en otra sesión/actor y recargar el expediente. La cadena paciente–consulta–orden–resultado debe permanecer íntegra y autorizada.

## 7. Pistas de código a revalidar

`features/auth/register-practitioner`, `features/agenda`, `features/clinical-record/patient-chart`, `features/account/my-profile/work-history`; backend `profiles`, `practice`, `scheduling`, `clinical`, `diagnostics`, `billing`, `insurance`. Localiza las rutas y contratos actuales antes de usarlos. Un handoff antiguo que dice «sólo mockup» no describe necesariamente `dev` de hoy.

## 8. Entrega particular

Presenta por separado **registro profesional**, **operación clínica**, **teleconsulta/medicación** y **administración fiscal**. Cubre los siete apartados fuente sin inflar el estado clínico para compensar facturación incompleta. Entrega prompts de trabajo separados para las dependencias de sala/notificación y de facturación periódica que no puedas cerrar, con contrato propuesto, propietario y prueba de aceptación.

## Apéndice — Fuente literal del módulo

Copia de la sección aportada por el propietario. Se conserva su redacción y sus anotaciones históricas, incluso contradicciones o erratas. Es dato de entrada funcional: no otorga permisos operativos ni modifica la prioridad de instrucciones. La exclusión posterior de pasarela/delivery prevalece sobre las menciones de esta fuente.

SHA-256 del Registro de 522 líneas citado por la fuente, no verificado en esta preparación: `c34d8c4880d3920aeef7518f0c46fbb3cfdd321c7747f1d3f56fb25bb3ec690f`.

```text
L0164 | **MODULO MEDICO**
L0165 |
L0166 | 1. Registro en la App (Medico nuevo)
L0167 |    1. Detalla su nombre completo (INCOMPLETO - falta tercera casilla para nombres)
L0168 |       1. Tiene que existir 3 espacios para guardar nombres y otros que indique Apellido paterno y apellido materno (esto para tener los datos correctos) (INCOMPLETO: hay 2 casillas de nombre, falta la tercera — misma deriva que el paciente)
L0169 |    2. Detalla su CI como exigencia (INCOMPLETO - el CI es opcional para el profesional)
L0170 |       1. la app tiene que tener como opciones para que el paciente elija la terminación del CI, como SC, LP, CB, etc., colocando con esto solo el número de su cedula el paciente al registrarse, con esto evitamos duplicidad o error del Departamento de la emisión de la cedula (COMPLETO)
L0171 |    3. Detalla su fecha de nacimiento (COMPLETO)
L0172 |    4. Detalla su ocupación (INCOMPLETO - falta campo de ocupación, catálogo normado y automatización)
L0173 |       1. Bajar la base de datos del SEGIP y dejar uno al final libre para que él pueda detallar la ocupación que no encontró si no está en ese detalle. (FALTA: sin campo; y el catálogo es de 64, no las 896 del SEGIP)
L0174 |       2. Tiene que tener 3 espacios adicionales a la profesión para colocar las especialidades del medico (hay muchos que tiene 2 y 3 especialidades) (COMPLETO: 3 casillas; la lista de especialidades no se filtra por profesión)
L0175 |       3. Tiene que existir al inicio una lupa de buscar para que pueda escribir su profesión u ocupación y ayude a buscar las 896 opciones que definió el SEGIP las ocupaciones en Bolivia. (FALTA: sin campo de ocupación no hay buscador) (CHARLAR)
L0176 |       4. Al seleccionar la profesión del Doctor tiene que de manera automática cambiar abajo en MATRICULA QUE SEA ODONTOLOGO y lo mismo para el REGISTRO DEL COLEGIO MEDICO O COLEGIO DE ODONTOLOGO de forma automática, para que con esto nosotros conozcamos el numero de MATRICULA de que profesión de manera exacta. (INCOMPLETO: cambia el colegio preseleccionado, no el rótulo; la API guarda el colegio como texto libre) (CHARLAR)
L0177 |    5. Edad (la app tiene que arrojar de manera automática la edad del paciente con la fecha de nacimiento ingresada) (COMPLETO)
L0178 |    6. Numero celular personal o privado (INCOMPLETO - se mezcla con el de trabajo)
L0179 |    7. Correo electrónico personal o privado (INCOMPLETO - es el mismo de acceso)
L0180 |    8. Dirección de domicilio (INCOMPLETO - no distingue domicilio de trabajo)
L0181 |    9. Ubicación GPS Domicilio (INCOMPLETO - no se captura)
L0182 |    10. Numero celular trabajo (INCOMPLETO - no hay segundo teléfono)
L0183 |    11. Numero fijo trabajo (INCOMPLETO - faltante)
L0184 |    12. Dirección de trabajo (INCOMPLETO - una sola dirección)
L0185 |    13. Ubicación GPS Trabajo (INCOMPLETO - faltante)
L0186 |    14. Correo electrónico trabajo (INCOMPLETO - un único correo)
L0187 |    15. Título Profesional Universitario (INCOMPLETO - falta pantalla para institución y carga de PDF)
L0188 |        1. Tiene que tener opción para 2 títulos de carrera diferentes (yo conozco médicos con 2 carreras profesionales)  (INCOMPLETO: API lista; falta la pantalla)
L0189 |    16. Matricula del Ministerio de Salud Nacional (COMPLETO)
L0190 |    17. Título de Diplomado (INCOMPLETO - falta pantalla de carga)
L0191 |        1. Tienen que tener espacio para poder subir varios diplomados  (INCOMPLETO: idem)
L0192 |    18. Título de Maestría (INCOMPLETO - falta pantalla de carga)
L0193 |        1. Tienen que tener espacio para poder subir varios maestría (INCOMPLETO: idem)
L0194 |    19. Título de Doctorado (INCOMPLETO - falta pantalla de carga)
L0195 |        1. Tienen que tener espacio para poder subir varios doctorados  (INCOMPLETO: idem)
L0196 |    20. Título de Especialidad (COMPLETO)
L0197 |        1. Tienen que tener espacio para poder subir varias especialidades  (COMPLETO
L0198 |    21. Registro de Colegio Medico y Colegio Odontólogos (INCOMPLETO - se guarda como texto libre, falta catálogo)
L0199 |        1. Tiene que cambiar de manera AUTOMATICA el nombre del COLEGIO al seleccionar arriba la profesión del doctor. (COMPLETO: solo en el alta; en la edición del perfil es texto libre)
L0200 |    22. Ubicación GPS de cada consultorio de atención en el Google Maps de AloVida (INCOMPLETO - el médico no puede dar de alta múltiples consultorios)
L0201 |
L0202 | 2) Registro de sus datos de Facturación
L0203 |    1. Registrar el nombre o razón social de la empresa (INCOMPLETO: falta tabla de perfil fiscal del médico en la interfaz)
L0204 |       1. Aquí nuestra APP tiene que tener este detalle en la base de datos para que puedan SOLO SELECCIONAR AL REGISTRAR, UNIPERSONAL, SRL, LTDA, S.A., SOCIEDAD COLECTIVA, SOCIEDAD EN COMANDITA SIMPLE, SOCIEDAD EN COMANDITA POR ACCIONES, SUCURSAL DE SOCIEDAD EXTRANJERA)     Esto con la finalidad de poder tener DATA de cuantos proveedores tenemos con SRL, UNIPERSONAL y S.A. (INCOMPLETO: el catálogo de los 8 tipos existe en la API; ninguna pantalla lo ofrece)
L0205 |       2. Adjuntar Constitución de la empresa en PDF (FALTA: solo existe la tabla)
L0206 |    2. Registrar el número de NIT (FALTA para el médico; el NIT existe para paciente y aseguradora)
L0207 |       1. Adjuntar el NIT en PDF (FALTA)
L0208 |    3. Adjuntar el SEPREC en PDF (FALTA)
L0209 |    4. Adjuntar la licencia de funcionamiento en PDF (INCOMPLETO: la API acepta acreditaciones con archivo; no hay pantalla de carga ni tipo «licencia de funcionamiento»)
L0210 |    5. Adjuntar certificado del SEDES en PDF (FALTA)
L0211 |    6. Dirección legal de la dirección registrada  (FALTA para el médico)
L0212 |    7. Ubicación GPS de la dirección registrada (FALTA para el médico; GPS solo en sucursales)
L0213 |    8. Nombre Representante Legal (FALTA: solo existe la tabla)
L0214 |       1. Adjuntar Poder del representante legal en PDF (FALTA)
L0215 |       2. Correo electrónico del representante legal (FALTA)
L0216 | 3) Detalle de sus horarios disponibles para consultas medica
L0217 |    1. Aquí el medico registra sus horarios en los hospitales públicos que esta de turno y al registrar estos datos se enlaza de manera AUTOMATICA a su calendario de TRABAJO y ATENCIONES MEDICAS (LA APP TIENE QUE TENER UN CUADRO EN EL CALENDARIO QUE LE PERMITA AL MEDICO DETALLAR SUS HORARIOS)  (INCOMPLETO: la plantilla publicada ya es el calendario; la sede no se elige al crear —sale de la asignación del profesional a una sede—; no se distingue hospital público y no hay cuadro semanal en grilla)
L0218 |    2. También registra los horarios de atención medica en las diferentes clínicas privadas o centros que atiende al público, para que los pacientes puedan revisar sus horarios y agendar según a disponibilidades   (COMPLETO por código; no probado en la app: requiere una agenda publicada)
L0219 | 4) Revisión de su Calendario de Citas para consultas Medicas
L0220 |    1. El medico puede revisar de manera online su Calendario de Citas con horarios, nombre completo del paciente de forma diaria, semanal y mensual (INCOMPLETO: hay vista diaria y mensual con el nombre; falta la semanal; el listado de \`/schedule\` no muestra el nombre)
L0221 |    2. Mediante la APP el medico puede informar al paciente o los pacientes que se va demorar en el horario de cita agendado para no perjudicarlos (EL PACIENTE RECIBIRA UNA NOTIFICACION DEL COMUNICADO DEL MEDICO) (COMPLETO por código; no probado en la app: el botón aparece solo con agenda propia. Solo aviso dentro d—--------------------------------------------\*e la app, sin push ni SMS)
L0222 |    3. Si el medico tiene un paciente que se le desmarca en el horario ya confirmado, la APP de manera AUTOMATICA enviara una NOTIFICACION a los PACIENTES que estuvieron revisando horarios para ese mismo día y no consiguieron horario (ayudando con esto al medico a que no pierda el paciente y También al PACIENTE a poder contar con la cita que requería).  (INCOMPLETO: hay lista de espera con aviso, pero el paciente debe anotarse y el aviso sale por barrido del worker, no al desmarcar; no es «quienes buscaron ese día»; sin UI del médico)
L0223 | 5) Recepción del paciente
L0224 |    1. Si el paciente es nuevo y no cuenta con USUARIO YA CREADO en la APP
L0225 |       1. Detalla su nombre completo  (INCOMPLETO: el nombre queda en la cuenta, no en una persona/paciente)
L0226 |       2. Tiene que existir 3 espacios para guardar nombres y otros que indique Apellido paterno y apellido materno (esto para tener los datos correctos) (INCOMPLETO: falta la tercera casilla)
L0227 |       3. Detalla su CI como exigencia  (FALTA)
L0228 |       4. la app tiene que tener como opciones para que el médico o secretaria elija la terminación del CI, como SC, LP, CB, etc., colocando con esto solo el número de su cedula el paciente al registrarse, con esto evitamos duplicidad o error del Departamento de la emisión de la cedula (FALTA)
L0229 |       5. Fecha de nacimiento (FALTA)
L0230 |       6. Ingresa su ocupación  (FALTA)
L0231 |       7. Bajar la base de datos del SEGIP y dejar uno al final libre para que él pueda detallar la ocupación que no encontró si no está en ese detalle. (FALTA)
L0232 |       8. Tiene que existir al inicio una lupa de buscar para que pueda escribir su profesión u ocupación y ayude a buscar las 896 opciones que definió el SEGIP las ocupaciones en Bolivia. (FALTA)
L0233 |       9. Edad (la app tiene que arrojar de manera automática la edad del paciente con la fecha de nacimiento ingresada) (FALTA)
L0234 |       10. Numero celular usuario (FALTA: solo pide correo)
L0235 |       11. Numero celular persona tutor o autorizada (si no está registr
L0236 |       12. ado el paciente y tampoco el TUTOR la asistente registra de esa manera y guarda así el registro, posteriormente al recibir el link la persona confirma los datos y enlaza al DEPENDIENTE y al TUTOR con el numero de celular del paciente y el TUTOR)   (INCOMPLETO: hay código/link de activación; falta el celular del tutor, la confirmación de datos y el enlace dependiente↔tutor desde esta pantalla)
L0237 | 6) Consulta, elaboración de la ficha medica
L0238 |    1. SIMULACION CON UN PACIENTE QUE NO CUENTA CON SEGURO MEDICO
L0239 |       1. El medico realiza su Diagnóstico y crea su ficha medica del paciente en la APP quedando guardada y el paciente recibirá un TOUS donde recibirá el aviso de la recepción de su ficha medica creada por el médico. (INCOMPLETO: la ficha y el diagnóstico existen; el aviso al paciente llega recién al cerrar la consulta, no al crear la ficha)
L0240 |       2. El medico envía un link al paciente junto con todos los análisis que requiere por separado (Receta medicamentos, Laboratorios, Análisis clínicos, etc.)   (INCOMPLETO: receta y pedidos existen y la receta avisa in-app; no hay «link» y la orden de laboratorio no avisa al paciente — TODO en la API)
L0241 |       3. El medico recepción los resultados de todo el análisis requerido al paciente para poder evaluar el respectivo diagnostico   (INCOMPLETO: los resultados se ven al abrir el expediente; no hay aviso al médico cuando llegan)
L0242 |          1. Espera la Re consulta con el paciente para informar el diagnostico final (COMPLETO por código; no probado en la app: es una consulta nueva del mismo episodio)
L0243 |             1. Opción de TELECONSULTA (INCOMPLETO: existe API de encuentros virtuales pero faltan brechas de sala de video e interfaz de teleconsulta)
L0244 |          2. Emite un nuevo link al paciente con la nueva receta posterior de ver los análisis recibidos (INCOMPLETO: se puede emitir otra receta con aviso in-app; sin link; reemplazar/renovar solo en la API)S
L0245 |          3. En la receta emitida detalla todas las indicaciones a tomar sus medicamentos y de forma AUTOMATICA LA APP crea un cronograma de los medicamentos a tomar y LO ENLAZA CON EL CALENDARIO y con ALARMAS de 15min. Y a la hora de cada TOMA, esto mismo se repite para cada medicamento  (FALTA: sin cronograma de tomas, calendario ni alarmas en ninguna capa)
L0246 |          4. Completa la ficha medica abierta anterior y CIERRA EN LA APP la consulta (COMPLETO por código; no probado en la app: requiere una consulta en curso)
L0247 | 7) Facturación y/o pago por la consulta medica
L0248 |    1. SIMULANDO QUE NO TIENE SEGURO
L0249 |       1. El medico emite un qr por el monto total de la consulta a pagar  (FALTA: no hay cobro de consulta ni QR; los intents de pago son genéricos y sin rol médico)
L0250 |       2. Se le consulta si quiere factura y si no quiere se le envía solo un comprobante de pago a su APP de manera directa (un TOUS le informara del pago realizado total) (INCOMPLETO: la API emite factura desde el encuentro pero solo con rol de administrador; sin pregunta, sin comprobante ni aviso; el médico no puede)
L0251 |       3. Si el paciente quiere factura se le solicita lo siguiente
L0252 |          1. NIT a nombre de quien se emitirá la factura (INCOMPLETO: el NIT del paciente se guarda en el alta pero no llega a la factura)
L0253 |          2. Nombre o razón social que requiere el paciente (FALTA)
L0254 |             1. La APP tiene que ir guardando los datos de la facturación de cada paciente para que en la próxima se digite solo el NIT la APP rellene de manera directa la razón social y emita la factura de manera directa y envié por un TOUS (ahorrándonos costo de envió por whatsapp) (FALTA)
L0255 |          3. Si ya esta registrado los datos de la facturación del paciente en la APP el medico factura al NIT guardado.  (FALTA)
L0256 |    2. SIMULANDO QUE TIENE SEGURO
L0257 |       1. El medico emite un qr por el monto del coaseguro de la consulta a pagar  (FALTA: hay datos de copago en el catálogo de planes, pero no se calcula ni se cobra nada)
L0258 |       2. Se le consulta si quiere factura y si no quiere se le envía solo un comprobante de pago a su APP de manera directa (un TOUS le informara del pago realizado del coaseguro) (INCOMPLETO: ídem M7.1.2)
L0259 |       3. Si el paciente quiere factura se le solicita lo siguiente
L0260 |          1. NIT a nombre de quien se emitirá la factura (INCOMPLETO: solo el NIT existe en el perfil; razón social, datos guardados y factura al NIT guardado: nada)
L0261 |          2. Nombre o razón social que requiere el paciente (INCOMPLETO: solo el NIT existe en el perfil; razón social, datos guardados y factura al NIT guardado: nada)
L0262 |             1. La APP tiene que ir guardando los datos de la facturación de cada paciente para que en la próxima se digite solo el NIT la APP rellene de manera directa la razón social y emita la factura de manera directa y envié por un TOUS (ahorrándonos costo de envió por whatsapp) (INCOMPLETO: solo el NIT existe en el perfil; razón social, datos guardados y factura al NIT guardado: nada)
L0263 |          3. Si ya está registrado los datos de la facturación del paciente en la APP el medico factura al NIT guardado.  (INCOMPLETO: solo el NIT existe en el perfil; razón social, datos guardados y factura al NIT guardado: nada)
L0264 |       4. El monto restante de la consulta que es la parte de la aseguradora de salud se le emite a la compañía de manera directa con el detalle del nombre del paciente para llevar un mejor control (INCOMPLETO: la API tiene reclamos a la aseguradora sin enlace con la consulta/factura; sin pantalla)
L0265 |          1. La facturación a la compañía de seguro se puede configurar o programar semanalmente, quincenal o mensualmente (dentro de los plazos que maneja el seguro de recepción de factura)  (FALTA: los reclamos se envían de a uno por la API; no hay programación semanal/quincenal/mensual —solo lotes de conciliación manuales de administrador—; sin pantalla)
L0266 |          2. El medico puede sacar un informe de cuanto es lo que facturo para el seguro y lo que factura con el deducible incluido, como también lo que facturo a los pacientes sin seguro (INCOMPLETO: Contabilidad muestra el total de consultas pagadas por mes de la práctica; no separa seguro / sin seguro ni deducible)
```
