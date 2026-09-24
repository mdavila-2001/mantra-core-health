# Reporte de ejecución — módulo Médico

- Fecha: 2026-09-24 · Plan: PLAN.md · Rama: justin/medical-module-cierre
- Fuente funcional única: 02_METAPROMPT_MEDICO.md; copia congelada junto al plan en `sources/medical-metaprompt.md` (MetaPrompts) y SHA-256 verificado.
- SHA-256 de la fuente: b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656
- Base de código frontend: origin/mockup b11dfdd382dd787fab33d5894979ccc2c4d5a96a. Esta rama sigue siendo documental; la corrección visual acotada vive en `justin/mockup-corr-38-editar-perfil-medico-como-alta`, commit `55e948a4`, PR borrador #612 contra `mockup`.
- Peldaño máximo: `VERIFIED` para la persistencia/lectura segura de credenciales, exclusión de reservas concurrentes multi-sede y diez criterios puntuales de credenciales/especialidades con journey Chromium→API→PostgreSQL. El plan integral conserva 10/98 criterios HECHO; MED-E01/H1 y los escenarios restantes no están completos ni alcanzan `REGRESSION_VERIFIED`.
- Avance integral: 10/98 criterios incluidos alcanzan aceptación y DoD puntual; matriz: 100 criterios fuente, 98 IN, 2 OUT; 10 HECHO, 60 A MEDIAS, 11 TODO, 17 BLOQUEADOS, 2 DESCARTADOS. CORR-08 mantiene alcance visual parcial.

## Continuación H1: tres casillas adicionales y especialidades sin filtro por profesión

La línea L0174 del archivo fuente confirma ambas condiciones: tres espacios adicionales a la profesión y catálogo no filtrado por profesión. El código anterior capaba el total de API en tres y dividía opciones de interfaz según odontología/medicina. Se corrigió a cuatro especialidades totales (una principal más tres adicionales) en la alta, onboarding y editor; el alta ya muestra todas las opciones y conserva una elección aunque cambie la profesión.

Ramas publicadas: frontend `justin/medical-module-execution-20260924` commit `444e915e`, API misma rama commit `5ff4bfe8`. Ver [reporte de pruebas y límites](evidence/h1-specialty-slots/REPORT.md). No se declara cerrado el criterio porque falta el recorrido browser→API→PostgreSQL→recarga y la captura exigida por el DoD. L0174.AC01/AC02 y MED-E01 continúan parciales; la cuenta sigue 10/98.

## Continuación: dirección laboral y más de un consultorio propio

En `justin/medical-module-execution-20260924` se añadió al editor médico la dirección laboral como dato distinto del domicilio, junto con un segundo selector de mapa. FE carga y envía `workAddressLines` y el par `workLatitude`/`workLongitude` por separado; ausente significa “sin tocar” y dos `null` quitan el pin. La API lee el uso `ADDR_USE_WORK` sólo en la ficha propia, valida el par de coordenadas y reemplaza la dirección vigente con ese uso. No se cambió modelo ni DDL. También se eliminó la condición de interfaz que ocultaba “Agregar mi consultorio propio” después de la primera sede; cada sede conserva su propia dirección y GPS. Las puntas publicadas son FE `5588753cc9b3c0a70ce2cf19e4eda6090e5635c4` y API `982ed2b9a96a7a14afa4137b96847144c8f50726`.

| Área | Verificación | Resultado | Límite |
|---|---|---|---|
| Editor médico y sedes | Dos specs dirigidos: `practitioner-profile-edit` y `work-history` | 2 archivos, 178/178 pruebas aprobadas; ESLint dirigido y `corepack yarn typecheck` exit 0 | Dobles HTTP; sin recorrido visual/Playwright ni persistencia real de este cambio |
| API de perfil médico | Spec de servicio más spec de DTO para `workAddress` | 2 suites, 140/140 pruebas aprobadas; ESLint dirigido y `corepack yarn typecheck` exit 0 | Sin PostgreSQL/API real; no demuestra lectura tras reinicio |
| Suite FE completa | `corepack yarn test --watch=false` | No terminó: 107 archivos pasaron y 472 fallaron al cargar/ejecutar; 3.203 pruebas pasaron y 30 fallaron. El runner devolvió `ENOSPC` creando archivos temporales; dos fallos identificados son los rojos preexistentes de `shell-layout`. | No es un resultado de regresión completo; no se omitieron ni debilitaron tests |
| Evidencia visual del cambio | Intento anterior del smoke de Playwright en la rama FE | No se produjo captura válida; el sistema ya había devuelto `ENOSPC` al escribir salida visual | Los criterios relacionados siguen parciales; no se declara DoD visual |

Los estados de `RP-MED-L0180`, `RP-MED-L0184`, `RP-MED-L0185` y `RP-MED-L0200` permanecen `A MEDIAS / TESTED`: se corrigieron huecos de UI/contrato y hay pruebas de unidad, pero falta verificar el recorrido navegador→API→PostgreSQL→recarga y sus fotos. El conteo global queda 10/98 `HECHO`; este avance no convierte MED-E03/H2 ni el plan completo en terminados.

## Continuación H1: dirección laboral capturada en el alta

La rama FE `18b05cc3f0896310fde4ffe23d666861ac26bea5` agrega un paso separado para dirección/GPS laboral y los pasa en el cuerpo HTTP explícito. La rama API `aa609a865cbd8140f5057ee9b1f874aa57e3f86c` valida líneas y coordenadas en par y registra la dirección con `ADDR_USE_WORK`, independiente de HOME y de sedes propias. No se modificó modelo ni DDL.

| Área | Verificación | Resultado | Límite |
|---|---|---|---|
| Alta frontend | `corepack yarn test --watch=false --include=src/app/features/auth/register-practitioner/register-practitioner.spec.ts` | 1 archivo, 98/98 aprobadas; typecheck y ESLint dirigidos exit 0 | Pruebas de componente/cliente; sin captura ni browser con API real |
| Alta API | `corepack yarn test --runInBand src/modules/iam/dto/register-practitioner.dto.spec.ts src/modules/iam/services/iam-practitioner-self-registration.service.spec.ts` | 2 suites, 104/104 aprobadas; typecheck y ESLint dirigidos exit 0 | Servicio bajo dobles; sin PostgreSQL ni lectura tras recarga |
| Estado de criterios | `MATRIX.md` y reporte parcial en `evidence/h1-work-address-registration/REPORT.md` | No se marca ningún criterio HECHO; el conteo sigue 10/98 | MED-03, MED-E03, H1 y el plan general requieren el journey completo |

## Verificado en esta continuación

| Área | Verificación | Resultado | Límite |
|---|---|---|---|
| Tipos frontend | corepack yarn typecheck | Exit 0 sobre la punta actual de mockup | No acredita integración ni comportamiento visual completo |
| Perfil, registro y sedes médicos | corepack yarn ng test --watch=false --filter='(RegisterPractitioner&#124;PractitionerProfile&#124;WorkHistory&#124;pestañas de la ficha del médico)' — 7 archivos, 381 pruebas aprobadas; solo suites de Médico con dobles, sin suites MyProfile de Paciente. | 7 archivos; 381 aprobadas | Dobles; sin API ni persistencia real |
| Regresión frontend completa previa a la última continuación | corepack yarn ng test --watch=false | 583 archivos; 7.376 pruebas aprobadas en la repetición posterior a CORR-08 | No reemplaza journeys API/UI/DB ni E2E; la ejecución posterior se interrumpió por ENOSPC, ver arriba |
| Lint | corepack yarn lint | Exit 1; 246 errores @angular-eslint/prefer-on-push-component-change-detection | Son errores repo-wide; no se ocultaron ni se debilitó ninguna prueba |
| Corrección visual CORR-08 | `scripts/corr-evidencia.sh 38 --antes` y `scripts/corr-evidencia.sh 38` | 8/8 celdas verdes en cada fase; capturas 375/768/1440 claro y 1440 oscuro; diálogo comparativo muestra selector antes y su ausencia después | Una ficha visual no acredita persistencia clínica ni cambia el estado del DoD médico |
| API — alta profesional aislada | integration/practitioner-registration.int-spec.ts, worktree API | 8/8 aprobadas en DB desechable con semillas parciales | No es init DDL canónica ni journey del módulo Médico |
| API — credenciales y adjuntos propios | rama `justin/medical-module-execution-20260924`, punta `783d2697`; PATCH de credencial propia y PDF por fila al alta | Profiles 18 suites/402 unitarias; PATCH PostgreSQL 4/4; alta PostgreSQL 1/1 con 10 credenciales (2 por tipo), tipo/institución y adjuntos leídos, resumen privado, ocultamiento público, descarga por dueño y reuso rechazado | El caso de diez credenciales usa otro actor que el smoke del navegador; falta recorrer varios posgrados en una misma alta real |
| Editor/cliente frontend de credenciales | `corepack yarn test --watch=false --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts --include=src/app/core/data-access/profiles/profiles.client.spec.ts`; `corepack yarn typecheck` | 2 archivos/127 pruebas aprobadas; typecheck exit 0 en worktree temporal limpio sin `.env` | El editor prueba PATCH con backend de prueba; no es una sesión de navegador contra la API real |
| Alta de credenciales en frontend | rama `justin/medical-module-execution-20260924`, commit `df611861`; PDFs por fila, orden secuencial y reintento parcial | 97 pruebas de componente, Playwright simulado 4/4; typecheck, ESLint dirigido y build exit 0; además smoke real 4/4 con dos PDFs y alta 201 | El smoke real no verifica varios posgrados, lectura/edición/recarga ni descarga desde la cuenta creada |
| Alta y edición médica en navegador contra API real | Chromium real-api, API por proxy de mismo origen y PostgreSQL 18 desechable | Playwright 1/1: 8 credenciales iniciales (2 por DEGREE/DIPLOMA/MASTER/DOCTORATE), 3 especialidades; perfil agrega 1 DEGREE principal y 2 SPECIALTY con institución/PDF; PATCH propio 204; tras reload 11 filas/11 fileId únicos/3 especialidades; dueño descarga 3 PDFs nuevos (200, PDF 1.4); segundo actor resumen vacío/PATCH ajeno 404, propietario intacto. SQL agrupa cinco tipos. Evidencia en `evidence/h1-real-api/extended-smoke/editor/` | MED-E01/H1 siguen parciales por L0168, L0174.AC02 y requisitos restantes; no cierra H1–H8 |
| Agenda médica y concurrencia | FX-2/FX-9 en PostgreSQL 18 efímero; lock transaccional por profesional | scheduling 21 suites/492 unitarias; FX-2 13/13; FX-9 4/4; typecheck y ESLint dirigidos exit 0. Sin lock, dos citas simultáneas en consultorios distintos; con lock, queda una | No acredita hospital público, grilla semanal, agenda pública completa ni notificación externa |

El primer filtro amplio de 229 pruebas se descartó porque también seleccionó suites MyProfile compartidas con Paciente. El resultado válido para Médico es el filtro preciso de 381 pruebas indicado arriba; no se modificaron ni se contaron tareas del plan Paciente. Después se completó además la evidencia propia de CORR-08 en una rama independiente.

La regresión completa anterior al cambio H2 incluye las pruebas que aparecieron como rojas en logs históricos —aviso-de-demora, identity-verification y shell-layout— y pasó sin saltos: 7.376/7.376. La ejecución posterior al cambio H2 quedó incompleta por ENOSPC y está detallada arriba; no se borraron aserciones ni se ocultaron resultados.

## Avance parcial

### F1 — auditoría funcional y contratos

La matriz conserva el texto de la fuente y separa evidencia de frontend, API, persistencia y terceros. Se corrigió MED-06: la pantalla del perfil médico ya ofrece NIT (taxId) y razón social (taxHolderName), y el editor tiene pruebas de lectura/envío con dobles. Esos dos criterios quedan A MEDIAS / TESTED, no HECHO. Persisten 11 requisitos TODO de perfil fiscal, incluidos tipo societario, PDFs, domicilio legal/GPS y representante. MED-05 queda A MEDIAS / TESTED por la creación/listado de sedes y GPS con dobles; no se verificó persistencia real.

### F3 — producto frontend

Se publicó una corrección visual acotada con la ficha vigente CORR-08/TAREA-38 en PR borrador #612. El diálogo de edición de especialidad dejó de ofrecer «Certificada por el colegio o consejo» y el PATCH de edición dejó de enviar ese dato al cambiar sólo el concepto de especialidad. La inspección de la base halló que la tarjeta con pestañas ya existía; D-20 de la ficha externa registra por qué no se duplicó y deja MT-38-01 pendiente. La matriz visual tiene 8/8 celdas verdes antes y después, con fotos revisadas. Esta rama del plan no contiene código de producto, no se mergeó el PR y no cambió el estado de los 98 criterios end-to-end.

### F4 — integración médica

Una prueba de registro profesional pasó 8/8 en DB desechable tras cargar terminología sintética parcial. La integración API/PostgreSQL separada pasó 1/1 para diez credenciales con tipo/institución/PDF, resumen privado, ocultamiento público de `fileId`, descarga dueña 200, ajena 403 y reuso 422. El PATCH propio pasa 4/4. En Chromium real, un actor creó ocho credenciales en alta y tres especialidades; en el editor agregó un título DEGREE principal y dos SPECIALTY con PDFs, editó una credencial propia (PATCH 204), releyó diez —después once— registros tras cada recarga y descargó los tres PDFs agregados. El resumen de segundo actor queda vacío; su PATCH del UUID ajeno da 404 y el dueño conserva la fila. SQL verifica 11 filas/11 archivos únicos, cinco tipos y tres especialidades. MED-E01 sigue A MEDIAS por L0168/L0174.AC02; el plan completo queda en 10/98.

En agenda, FX-2 pasó 13/13 y FX-9 pasó 4/4 en PostgreSQL 18 efímero; las 21 suites de scheduling pasan 492/492. FX-9 confirmó con dos consultorios del mismo profesional que quitar el lock permitía dos citas concurrentes y dos filas; con el advisory lock transaccional queda una. Estos resultados no acreditan hospital público, vista semanal, búsqueda pública completa ni TOUS. La base canónica sigue sin inicializar porque el patch de aseguradoras exige 17 catálogos antes de que corra el seeder; Docker no responde.

### F5 — regresión y evidencia visual

Antes del último cambio H2, el typecheck, los 381 tests médicos dirigidos, los 81 tests del editor y la suite frontend completa de 7.376 pruebas pasaron. En esta última continuación pasaron 178 pruebas FE dirigidas, 140 API, ambos typechecks y ambos lints dirigidos; el intento de suite completa quedó incompleto por ENOSPC. La evidencia de CORR-08 pasó 8/8 medidas en cada fase. El lint global sigue fallando con 246 errores Angular ESLint; el lint dirigido de este cambio pasa. Route-health se había detenido en beforeAll porque la API requerida en localhost:3005 no estaba saludable; el verificador `scripts/atlas/fable-proof-check.py` no existe en esta base.

## Pendiente

| Trabajo | Estado | Qué lo destraba |
|---|---|---|
| H1–H8 / criterios incluidos | 10/98 HECHO; MED-E01 y H1–H8 no completos | Recorridos restantes, contratos aprobados y cierre de todas las aceptaciones/DoD |
| MED-06 fiscal | 2 criterios A MEDIAS; 11 TODO | Entidad y permisos en sus propietarios, adjuntos requeridos, dirección legal/GPS y verificación API→DB→recarga |
| MED-E01–E17 | Sin journey integral completo | API/DB desechables estables, contratos de terceros validados y actor siguiente disponible |
| F4 | Parcialmente bloqueado | Resolver init canónica con el dueño del modelo/DDL y recuperar Docker sin afectar servicios compartidos |
| F5 visual/E2E | Parcialmente bloqueado | API local saludable y verificador Fable disponible; CORR-08 ya tiene evidencia visual inspeccionada |
| F6 | A MEDIAS | Rama documental publicada en origin; PR visual #612 en borrador; sin merge ni deploy |

## Evidencia histórica y comandos

- Revisión inicial: corepack yarn typecheck exit 0; filtro médico amplio ejecutado antes del rebase, 54 archivos/804 aprobadas; corepack yarn lint exit 1 con 246 errores; carril-19 detenido en beforeAll por API no saludable.
- Revisión actual previa a CORR-08: typecheck exit 0; filtro médico específico 7 archivos/381 aprobadas; suite completa 583 archivos/7.375 aprobadas; lint exit 1 con 246 errores.
- Revisión visual CORR-08: `scripts/corr-evidencia.sh 38 --antes` y `scripts/corr-evidencia.sh 38`, 8 celdas cada una/0 rojas; fotos y reporte en `evidence/corr38`; PR #612 borrador; CORR-08 por sí sola no cierra criterios del plan Médico.
- Revisión posterior al cambio: `corepack yarn typecheck` exit 0; editor 81/81; suite Angular completa 583 archivos/7.376 aprobadas; eslint dirigido exit 0; lint global exit 1 con 246 errores; route-health bloqueado en beforeAll por API no disponible; comprobador Fable ausente.
- API anterior: 21 suites y 505 unitarias aprobadas; typecheck/lint API y checks OpenAPI aprobados; una integración aislada de registro profesional 8/8. En la rama de ejecución, profiles pasa 18/18 suites y 402/402; el alta con 10 adjuntos pasa 1/1, el PATCH 4/4, scheduling 21/21 suites/492 y FX-2/FX-9 13/13 y 4/4. Typecheck, ESLint dirigido, build y OpenAPI lint pasan en los cambios correspondientes.
- Frontend H1: el primer intento dirigido y typecheck fallaron antes de compilar porque el worktree limpio no tenía `src/environments/env.generated.ts`. Se creó un worktree temporal sin `.env`, se ejecutó `corepack yarn env:generate` (salida: `sin variables definidas (se usan los valores por defecto)`), luego las suites exactas editor/cliente pasaron 2/2 archivos y 127/127 pruebas y `corepack yarn typecheck` terminó exit 0. El worktree temporal se eliminó. No se leyó ni modificó el `.env` administrado.
- Lote de integración API anterior: 12 suites fallidas, 1 omitida y 1 aprobada; 90 fallidas, 8 omitidas y 26 aprobadas por ECONNREFUSED 127.0.0.1:55433. Docker dejó de responder.
- Suite completa API con heap de 6 GB: agotó heap sin resumen final.
- La inicialización SQL canónica falló porque el patch de aseguradoras esperaba 17 catálogos y recibió 0. Una copia temporal no canónica levantó 1260 tablas; no cuenta como init canónica.
- La carga parcial reportó 1369 conceptos y 7104 referencias huérfanas al omitir semillas de otros módulos.
- No se omitieron ni debilitaron pruebas. API y FE de ejecución están publicadas en las puntas `783d2697` y `df611861`; modelo/DDL, `.env`, `proxy.conf.json` y archivos del plan Paciente permanecen sin cambios.

## No cubierto y riesgos residuales

El flujo navegador→API→PostgreSQL→lectura/edición/recarga, descarga propia y bloqueo de edición ajena pasa para once credenciales sintéticas en cinco tipos. Siguen pendientes los requisitos de identidad/catálogo del H1, aislamiento integral de tenants, agenda pública completa y avisos, activación PAC, episodio clínico, teleconsulta, jobs de medicación y facturación real. También faltan contratos aprobados de SEGIP, TOUS, sala virtual, cobertura y lotes. No se simularon pagos ni se fabricaron contratos externos.

El `AGENTS.md` limita normalmente el trabajo del workspace a cambios visuales frontend; la instrucción posterior del propietario autorizó ejecutar el plan Médico completo y publicar su rama, por lo que esta continuación añadió el cambio API mínimo descrito arriba. Esa ampliación aplica a este plan y no elimina las restricciones globales para otros trabajos. La rama API está publicada; no se hizo merge ni despliegue y el plan clínico sigue incompleto.

## Reanudación del plan — 2026-09-24

El propietario volvió a pedir la ejecución completa y el push. La inspección de solo lectura encontró PostgreSQL temporal en 55439/55440, Angular en 4300/4302/4387 y SSR; los procesos desconocidos quedaron intactos. Más tarde se levantaron PostgreSQL 18, API y Angular propios en 55444/3000/4390 y se completó el recorrido documentado en `evidence/h1-real-api/REPORT.md`: 10 criterios pasan a HECHO; MED-E01/H1 siguen parciales.

### Continuación H1 — CI profesional obligatoria

La fuente L0169 marca el CI profesional como obligatorio y L0170 requiere su departamento emisor. La API ahora rechaza altas sin `nationalId` o `issuerAdministrativeAreaConceptId`, comprueba el concepto contra `VS_BO_DEPARTMENT` antes de cualquier escritura y persiste siempre el identificador. Se añadieron identidades sintéticas a los fixtures de integración; el caso sin CI del spec de departamento ahora espera HTTP 400.

Verificación en la rama API `justin/medical-module-execution-20260924`, commit `09af2caf`: `corepack yarn test --runInBand --no-cache src/modules/iam/dto/register-practitioner.dto.spec.ts src/modules/iam/services/iam-practitioner-self-registration.service.spec.ts` — 2 suites, 104/104 pruebas aprobadas; `corepack yarn typecheck` — exit 0; ESLint dirigido a los 30 TypeScript modificados — exit 0; `git diff --check` — exit 0. El test-first observó el defecto: el DTO aceptaba un alta sin CI.

No se corrió la integración contra base: `bootstrapTestApp()` usa `resetBusinessData()`, que trunca todos los esquemas de negocio, y no se confirmó una base desechable aislada. No se leyó `.env` ni se conectó a servicios compartidos. No se cambió el frontend en este incremento y no se declara cumplimiento persistente: L0169 sigue `A MEDIAS / TESTED`, MED-E01/H1 siguen parciales y el conteo global permanece en 10/98 `HECHO`.

### Auditoría L0168 — tercer nombre de pila

La lectura de `register-practitioner.html` y del editor médico confirmó campos visibles Primer, Segundo y Tercer nombre, además de campos dinámicos posteriores. El alta une lo posterior al primer nombre en `middleName`; `separarNombres` reconstruye las casillas del editor por espacios, con tests para nombres de una palabra. La API persiste y devuelve la cadena completa, pero no distingue espacios internos de nombres compuestos. El spec FE dirigido produjo 97 aprobadas y una falla `ENOSPC` en el test de tipos de credencial; las pruebas específicas de tercer nombre están incluidas en las aprobadas. L0168 continúa `A MEDIAS / TESTED` hasta un journey real de alta→API→PostgreSQL→recarga con las tres casillas; no se cambia DDL/modelo.

## Continuación H1 — correos personales y laborales separados

La FE ya enviaba correo de acceso/personal en `email` y correo laboral en `workEmail`, pero el DTO estricto de registro rechazaba este último. Además, el servicio trataba `email` como contacto WORK. El cambio publicado en FE `bd6e4690f62c4269dd9a65e8e5b955fe6e68a857` y API `70f1cfff66545c6ca77323fcd0eccb5cdd26eb44` admite y valida `workEmail`, persiste email de acceso/personal con `CONTACT_USE_HOME` y el dato laboral con `CONTACT_USE_WORK`. Si un cliente anterior omite `workEmail`, `email` continúa en WORK; `personalEmail` se mantiene compatible. El lector privado devuelve los contactos por uso y el editor prefiere `workEmail`, con `email` como respaldo para respuestas antiguas.

| Área | Verificación | Resultado | Límite |
|---|---|---|---|
| Editor de perfil médico FE | `corepack yarn test --watch=false --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts` | 1 archivo, 86/86 pruebas aprobadas, incluida preferencia por `workEmail` frente al alias `email` | Doble HTTP; no consulta una API real ni demuestra recarga persistida |
| Registro/API | `corepack yarn test --runInBand --no-cache src/modules/iam/dto/register-practitioner.dto.spec.ts src/modules/iam/services/iam-practitioner-self-registration.service.spec.ts` | 2 suites, 107/107 pruebas aprobadas; DTO valida `workEmail` y el servicio afirma los usos HOME/WORK; el caso anterior sin `workEmail` sigue cubierto | Pruebas unitarias; no se ejecutó PostgreSQL ni se releyó el perfil tras guardar |
| Lectura API | `corepack yarn test --runInBand --no-cache src/modules/profiles/services/profiles-practitioners.service.spec.ts` | 1 suite, 138/138; el perfil propio devuelve correos personales/laborales de acuerdo con HOME/WORK. Commit API publicado `924e8f03a53afc7c3cdb2dc7dbbf8107ba114b8b` | Dobles de repositorio; no prueba escritura/lectura real en DB |
| Calidad del cambio | `corepack yarn typecheck` y ESLint dirigido en FE/API; `git diff --check` | Exit 0 en ambos worktrees | No es una regresión global completa |
| Evidencia navegador/DB | No se ejecutó en esta continuación | No se generó foto ni journey FE→API→DB→recarga | El harness de integración invoca truncado de esquemas de negocio y no se confirmó aislamiento de una base disponible |

L0179 y L0186 quedan `A MEDIAS / TESTED`; MED-E03 sigue parcial porque la aceptación exige leer de nuevo el conjunto completo de datos personales, laborales y fiscales después de recarga. Los criterios HECHO no cambian: 10/98 incluidos.
