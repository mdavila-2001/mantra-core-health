# Reporte de ejecución — módulo Médico

- Fecha: 2026-09-24 · Plan: PLAN.md · Rama: justin/medical-module-cierre
- Fuente funcional única: 02_METAPROMPT_MEDICO.md; copia congelada junto al plan en `sources/medical-metaprompt.md` (MetaPrompts) y SHA-256 verificado.
- SHA-256 de la fuente: b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656
- Base de código frontend: origin/mockup b11dfdd382dd787fab33d5894979ccc2c4d5a96a. Esta rama sigue siendo documental; la corrección visual acotada vive en `justin/mockup-corr-38-editar-perfil-medico-como-alta`, commit `55e948a4`, PR borrador #612 contra `mockup`.
- Peldaño máximo: `VERIFIED` para el PATCH API de una credencial propia pendiente, ejercitado por HTTP y leído de PostgreSQL; el plan médico integral sigue en 0/98 criterios `HECHO` y no alcanza `REGRESSION_VERIFIED`.
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
| API — edición de credencial propia | `justin/medical-module-execution-20260924`, commit `ddd5ea1a`; `PATCH /profiles/practitioners/me/credentials/:credentialId` | 18 suites profiles/402 unitarias, typecheck, ESLint dirigido, build y OpenAPI lint exit 0; PostgreSQL 18 efímero: integración HTTP 4/4 | Prueba una credencial pendiente, su lectura posterior, mass assignment, ID ajeno/sin sesión y lock real; no prueba pluralidad, archivos ni el navegador conectado a la API |
| Editor/cliente frontend de credenciales | `corepack yarn test --watch=false --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts --include=src/app/core/data-access/profiles/profiles.client.spec.ts`; `corepack yarn typecheck` | 2 archivos/127 pruebas aprobadas; typecheck exit 0 en worktree temporal limpio sin `.env` | El editor prueba PATCH con backend de prueba; no es una sesión de navegador contra la API real |

El primer filtro amplio de 229 pruebas se descartó porque también seleccionó suites MyProfile compartidas con Paciente. El resultado válido para Médico es el filtro preciso de 381 pruebas indicado arriba; no se modificaron ni se contaron tareas del plan Paciente. Después se completó además la evidencia propia de CORR-08 en una rama independiente.

La regresión completa más reciente incluye las pruebas que aparecieron como rojas en logs históricos —aviso-de-demora, identity-verification y shell-layout— y pasa sin saltos: 7.376/7.376. Se conservan los logs de la base anterior; no se borraron aserciones ni se ocultaron resultados.

## Avance parcial

### F1 — auditoría funcional y contratos

La matriz conserva el texto de la fuente y separa evidencia de frontend, API, persistencia y terceros. Se corrigió MED-06: la pantalla del perfil médico ya ofrece NIT (taxId) y razón social (taxHolderName), y el editor tiene pruebas de lectura/envío con dobles. Esos dos criterios quedan A MEDIAS / TESTED, no HECHO. Persisten 11 requisitos TODO de perfil fiscal, incluidos tipo societario, PDFs, domicilio legal/GPS y representante. MED-05 queda A MEDIAS / TESTED por la creación/listado de sedes y GPS con dobles; no se verificó persistencia real.

### F3 — producto frontend

Se publicó una corrección visual acotada con la ficha vigente CORR-08/TAREA-38 en PR borrador #612. El diálogo de edición de especialidad dejó de ofrecer «Certificada por el colegio o consejo» y el PATCH de edición dejó de enviar ese dato al cambiar sólo el concepto de especialidad. La inspección de la base halló que la tarjeta con pestañas ya existía; D-20 de la ficha externa registra por qué no se duplicó y deja MT-38-01 pendiente. La matriz visual tiene 8/8 celdas verdes antes y después, con fotos revisadas. Esta rama del plan no contiene código de producto, no se mergeó el PR y no cambió el estado de los 98 criterios end-to-end.

### F4 — integración médica

Una prueba de registro profesional pasó 8/8 en DB desechable después de cargar terminología sintética parcial. En la continuación autorizada se añadió PATCH de edición de credenciales propias pendientes y una prueba HTTP PostgreSQL real pasó 4/4: la actualización persistió y se leyó por otra llamada HTTP; se negaron mass assignment, acceso ajeno y falta de sesión, y se observó la espera del bloqueo real. La UI existente ya envía el PATCH y sus specs dirigidos pasan 127/127, pero esos specs usan backend de prueba. No se completó el journey navegador→API→persistencia→recarga→segundo actor ni la aceptación de múltiples carreras/documentos. La base canónica sigue sin inicializar porque el patch de aseguradoras exige 17 catálogos antes de que corra el seeder; Docker no responde.

### F5 — regresión y evidencia visual

El typecheck, los 381 tests médicos dirigidos, los 81 tests del editor y la suite frontend completa de 7.376 pruebas pasan. La evidencia de CORR-08 pasó 8/8 medidas en cada fase. El lint sigue fallando con 246 errores Angular ESLint; el lint dirigido a los archivos cambiados de CORR-08 pasa. Route-health se volvió a ejecutar y se detuvo en beforeAll porque la API requerida en localhost:3005 no estaba saludable; el verificador `scripts/atlas/fable-proof-check.py` no existe en esta base.

## Pendiente

| Trabajo | Estado | Qué lo destraba |
|---|---|---|
| H1–H8 / criterios incluidos | 0/98 HECHO | Implementación dentro del alcance permitido, contratos aprobados y cierre por aceptación/DoD |
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
- API anterior: 21 suites y 505 unitarias aprobadas; typecheck/lint API y checks OpenAPI aprobados; una integración aislada de registro profesional 8/8. En la rama nueva, la suite profiles pasa 18/18 suites y 402/402, typecheck/lint/build/OpenAPI lint pasan, y el PATCH propio pasa 4/4 contra PostgreSQL 18 temporal.
- Frontend H1: el primer intento dirigido y typecheck fallaron antes de compilar porque el worktree limpio no tenía `src/environments/env.generated.ts`. Se creó un worktree temporal sin `.env`, se ejecutó `corepack yarn env:generate` (salida: `sin variables definidas (se usan los valores por defecto)`), luego las suites exactas editor/cliente pasaron 2/2 archivos y 127/127 pruebas y `corepack yarn typecheck` terminó exit 0. El worktree temporal se eliminó. No se leyó ni modificó el `.env` administrado.
- Lote de integración API anterior: 12 suites fallidas, 1 omitida y 1 aprobada; 90 fallidas, 8 omitidas y 26 aprobadas por ECONNREFUSED 127.0.0.1:55433. Docker dejó de responder.
- Suite completa API con heap de 6 GB: agotó heap sin resumen final.
- La inicialización SQL canónica falló porque el patch de aseguradoras esperaba 17 catálogos y recibió 0. Una copia temporal no canónica levantó 1260 tablas; no cuenta como init canónica.
- La carga parcial reportó 1369 conceptos y 7104 referencias huérfanas al omitir semillas de otros módulos.
- No se omitieron ni debilitaron pruebas. La rama API de ejecución sí actualizó OpenAPI para su PATCH; modelo/DDL, `.env`, `proxy.conf.json` y archivos del plan Paciente permanecen sin cambios.

## No cubierto y riesgos residuales

No se ejecutó el flujo completo de alta/edición; el aislamiento de tenants; agenda con reinicio/deduplicación; activación PAC; episodio clínico completo; teleconsulta con proveedor; jobs persistentes de medicación; emisión, entrega y periodicidad fiscal; ni MED-E01–E17 como journeys end-to-end. Siguen pendientes contratos de SEGIP, avisos/TOUS, sala virtual, cobertura y lotes de aseguradora. No se simularon pagos ni se fabricaron contratos externos.

El `AGENTS.md` limita normalmente el trabajo del workspace a cambios visuales frontend; la instrucción posterior del propietario autorizó ejecutar el plan Médico completo y publicar su rama, por lo que esta continuación añadió el cambio API mínimo descrito arriba. Esa ampliación aplica a este plan y no elimina las restricciones globales para otros trabajos. La rama API está publicada; no se hizo merge ni despliegue y el plan clínico sigue incompleto.
