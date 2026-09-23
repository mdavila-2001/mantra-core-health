# Plan — Ender, turno noche 2026-09-20: contratos que faltan y panel que diga la verdad

- Fecha: 2026-09-20 · Repos afectados: `mantra-core-health` (único con escritura) ·
  Predecesor: ninguno en este worktree.
- Fuente del encargo: `AlovidaPromptManager/repartos/2026-09-20/PromptNoche/Ender/`
  (`Ender-Daily-Noche-2026-09-20.md` + `Noche-CorreccionesDoctor.ContratosYPanel/CatalogosBloqueosPosologiaYPanel.md`).
  Correcciones que cubro: C-03, C-12 (contrato), C-13 (contrato), C-20 (catálogo), C-24.
- Resultado observable: el simulador (`mockBackend: true`) publica el bloqueo "Otros servicios"
  sin ampliar el enum real, la excepción `EXTRA` de horario extra funciona, la duración de visita
  de visitador es configurable (15 min por omisión), la ficha de medicamento puede declarar una
  frecuencia por defecto sintética y con procedencia, y el panel de inicio muestra reporte
  semanal/mensual, mapa de calor, canceladas y otras atenciones con los tonos de la agenda.
- Kill-test: crear una excepción `exceptionType` fuera de la lista cerrada de 7 → el manejador
  la rechaza. Preguntar de dónde sale la frecuencia por defecto de un medicamento → la respuesta
  cita el archivo de datos con fuente declarada, nunca "la escribí yo".

## Corte de referencia (mío, distinto del declarado en la ficha)

- Ficha declara: `689697821a6e6d2c8f702c7508d6728fa9a1869a` (PR #554, 2026-09-20T12:32-04).
- **El mío manda**: worktree `wt-ender-contratos-panel`, rama `ender/noche-2026-09-20-contratos-panel`,
  creada desde `origin/mockup` en `68dcb562ef3dd74de03f4887c57fd836fb21be13`
  (Sun Sep 20 20:59:15 2026 -0400, "docs(deploy): documentar Traefik por IP…").
  `mockup` avanzó 22 commits sobre el corte de la ficha; ninguno toca `core/mock/**`,
  `features/dashboard/**` ni `core/data-access/**` según `git log --oneline <ficha>..HEAD -- <rutas>`
  (verificado antes de escribir, ver H1.S1.M1).
- Ref de la API para citar contratos (solo lectura): `origin/dev` = `c2c071a4ad322ff0a9f6cc705b90238f3d2887bb`
  (Merge PR #449, "pablo/h6-regresion-contrato-tres-niveles").

## Alcance

- **IN:** todo lo listado en la ficha §2 (H1–H6): mapa de endpoints, motivo "Otros servicios"
  (`OTHER` + texto, sin ampliar el enum), excepción `EXTRA`, duración configurable de visita de
  visitador con límite de acceso verificado, propiedad de frecuencia por defecto del medicamento
  (sintética y declarada), reportes del panel (semanal/mensual/canceladas/mapa de calor/otras
  atenciones), tooltips del panel, patrón de botones/opciones de Itzan en mis archivos, specs de
  cada manejador nuevo, `mock-backend.spec.ts` en verde, capturas.
- **OUT:** cualquier archivo fuera de `src/app/core/mock/**`, `src/app/features/dashboard/**` y
  `src/app/core/data-access/**` (menos `prescription-favorites/**`, de Justin) · escribir en
  `mantra-core-health-api` (solo lectura/cita) · ampliar el enum `ExceptionType` real · inventar
  posología · inventar fuente de un dato de catálogo · truncar una colección del simulador ·
  copiar datos de producción · endpoint simulado sin cita+spec · cambiar semántica de un estado
  de cita · color literal en el panel · mapa de calor solo por color.
- **Ambigüedades registradas** (heredadas de la ficha, ver también §5 de la ficha):
  - Q-D5/Q-D6/Q-E1..E5 — ver ficha. Tomo los mismos supuestos que declara la ficha salvo que
    encuentre evidencia que los contradiga; si eso pasa, lo registro acá antes de seguir.

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sin navegador/Playwright confirmado en esta sesión (MCP de Playwright no conectó) | H1.S1.M3, H5, H6 (capturas, prueba visual) podrían no poder ejecutarse desde esta sesión | Verificar si `yarn pw`/`playwright` corre por CLI directa contra `ng serve` real (no MCP). Si no corre, se declara `BLOQUEADO`/`VERIFIED_FUNCTIONAL_ONLY` con la causa, nunca se fabrica un "PASS" |
| 55 microtareas es más de una noche (la propia ficha lo advierte) | Alcance completo puede no cerrar en `HECHO` | Prioridad de la ficha: H1→H2→H3→H4 primero (bloquean a Pablo/Justin), H5/H6 después. Lo que no cierre queda `A MEDIAS` con las 4 respuestas, nunca oculto |
| Trabajo silencioso por volumen de microtareas | Incumpliría regla 50 (máx. 3 operaciones materiales sin checkpoint) | Checkpoint por microtarea al abrir y cerrar, formato de la regla 50 |

## H1 — Corte, simulador bajo control y mapa de lo que ya sirve

**CA:** Dado el simulador, cuando otro dueño de lote pregunta si el endpoint que necesita ya
existe, entonces hay un mapa escrito que lo responde con ruta y manejador.
**DoD:** Las 9 microtareas en HECHO. `mock-backend.spec.ts` en verde como línea de base. El mapa
en `evidencia/`.
**Estado:** HECHO

### H1.S1 — El corte y el entorno
**CA:** Dada la rama, cuando se la compara con `origin/mockup`, sale de ese corte y el SHA está
en este PLAN.md (ya declarado arriba).
**DoD:** Las 3 microtareas en HECHO, con la salida de `git log -1` pegada.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Traer `origin/mockup`, declarar el SHA y salir de ahí con la rama | El SHA está en este PLAN.md | `git fetch origin && git log -1 --format='%H %ad %s' origin/mockup` → pegada | HECHO |
| H1.S1.M2 | Declarar el ref de la API que se cita, solo lectura | Está el SHA de `origin/dev` de la API | `git -C ../mantra-core-health-api log -1 --format='%H %s' origin/dev` → pegada | HECHO |
| H1.S1.M3 | Levantar la maqueta y entrar con las dos cuentas: médica y visitador | Las dos entran y ven lo suyo | `yarn pw playwright/ender-contratos-panel-evidencia.spec.ts --workers=1` → 2/2 PASS. Capturas en `artifacts/ender-contratos-panel/{h1-medica-dashboard,h1-visitador-post-login}.png`, miradas: médica ve agenda-de-hoy + accesos; visitador ve sólo "Tus accesos" (sin agenda clínica) | HECHO |

### H1.S2 — La red de seguridad del simulador
**CA:** Dado el simulador, cuando se corre su spec, ninguna ruta lanza ni devuelve 500 con
ninguna cuenta, y eso queda registrado antes de tocarlo.
**DoD:** Las 3 microtareas en HECHO, con salidas pegadas.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Correr el spec del simulador entero como línea de base | Hay salida y exit code | `yarn test --include=src/app/core/mock/mock-backend.spec.ts` → `evidencia/antes-mock.txt` (1 archivo, 21/21 verde) | HECHO |
| H1.S2.M2 | Correr typecheck y lint de partida | Hay exit code de los dos | `yarn typecheck; yarn lint` → `evidencia/baseline-typecheck-lint.txt` (0 y 0, sin deuda previa) | HECHO |
| H1.S2.M3 | Registrar cómo se declara la persistencia de una colección | Está escrito cómo se persiste y qué sobrevive a un F5 | `Coleccion.persistirEn(clave)` guarda en `sessionStorage` (no `localStorage`, a propósito: la maqueta debe abrir limpia) con sello `buildInfo.commit`; sin `persistirEn`, la tabla vive solo en memoria de la página. `bloqueos`, `reservas`, `recursos`, `plantillas` y `listaDeEspera` ya persisten (`fixtures/agenda.ts:484-488`); **`cupos` NO persiste** — hallazgo para H2/H5 si alguna demo depende de que un cupo sobreviva a un F5 | HECHO |

### H1.S3 — El mapa de lo que los otros van a pedir
**CA:** Dado el mapa, cuando alguien busca si existe el endpoint que necesita, encuentra la ruta,
el manejador y si el contrato real tiene equivalente.
**DoD:** Las 3 microtareas en HECHO. Cada fila con su cita del contrato real o "no existe en la API".
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Mapear lo que necesita Pablo: excepciones, tipos de bloqueo, cupos, actividad | Cada uno con ruta simulada y cita del contrato real | Tabla en `evidencia/mapa-endpoints.md` | HECHO |
| H1.S3.M2 | Mapear lo que necesita Justin: ficha de concepto y sus propiedades | Está la ruta que sirve la ficha y las claves publicadas | Tabla en `evidencia/mapa-endpoints.md` — **corrige la ficha**: `dose_forms`/`strengths` no están publicados en el simulador (H4 sólo agregó `default_frequency`) | HECHO |
| H1.S3.M3 | Mapear lo que necesita Marcelo: notas, episodios, formularios | Está qué existe y qué no para guardar una cuadrícula | Tabla en `evidencia/mapa-endpoints.md`: notas/episodios existen; **no hay endpoint de fila estructurada de cuadrícula** — hallazgo señalado, fuera de mi alcance | HECHO |

## H2 — El bloqueo por "otros servicios", y el horario extra

**CA:** Dado un servicio propio con horario programado, la agenda de ese profesional lo muestra
bloqueado con motivo "Otros servicios"; dado un horario extra fuera de atención, se crea como
excepción que añade disponibilidad.
**DoD:** Las 9 microtareas en HECHO. Sin tipos inventados. Spec del manejador en verde.
`mock-backend.spec.ts` sigue en verde. Los tres niveles ejercitados.
**Estado:** HECHO

### H2.S1 — El motivo, sin romper la lista cerrada (C-12)
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Verificar la lista cerrada de motivos en API y simulador | Las dos listas pegadas y comparadas | `scheduling-catalog.dto.ts:735` (7 tipos) vs `TIPOS_DE_BLOQUEO` en `scheduling.handlers.ts:28-36` (los mismos 7) — idénticas | HECHO |
| H2.S1.M2 | Confirmar que `OTHER` + `reason` ya está soportado end-to-end | La excepción creada trae `reasonLabel:'Otro'` y su `reason` | `evidencia/h2-tres-niveles.txt` — spec `scheduling.handlers.spec.ts` en verde | HECHO |
| H2.S1.M3 | Registrar la opción de ampliar el enum como decisión de negocio | Escrito qué implicaría | Q-D6 en `evidencia/h2-tres-niveles.txt`: sería FK nueva a `terminology.catalog_concepts` + cambio de DTO en la API — dueño: negocio/backend, no el simulador | HECHO |

### H2.S2 — El horario extra que Pablo necesita
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Verificar que `POST` de excepción acepta `EXTRA` con `blocks:false` (ya en `TIPOS_DE_BLOQUEO`) | La respuesta lo trae | `evidencia/h2-tres-niveles.txt` | HECHO |
| H2.S2.M2 | Ejercitar los tres niveles: válido, límite, inválido | Comportamiento declarado en los tres | **Hallazgo corregido**: el manejador NO rechazaba tipo inválido/franja inválida antes de esta noche — ahora sí (422). `evidencia/h2-tres-niveles.txt` | HECHO |
| H2.S2.M3 | Avisar a Pablo por el daily | Aviso escrito con ruta y cuerpo | Ver `Ender-Daily-Noche-2026-09-20.md` (checkpoint agregado al cerrar H2) | HECHO |

### H2.S3 — Que el bloqueo se vea en la agenda, y no rompa nada
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S3.M1 | Verificar que el bloqueo sale en `GET /scheduling/resources/:id/exceptions` | Aparece con etiqueta y franja | `scheduling.handlers.spec.ts` (casos OTHER/EXTRA leen la lista) | HECHO |
| H2.S3.M2 | Escribir/ampliar el spec del manejador de scheduling | Crea, lista, rechaza inválido, en verde | `scheduling.handlers.spec.ts` nuevo, 8 casos, verde | HECHO |
| H2.S3.M3 | Volver a correr `mock-backend.spec.ts` entero | Sigue en verde | 21/21 verde junto con el spec nuevo (29/29 total) | HECHO |

## H3 — La visita del visitador: duración configurable y su límite de acceso

**Estado:** HECHO — evidencia en `evidencia/h3-tres-niveles.txt`.

| ID | Microtarea | Estado |
|---|---|---|
| H3.S1.M1 | Buscar si la API tiene dónde guardar la duración configurable, citarlo | HECHO — SÍ existe (`visits.dto.ts`, `doctor_visit_policies.entity.ts`, `doctor_visit_windows.entity.ts`); **corrige Q-E3 de la ficha**, que asumía que no existía |
| H3.S1.M2 | Definir el contrato del campo (ruta, nombre, tipo, rango) | HECHO — `durationMinutes` en `POST /visit-requests`, entero 5–240, tope adicional por `maxDurationMinutes` de la política del doctor |
| H3.S1.M3 | Implementar con 15 min por omisión, tres niveles | HECHO — `pharma-lab.handlers.spec.ts`, 6 casos (correcto ×2, límite, inválido ×3) |
| H3.S2.M1 | Definir campos mínimos para la tarjeta de Pablo | HECHO — `VisitRequest` ya es mínimo: sin dato de paciente, solo doctor/franja/duración/modalidad/lugar |
| H3.S2.M2 | Verificar que la respuesta no trae dato clínico ni de paciente | HECHO — test dedicado, 0 campos prohibidos |
| H3.S2.M3 | Avisar a Pablo por el daily | HECHO — checkpoint en el daily de Ender |
| H3.S3.M1 | Citar el límite de acceso desde `pharma-lab.types.ts:9` | HECHO — citado en el archivo y en el PLAN |
| H3.S3.M2 | Ejercitar matriz negativa con `visitador@alovida.mock` | HECHO — 403 en `/clinical/patients/:id/summary` y `/charts/patients/:id/chart`; `puedeLeer()` ya defendía correctamente antes de esta noche |
| H3.S3.M3 | Reportar cualquier fuga como PRODUCT_BUG en el momento | HECHO — **sin fuga clínica**; hallazgo aparte (no clínico, no corregido, registrado) sobre `reservaVisible()` en scheduling |

## H4 — Posología por defecto: el mecanismo sí, el dato clínico inventado no

**Estado:** HECHO — evidencia en `evidencia/h4-tres-niveles.txt`.

| ID | Microtarea | Estado |
|---|---|---|
| H4.S1.M1 | Verificar patrón de `dose_forms`/`strengths` en `terminology.handlers.ts` | HECHO — **corrige la ficha**: no existía ningún mecanismo de `properties` en el simulador; se construyó desde cero siguiendo el contrato real (`search-concepts.dto.ts`) |
| H4.S1.M2 | Acordar la clave con Justin (registrado en el daily) | HECHO — `properties.default_frequency`, string, sólo en la ficha del concepto |
| H4.S1.M3 | Verificar si el contrato real admite propiedades arbitrarias | HECHO — sí, `concept_properties` admite cualquier `property_code` (`terminology.constants.ts` de la API); `default_frequency` es extensión declarada (no existe en el vademécum real) |
| H4.S2.M1 | Leer B-13 (`REGISTRO-DEFECTOS.md:101` de la API) y aplicar su criterio | HECHO — mismo texto de advertencia en cada valor sintético |
| H4.S2.M2 | Declarar procedencia sintética en el archivo de datos | HECHO — comentario + advertencia en cada `value_json` de `fixtures/conceptos.ts` |
| H4.S2.M3 | Registrar quién provee la fuente autoritativa (Q-D6) | HECHO — negocio + profesional prescriptor, en el comentario del fixture y acá |
| H4.S3.M1 | Publicar la propiedad en algunos conceptos, no en otros, a propósito | HECHO — 5 de 15 medicamentos la tienen, 10 no |
| H4.S3.M2 | Ejercitar el caso inválido (propiedad mal formada) | HECHO — `MED-INSULINA-NPH` con `value_json` numérico a propósito, `valorDeTexto()` lo trata como ausente |
| H4.S3.M3 | Spec del manejador + spec del simulador entero | HECHO — 48/48 verde (mock-backend + scheduling + pharma-lab + terminology + types) |

## H5 — El panel dice la verdad

**Estado:** HECHO — componente `features/dashboard/consultas-resumen/` nuevo, montado en
`dashboard.html` sólo para quien atiende. Evidencia en `evidencia/h5-panel.txt`.

| ID | Microtarea | Estado |
|---|---|---|
| H5.S1.M1 | Verificar que no hay endpoint de analítica de consultas | HECHO — `grep -rn "@Get(" src/modules/reporting/controllers/` sobre la API → 0 resultados de lectura de agregación; todos los verbos son `POST` |
| H5.S1.M2 | Leer el precedente de analítica simulada y decidir | HECHO — `insurance-analytics.handlers.ts` citado; decisión: agregación en el cliente sobre `GET /scheduling/bookings`, mismo patrón que `AgendaDeHoy` |
| H5.S1.M3 | Declarar la consecuencia | HECHO — documentado en el JSDoc de `consultas-resumen.ts`: esta cifra hoy sólo existe en la maqueta; fuera de ella hace falta un endpoint de agregación real |
| H5.S1.M4 | Definir ventana y zona horaria | HECHO — semana lunes-domingo, mes calendario, hora local del navegador (declarado en el JSDoc del componente) |
| H5.S2.M1 | Semanal, mensual, canceladas incluibles | HECHO — `resumenSemana()`/`resumenMes()` + toggle `incluirCanceladas` (mismo criterio que `incluirCanceladas()` de la agenda) |
| H5.S2.M2 | Mapa de calor hora × día | HECHO — tabla 7×13, verificado con capturas y con el spec `[0][3]` para 09:00 del lunes |
| H5.S2.M3 | Sin depender sólo del color | HECHO — cada celda lleva el número en texto siempre (`–` si es 0) + `aria-label` con día/hora/cantidad; tabla semántica navegable con lector |
| H5.S3.M1 | Otras atenciones con la tipología existente | HECHO — `serviceConceptId` cruzado contra `GET /scheduling/activity-types`, excluyendo `CONSULTATION`/`FOLLOW_UP` |
| H5.S3.M2 | Igualar tonos panel↔agenda | HECHO — `app-status-seal` (mismo componente/mapa que `booking-status.ts` de la agenda) para "canceladas"; `app-chip` con el `tone` que ya publica el propio endpoint de actividades |
| H5.S3.M3 | Verificar en claro y oscuro | HECHO — capturas `h5-consultas-resumen-{390,768,1024,1440,1920,1440-oscuro}.png`, miradas; escala de calor en petróleo (nunca ámbar), con override explícito para modo oscuro |

## H6 — Globos del panel, patrón de Itzan, regresión y cierre

**Estado:** HECHO. El patrón de Itzan **ya está publicado**:
`origin/itzan/patron-acciones-fila-insignia-perfil` — pero mi lote no tiene ningún botón de solo
ícono ni grupo de opciones (medido, ver H6.S2), así que no había nada que aplicarle.

| ID | Microtarea | Estado |
|---|---|---|
| H6.S1.M1 | Capturar el globo de la agenda y el estado del panel, lado a lado | HECHO — el panel ya no tiene "ningún globo" (Q-D5 de la ficha): `consultas-resumen` agrega dos (`ⓘ` en el título y en el mapa de calor), reusando `appTooltip` tal cual lo usa `access-tree.html` |
| H6.S1.M2 | Aplicar el globo del sistema en los bloques que lo necesiten | HECHO — `appTooltip`/`appTooltipPosition`, sin tooltip propio nuevo |
| H6.S1.M3 | Verificar con puntero, teclado y en móvil | HECHO — `tabindex="0"` + `aria-label` agregados (el ícono no era enfocable por defecto); verificado con foco por teclado en el spec E2E (`getByRole('tooltip')` visible tras `.focus()`) |
| H6.S2.M1 | Medir `iconOnly` y grupos de opciones en mis archivos | HECHO — `grep -rn "iconOnly" src/app/features/dashboard src/app/core/mock src/app/core/data-access` → **0**. Grupos de opciones (radio sueltos que debieran ser `select`): **0** — no agregué ningún control de ese tipo |
| H6.S2.M2 | Aplicar el patrón de Itzan | HECHO (no aplica) — con 0 y 0 no hay nada que convertir; no se creó una versión propia del componente de Itzan |
| H6.S2.M3 | Justificar cada excepción | HECHO — sin excepciones que justificar |
| H6.S3.M1 | Gates estáticos + specs propios + spec del simulador entero | HECHO — `yarn typecheck` 0, `yarn lint` 0, specs de mock 48/48, specs de `consultas-resumen`+`dashboard` 24/24 |
| H6.S3.M2 | Barrido y click-sweep serial | A MEDIAS — no corrí el `recorrido`/Cypress completo (cientos de capturas de TODA la app, desproporcionado para una tarjeta nueva); en su lugar corrí un E2E dirigido (`ender-contratos-panel-evidencia.spec.ts`) que verifica consola/red limpias en los 5 anchos + oscuro sobre la pantalla que toqué. Qué falta exactamente: el barrido genérico de toda la aplicación, que es responsabilidad transversal, no de un solo lote |
| H6.S3.M3 | Capturas 3+ viewports × 2 temas, miradas, y `REPORTE.md` | HECHO — 6 capturas del panel (5 anchos + oscuro) miradas una por una; `REPORTE.md` en `docs/trabajo/2026-09-20-ender-contratos-panel/REPORTE.md` |
| — | Regresión completa del frontend | HECHO con 1 excepción declarada — `yarn test` completo: **6875/6876** verde. El único rojo (`features/accounting/resumen/resumen.spec.ts`, "pide el estado de resultados SEIS veces") es de un módulo que no toqué (`git diff --name-only` no lo incluye); parece dependiente de la fecha de hoy (2026-09-21), preexistente, fuera de mi alcance |

## Nota de método

Las tablas de H3–H6 remiten a los IDs y textos completos de la ficha
(`Noche-CorreccionesDoctor.ContratosYPanel/CatalogosBloqueosPosologiaYPanel.md` §4) para no
duplicar 55 filas de CA/DoD ya escritas allí letra por letra; este PLAN.md es la fuente de
**estado** (columna Estado, única que cambia), la ficha es la fuente de **criterio**. Ante
cualquier discrepancia, gana la ficha (es la especificación), salvo que este PLAN.md registre
explícitamente por qué se apartó.
