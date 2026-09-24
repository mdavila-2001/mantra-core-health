# Reporte de ejecución — módulo Médico

- Fecha: 2026-09-24 · Plan: PLAN.md · Rama: justin/medical-module-cierre
- Fuente funcional única: 02_METAPROMPT_MEDICO.md; copia congelada junto al plan en `sources/medical-metaprompt.md` (MetaPrompts) y SHA-256 verificado.
- SHA-256 de la fuente: b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656
- Base de código frontend: origin/mockup b11dfdd382dd787fab33d5894979ccc2c4d5a96a. Esta rama sigue siendo documental; la corrección visual acotada vive en `justin/mockup-corr-38-editar-perfil-medico-como-alta`, commit `55e948a4`, PR borrador #612 contra `mockup`.
- Peldaño máximo: `VERIFIED` para persistencia/lectura segura de credenciales y para excluir reservas concurrentes entre consultorios del mismo profesional; también pasó el alta real de dos credenciales desde navegador, su lectura/descarga como titular, un PATCH y su lectura tras recargar. No cubre el conjunto de posgrados del escenario. El plan Médico integral sigue en 0/98 criterios `HECHO` y no alcanza `REGRESSION_VERIFIED`.
- Avance integral: 0/98 criterios incluidos alcanzan DoD; la matriz conserva 100 criterios fuente, 98 incluidos y 2 OUT. Estados actuales: 70 A MEDIAS, 11 TODO, 17 BLOQUEADOS, 2 DESCARTADOS. CORR-08 aporta evidencia visual parcial, sin cambio en el conteo de criterios end-to-end.

## Verificado en esta continuación

| Área | Verificación | Resultado | Límite |
|---|---|---|---|
| Tipos frontend | corepack yarn typecheck | Exit 0 sobre la punta actual de mockup | No acredita integración ni comportamiento visual completo |
| Perfil, registro y sedes médicos | corepack yarn ng test --watch=false --filter='(RegisterPractitioner&#124;PractitionerProfile&#124;WorkHistory&#124;pestañas de la ficha del médico)' — 7 archivos, 381 pruebas aprobadas; solo suites de Médico con dobles, sin suites MyProfile de Paciente. | 7 archivos; 381 aprobadas | Dobles; sin API ni persistencia real |
| Regresión frontend completa | corepack yarn ng test --watch=false | 583 archivos; 7.376 pruebas aprobadas en la repetición posterior a CORR-08 | No reemplaza journeys API/UI/DB ni E2E |
| Lint | corepack yarn lint | Exit 1; 246 errores @angular-eslint/prefer-on-push-component-change-detection | Son errores repo-wide; no se ocultaron ni se debilitó ninguna prueba |
| Corrección visual CORR-08 | `scripts/corr-evidencia.sh 38 --antes` y `scripts/corr-evidencia.sh 38` | 8/8 celdas verdes en cada fase; capturas 375/768/1440 claro y 1440 oscuro; diálogo comparativo muestra selector antes y su ausencia después | Una ficha visual no acredita persistencia clínica ni cambia el estado del DoD médico |
| API — alta profesional aislada | integration/practitioner-registration.int-spec.ts, worktree API | 8/8 aprobadas en DB desechable con semillas parciales | No es init DDL canónica ni journey del módulo Médico |
| API — credenciales y adjuntos propios | rama `justin/medical-module-execution-20260924`, punta `783d2697`; PATCH de credencial propia y PDF por fila al alta | Profiles 18 suites/402 unitarias; PATCH PostgreSQL 4/4; alta PostgreSQL 1/1 con 10 credenciales (2 por tipo), tipo/institución y adjuntos leídos, resumen privado, ocultamiento público, descarga por dueño y reuso rechazado | El caso de diez credenciales usa otro actor que el smoke del navegador; falta recorrer varios posgrados en una misma alta real |
| Editor/cliente frontend de credenciales | `corepack yarn test --watch=false --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts --include=src/app/core/data-access/profiles/profiles.client.spec.ts`; `corepack yarn typecheck` | 2 archivos/127 pruebas aprobadas; typecheck exit 0 en worktree temporal limpio sin `.env` | El editor prueba PATCH con backend de prueba; no es una sesión de navegador contra la API real |
| Alta de credenciales en frontend | rama `justin/medical-module-execution-20260924`, commit `df611861`; PDFs por fila, orden secuencial y reintento parcial | 97 pruebas de componente, Playwright simulado 4/4; typecheck, ESLint dirigido y build exit 0; además smoke real 4/4 con dos PDFs y alta 201 | El smoke real no verifica varios posgrados, lectura/edición/recarga ni descarga desde la cuenta creada |
| Alta médica en navegador contra API real | Chromium con configuración `real-api`, API en puerto local vía proxy de mismo origen y PostgreSQL 18 desechable; captura en `evidence/h1-real-api/` | Playwright 4/4; dos PDF subidos (201, 201), alta (201), login (200), resumen propio (200), dos descargas del titular (200 con firma `%PDF-1.4`), PATCH (204) y lectura del cambio luego de recargar (200). SQL confirma dos filas y dos fileId distintos para el perfil probado | Ese actor solo recorrió dos títulos universitarios; faltan varios posgrados/especialidades y las verificaciones públicas/no propietarias dentro del mismo journey |
| Agenda médica y concurrencia | FX-2/FX-9 en PostgreSQL 18 efímero; lock transaccional por profesional | scheduling 21 suites/492 unitarias; FX-2 13/13; FX-9 4/4; typecheck y ESLint dirigidos exit 0. Sin lock, dos citas simultáneas en consultorios distintos; con lock, queda una | No acredita hospital público, grilla semanal, agenda pública completa ni notificación externa |

El primer filtro amplio de 229 pruebas se descartó porque también seleccionó suites MyProfile compartidas con Paciente. El resultado válido para Médico es el filtro preciso de 381 pruebas indicado arriba; no se modificaron ni se contaron tareas del plan Paciente. Después se completó además la evidencia propia de CORR-08 en una rama independiente.

La regresión completa más reciente del frontend incluye las pruebas que aparecieron como rojas en logs históricos —aviso-de-demora, identity-verification y shell-layout— y pasa sin saltos: 7.376/7.376. Las nuevas pruebas de agenda y credenciales API también pasan; no se borraron aserciones ni se ocultaron resultados.

## Avance parcial

### F1 — auditoría funcional y contratos

La matriz conserva el texto de la fuente y separa evidencia de frontend, API, persistencia y terceros. Se corrigió MED-06: la pantalla del perfil médico ya ofrece NIT (taxId) y razón social (taxHolderName), y el editor tiene pruebas de lectura/envío con dobles. Esos dos criterios quedan A MEDIAS / TESTED, no HECHO. Persisten 11 requisitos TODO de perfil fiscal, incluidos tipo societario, PDFs, domicilio legal/GPS y representante. MED-05 queda A MEDIAS / TESTED por la creación/listado de sedes y GPS con dobles; no se verificó persistencia real.

### F3 — producto frontend

Se publicó una corrección visual acotada con la ficha vigente CORR-08/TAREA-38 en PR borrador #612. El diálogo de edición de especialidad dejó de ofrecer «Certificada por el colegio o consejo» y el PATCH de edición dejó de enviar ese dato al cambiar sólo el concepto de especialidad. La inspección de la base halló que la tarjeta con pestañas ya existía; D-20 de la ficha externa registra por qué no se duplicó y deja MT-38-01 pendiente. La matriz visual tiene 8/8 celdas verdes antes y después, con fotos revisadas. Esta rama del plan no contiene código de producto, no se mergeó el PR y no cambió el estado de los 98 criterios end-to-end.

### F4 — integración médica

Una prueba de registro profesional pasó 8/8 en DB desechable después de cargar terminología sintética parcial. La integración PostgreSQL del alta de credenciales pasó 1/1: guardó diez entradas (dos títulos universitarios y dos de cada tipo de posgrado), sus tipos, instituciones y PDFs distintos; el resumen privado las relee, el público omite `fileId`, sólo el dueño descarga y el reuso se rechaza sin cuenta parcial. El PATCH propio pasa 4/4 e incluye lectura posterior, controles de propiedad, mass assignment y lock real. Un Playwright compuesto adicional, con mocks apagados, creó el médico con dos títulos y PDFs; luego inició sesión, leyó los dos registros, descargó ambos PDFs como titular, editó una credencial, recargó la página y volvió a leer el cambio. Una consulta PostgreSQL confirmó dos filas y dos `fileId` distintos para ese perfil. La lectura/escritura integral pasa para esos dos títulos; falta recorrer todos los posgrados y especialidades del criterio en la misma cuenta.

En agenda, FX-2 pasó 13/13 y FX-9 pasó 4/4 en PostgreSQL 18 efímero; las 21 suites de scheduling pasan 492/492. FX-9 confirmó con dos consultorios del mismo profesional que quitar el lock permitía dos citas concurrentes y dos filas; con el advisory lock transaccional queda una. Estos resultados no acreditan hospital público, vista semanal, búsqueda pública completa ni TOUS. La base canónica sigue sin inicializar porque el patch de aseguradoras exige 17 catálogos antes de que corra el seeder; Docker no responde.

### F5 — regresión y evidencia visual

El typecheck, los 381 tests médicos dirigidos, los 81 tests del editor y la suite frontend completa de 7.376 pruebas pasan. La evidencia de CORR-08 pasó 8/8 medidas en cada fase. El lint sigue fallando con 246 errores Angular ESLint; el lint dirigido a los archivos cambiados de CORR-08 pasa. Route-health se volvió a ejecutar y se detuvo en beforeAll porque la API requerida en localhost:3005 no estaba saludable; el verificador `scripts/atlas/fable-proof-check.py` no existe en esta base.

## Pendiente

| Trabajo | Estado | Qué lo destraba |
|---|---|---|
| H1–H8 / criterios incluidos | 0/98 HECHO | Recorridos integrales de navegador con servicios reales, contratos aprobados y cierre por aceptación/DoD |
| MED-06 fiscal | 2 criterios A MEDIAS; 11 TODO | Entidad y permisos en sus propietarios, adjuntos requeridos, dirección legal/GPS y verificación API→DB→recarga |
| MED-E01–E17 | Sin journey integral completo | API/DB desechables estables, contratos de terceros validados y actor siguiente disponible |
| F4 | Parcialmente bloqueado | Resolver init canónica con el dueño del modelo/DDL y recuperar Docker sin afectar servicios compartidos |
| F5 visual/E2E | Parcialmente bloqueado | API local saludable y verificador Fable disponible; CORR-08 ya tiene evidencia visual inspeccionada |
| F6 | A MEDIAS | Rama documental publicada en origin; PR visual #612 en borrador; sin merge ni deploy |

## Evidencia histórica y comandos

- Revisión inicial: corepack yarn typecheck exit 0; filtro médico amplio ejecutado antes del rebase, 54 archivos/804 aprobadas; corepack yarn lint exit 1 con 246 errores; carril-19 detenido en beforeAll por API no saludable.
- Revisión actual previa a CORR-08: typecheck exit 0; filtro médico específico 7 archivos/381 aprobadas; suite completa 583 archivos/7.375 aprobadas; lint exit 1 con 246 errores.
- Revisión visual CORR-08: `scripts/corr-evidencia.sh 38 --antes` y `scripts/corr-evidencia.sh 38`, 8 celdas cada una/0 rojas; fotos y reporte en `evidence/corr38`; PR #612 borrador, 0 criterios médicos cerrados.
- Revisión posterior al cambio: `corepack yarn typecheck` exit 0; editor 81/81; suite Angular completa 583 archivos/7.376 aprobadas; eslint dirigido exit 0; lint global exit 1 con 246 errores; route-health bloqueado en beforeAll por API no disponible; comprobador Fable ausente.
- API anterior: 21 suites y 505 unitarias aprobadas; typecheck/lint API y checks OpenAPI aprobados; una integración aislada de registro profesional 8/8. En la rama de ejecución, profiles pasa 18/18 suites y 402/402; el alta con 10 adjuntos pasa 1/1, el PATCH 4/4, scheduling 21/21 suites/492 y FX-2/FX-9 13/13 y 4/4. Typecheck, ESLint dirigido, build y OpenAPI lint pasan en los cambios correspondientes.
- Frontend H1: el primer intento dirigido y typecheck fallaron antes de compilar porque el worktree limpio no tenía `src/environments/env.generated.ts`. Se creó un worktree temporal sin `.env`, se ejecutó `corepack yarn env:generate` (salida: `sin variables definidas (se usan los valores por defecto)`), luego las suites exactas editor/cliente pasaron 2/2 archivos y 127/127 pruebas y `corepack yarn typecheck` terminó exit 0. El worktree temporal se eliminó. No se leyó ni modificó el `.env` administrado.
- Lote de integración API anterior: 12 suites fallidas, 1 omitida y 1 aprobada; 90 fallidas, 8 omitidas y 26 aprobadas por ECONNREFUSED 127.0.0.1:55433. Docker dejó de responder.
- Suite completa API con heap de 6 GB: agotó heap sin resumen final.
- La inicialización SQL canónica falló porque el patch de aseguradoras esperaba 17 catálogos y recibió 0. Una copia temporal no canónica levantó 1260 tablas; no cuenta como init canónica.
- La carga parcial reportó 1369 conceptos y 7104 referencias huérfanas al omitir semillas de otros módulos.
- No se omitieron ni debilitaron pruebas. API y FE de ejecución están publicadas en las puntas `783d2697` y `df611861`; modelo/DDL, `.env`, `proxy.conf.json` y archivos del plan Paciente permanecen sin cambios.

## No cubierto y riesgos residuales

El flujo navegador→API→PostgreSQL→lectura/edición/recarga y descarga pasa para dos credenciales universitarias sintéticas. Sigue pendiente probar en esa misma cuenta varios posgrados y especialidades y los lectores ajenos/públicos. También siguen pendientes el aislamiento integral de tenants; agenda con reinicio/deduplicación; activación PAC; episodio clínico completo; teleconsulta con proveedor; jobs persistentes de medicación; emisión, entrega y periodicidad fiscal; y MED-E01–E17 como journeys end-to-end completos. Persisten contratos pendientes de SEGIP, avisos/TOUS, sala virtual, cobertura y lotes de aseguradora. No se simularon pagos ni se fabricaron contratos externos.

El `AGENTS.md` limita normalmente el trabajo del workspace a cambios visuales frontend; la instrucción posterior del propietario autorizó ejecutar el plan Médico completo y publicar su rama, por lo que esta continuación añadió el cambio API mínimo descrito arriba. Esa ampliación aplica a este plan y no elimina las restricciones globales para otros trabajos. La rama API está publicada; no se hizo merge ni despliegue y el plan clínico sigue incompleto.

## Reanudación del plan — 2026-09-24

El propietario volvió a pedir la ejecución completa y el push. La inspección de solo lectura encontró PostgreSQL temporal escuchando en 55439/55440, servidores Angular en 4300/4302/4387 y un runtime Node SSR (`dist/mantra-core-health/server/server.mjs`); el propietario de esos procesos y el contenido de las bases no se pudieron confirmar. Se dejaron intactos: no hubo conexión, escritura, reinicio ni detención. Por eso no se repitió ni amplió el journey navegador→API→DB. Los estados de matriz y las limitaciones ya publicadas siguen vigentes; no hubo cambio de producto en este tramo.
