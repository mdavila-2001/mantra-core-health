# Plan — Paciente en el circuito de Laboratorio

> Estado: ejecución parcial al 2026-09-24. `mockup` (`a43ad2b`) incluye el arreglo del aviso por PR #598. La línea base global regenerada midió 58 rutas/232 celdas y encontró 22 scroll horizontales a 375 px. El DOM localiza el problema del directorio en el encabezado compartido; el PR #604 abierto edita `shell-layout`, así que esta rama no lo pisa. Las 232 fotos no están revisadas; falta matriz completa con actor paciente y altas públicas. H1–H6 siguen sin certificar. Ver [REPORT.md](REPORT.md), [línea base aislada](../../../../MetaPrompts/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/evidence-corr34-full-baseline-20260924/GLOBAL-BASELINE-REPORT.md) y [HANDOFF.md](HANDOFF.md).

**ID único:** `Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192`.
**Objetivo:** preparar únicamente la experiencia del paciente en el circuito de laboratorio definido por la fuente: orden, elección de establecimiento, reserva/preparación, cobertura, resultados, factura y beneficios.
**Arquitectura:** reutilizar vistas y clientes Angular existentes. Médico conserva la orden clínica; Laboratorio, oferta/preparación/prestación/resultado; Aseguradora, decisión de cobertura; Paciente, elección y lectura.
**Stack:** Angular 21, señales, SSR, CSS/organismos propios, `corepack yarn`, Playwright.

## Fuente exclusiva y procedencia

- Archivo original: `/Users/josejeremias/Downloads/04_METAPROMPT_LABORATORIO.md`.
- Copia literal preservada: [LABORATORY_SOURCE.md](../../../../MetaPrompts/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/LABORATORY_SOURCE.md).
- SHA-256 observado de ambos: `8047038beb10a5e59c7396b653ce7899b6f26d3f13060783ae3e427c2732e4fa`.
- Registro de procedencia verificable: [PROVENANCE.json](../../../../MetaPrompts/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/PROVENANCE.json).
- Requisitos funcionales: exclusivamente los de esa fuente y sus referencias cruzadas al paciente. No importar requisitos de otros metaprompts de Paciente, Seguro o Integración.
- Las secciones A–I aportan metodología y controles; LAB-X01 y las líneas L0064–66, L0075–80, L0107–119 aportan el recorrido de Paciente. Los Lnnnn son identificadores del extracto, no líneas físicas de esta copia.
- Las reglas de `AGENTS.md` y del repositorio son restricciones de ejecución, no una segunda fuente funcional. La mención de `dev` en el original no amplía el permiso vigente de cambios visuales en `mockup`.

Este documento reemplaza el plan que esta sesión creó en `MetaPrompts/2026-09-23-patient-laboratory-plan/PLAN.md`. Se corrigió su alcance: alta/perfil general, tutor, activación, agenda médica, farmacia e imagenología independientes no forman parte de este plan. No se modifican los demás planes existentes.

## Límites para evitar choques

Un nombre único separa documentos; no otorga exclusividad sobre código. Se comprobó solapamiento planificado con:

- `MetaPrompts/2026-09-23-patient-insurance-plan/PLAN.md`: `diagnostic-orders/` y `diagnostic-results/`.
- `MetaPrompts/2026-09-23-patient-integration-plan/PLAN.md`: las mismas vistas y los clientes de diagnósticos/archivos.

Estos hallazgos no demuestran por sí solos quién está escribiendo ahora. Existe `.claude/runtime/lane-34-claim.json`, pero registra PR #457 y `updated_at` 2026-09-14; es histórico, no una señal vigente de propiedad. También existe `wt-patient-run-2026-09-24` en `justin/patient-closure-h1` (base `origin/dev`) con documentación de trabajo y una spec Playwright sin seguimiento. Esto confirma trabajo paralelo relacionado con Paciente, no propiedad actual de vistas compartidas. No se inspeccionó el estado interno de otros agentes ni se enviaron mensajes.

**Regla para la ejecución:** este plan no reclama propiedad exclusiva de esas vistas. Antes de editar un archivo compartido, verificar cambios actuales y el responsable activo; acordar un único escritor para el diff coincidente. Si no puede resolverse la superposición, dejar la modificación compartida pendiente, guardar propuesta en la carpeta documental de este ID y continuar trabajo independiente. No sobrescribir ni revertir cambios de otro agente. No lanzar generadores que escriban los mismos archivos simultáneamente.

- Documentación y evidencia propia: `docs/work/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/` dentro del frontend al ejecutar; nunca reutilizar la carpeta de otro plan.
- Vistas consumidoras compartidas: lectura y propuesta hasta resolver propietario de la edición.
- Contratos diagnósticos, rutas globales, navegación, esquema y clientes compartidos: un integrador acordado; no duplicarlos para evitar coordinación.
- Administrar empresa, sucursales, catálogo, publicar resultados y reportar comisiones pertenece al módulo Laboratorio. Aquí se registran dependencias y pruebas del consumidor, no una segunda implementación de esos módulos.
- Reservas, cobertura, resultados y beneficios se prueban con sus propietarios; este plan no altera sus invariantes por su cuenta.

## Restricciones vigentes

La ejecución en este turno fue solicitada expresamente por el usuario. Frontend `mantra-core-health/`, base `mockup`, cambios sólo visuales; no editar `mantra-core-health-api/`, `mantra-core-health-model/`, `.env` ni `proxy.conf.json`. Por eso integración, persistencia, cobertura, agenda real y efectos comerciales permanecen sin certificar.

Sólo `corepack yarn`; archivos/identificadores nuevos en inglés, textos rioplatenses. Fondo blanco, organismos existentes y ancho ≥85% de `.app-main__inner`, centrado con holgura ≤2 px conforme a reglas del repo. Conservar SSR y contratos existentes.

Sin pasarela/cobros integrados, transferencias, liquidación ni delivery. Factura externa, GPS/cercanía, puntos, promociones y QR de canje siguen incluidos según fuente. No inventar preparación clínica, tarifas, descuentos, tasas, contratos externos ni confirmación comercial que sustituya «pagado».

NO_TEST_WEAKENING: sin skip/only ni eliminación de aserciones. Registrar los fallos históricos de aviso-de-demora, identity-verification y shell-layout y contrastarlos con la línea base real. Roles Dios, Obrero, Revisor de código y Revisor visual en secuencia.

Para correcciones 31–40: ficha exacta y ambigüedades resueltas, rama `justin/mockup-corr-XX-<slug>`, PR contra `mockup`, sin merge. No convertir automáticamente un hito de este plan en un carril. Sin fotos revisadas no declarar corrección visual hecha.

## F0 — Preparación

- [x] Leer fuente, instrucciones y reglas de composición; registrar alcance efectivo.
- [x] Desde el workspace, ejecutar `git -C mantra-core-health status --short --branch`, `git -C mantra-core-health rev-parse HEAD` y `git -C mantra-core-health worktree list`. Conservar cambios ajenos y registrar SHA real.
- [ ] Resolver conflictos de propiedad de archivos compartidos antes de modificar. No cambiar rama en un checkout usado por otros escritores; aplicar aislamiento compatible con la política del repo.
- [x] Crear `MATRIX.md`, `CONTRACTS.md`, `DECISIONS.md`, `REPORT.md`, `HANDOFF.md` y `evidence/` dentro de la carpeta exclusiva indicada. No crear documentación en API/modelo.
- [x] Matriz: ID fuente `RP-LAB-Lnnnn` y referencias PAC originales sin duplicar conteo; literal, aceptación, alcance, dueño, consumidor, archivos, evidencia por capa, SHA, prueba/salida y bloqueo. Iniciar como SIN_EVALUAR.
- [x] Leer manifest/efectos de generadores y tomar conteo base con `corepack yarn test --watch=false`.
- [x] Obtener línea base fotográfica recuperable con `scripts/corr-evidencia.sh 34 --antes` en copia física aislada, con lista actual regenerada: 58 rutas/232 fotos y 22 rojos de scroll a 375 px. Ver [RUN-LOG](../../../../MetaPrompts/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/evidence-corr34-full-baseline-20260924/RUN-LOG.md). La revisión manual, pasada completa con actor paciente y altas públicas siguen pendientes; el incidente previo se conserva en `evidence/incident/README.md`.

## Hitos y criterios verificables

| Hito | Fuente exacta | Aceptación Dado/Cuando/Entonces | Dependencia |
|---|---|---|---|
| H1 Orden y oferta | LAB-05/06; L0372–75; LAB-E02/03/06 | Dada orden de tres estudios, al consultar oferta se conservan médico/paciente/estudios; un laboratorio con sólo dos se identifica incompleto. Precios corresponden sólo a estudios solicitados y no se inventa moneda. | Médico y catálogo Laboratorio |
| H2 Reserva y preparación | LAB-X01; L0064–66, L0075–80; LAB-E04/05 | Dada sede compatible, al elegir horario se presenta preparación vigente por estudio aportada por el establecimiento. Ausente se informa como no disponible. Dos reservas sobre último cupo no lo sobreasignan; cancelación libera una vez. | Agenda/Laboratorio; sigue H1 |
| H3 Seguro | LAB-09; L0107–119; LAB-E09/10 | Dados 8 estudios, 5 aprobados y 3 rechazados, al consultar/consolidar se conservan todos, motivos e importes. Cobertura pendiente o caída sigue visible/recuperable; no se transforma en aprobación o rechazo. | Aseguradora; sigue H1 y coordinación con plan de Seguro |
| H4 Resultado y factura | LAB-08; LAB-E07/08/11/15/16 | Dado resultado publicado, paciente y médico leen la versión correcta tras recargar en sesiones independientes; corrección conserva historia. Factura externa corresponde a orden/paciente. ID/enlace ajeno no permite descarga. Aviso en cola no se declara entregado. | Laboratorio/archivos/notificaciones; sigue H1 |
| H5 Beneficios | LAB-10/11; LAB-E13/14 | Dada prestación confirmada mediante hecho acordado, puntos se acreditan una vez; canje concurrente respeta saldo y campaña su vigencia/audiencia autorizada. No reservar beneficios por pago integrado inexistente. | Decisión comercial y puntos; no inventar acuerdos |
| H6 Cierre | A–I; kill-test del §6 | Dada orden de Médico, al elegir/reservar/recibir/publicar, Médico y Paciente recuperan el resultado tras recarga con API/BD reales de prueba, si el alcance lo autoriza. | H1–H5 y propietarios participantes |

LAB-01–04 y LAB-E01: dependencias empresariales; LAB-07 y LAB-E12: reporte/comisión del laboratorio. Se conserva trazabilidad sin adjudicar su implementación al paciente ni descartarlos del alcance del módulo Laboratorio completo. No afirmar cierre total de Laboratorio con este plan consumidor.

## Archivos de entrada y verificación dirigida

Rutas relativas a `mantra-core-health/`, localizadas en el turno anterior; revalidar en la rama de ejecución. No presupone autorización de edición.

| Hito | Entrada | Spec existente |
|---|---|---|
| H1/H3 | `src/app/features/account/diagnostic-orders/diagnostic-orders.{ts,html,css}` | `diagnostic-orders.spec.ts` en la misma carpeta |
| H1/H2 | `src/app/features/laboratory-directory/laboratory-directory.{ts,html}` y `laboratory-detail/laboratory-detail.{ts,html}` | `laboratory-directory.spec.ts`, `laboratory-detail.spec.ts` junto a cada componente |
| H4 | `src/app/features/account/diagnostic-results/diagnostic-results.{ts,html,css}` | `diagnostic-results.spec.ts` junto al componente |
| Contratos | `src/app/core/data-access/diagnostics/diagnostics.client.ts`, `diagnostics.types.ts`; `src/app/core/data-access/diagnostic-units/diagnostic-units.client.ts`, `diagnostic-units.types.ts`; `src/app/core/data-access/files/files.client.ts` | Inspección y specs existentes de clientes; no crear contratos paralelos |
| H5 | Localizar con `rg -n 'loyalty|redeem|promotion|campaign' src/app/features src/app/core/data-access` | Fijar el consumidor/spec real antes de proponer cambios |

Para cada hito H1–H5, ejecutar las microtareas en orden:

- [ ] **Hn.M1:** localizar brecha, contrato y propietario; registrar criterio concreto de la tabla y caso actual. Si ya funciona, conservar código y aportar evidencia.
- [ ] **Hn.M2:** guardar fixture sintético/captura que reproduce la brecha. Para cambio de comportamiento autorizado, prueba significativa fallida; para retoque visual, evidencia requerida sin tests que sólo copien implementación.
- [ ] **Hn.M3:** aplicar un cambio mínimo dentro del alcance/propiedad acordados. Dependencia funcional no autorizada permanece BLOQUEADA POR ALCANCE; continuar lo independiente.
- [ ] **Hn.M4:** correr `corepack yarn typecheck && corepack yarn lint`, spec dirigido y `git diff --stat`. Revisar con `.claude/agents/corr-revisor-codigo.md`. Corregir regresiones propias antes de seguir.
- [ ] **Hn.M5:** verificar estados pertinentes de carga/vacío/error/sin permiso/éxito, teclado/foco y reflow; actualizar evidencia y handoff. Reversión: sólo parche propio revisado, sin resets ni restaurar cambios ajenos.

Ejemplo de spec dirigido, desde el frontend, tras comprobar soporte de `--include`:

```bash
corepack yarn test --watch=false --include='src/app/features/account/diagnostic-orders/diagnostic-orders.spec.ts'
```

Esperado: casos pertinentes descubiertos/aprobados; cero casos no verifica nada. Captura o doble de API acredita su capa, no seguridad ni persistencia real. Focos: orden incompleta, preparación ausente, cobertura pendiente, resultado corregido/ajeno, concurrencia/reintentos.

## Bloqueos y decisiones

- Usuario: ampliación de alcance visual a integración funcional, si se solicita.
- Responsables activos de Seguro/Integración: escritor único del cambio coincidente en vistas/clientes compartidos. El nombre de este plan no resuelve esa propiedad.
- Laboratorio: preparación vigente, catálogo, disponibilidad, tarifas y descuentos verificables.
- Comercial: hecho que sustituye «pagado», tasas, multiplicadores y vigencias. No acreditar puntos/comisiones por pulsar un botón.
- Notificaciones: canales/destinatarios reales; una notificación en pantalla no demuestra correo recibido.
- Propietario funcional: discrepancia del mapa Google pedido frente a proveedor implementado; no asumir equivalencia.

## H6 — Evidencia y entrega

- [x] Correr el auditor oficial para cinco rutas actuales (`laboratory-directory`, `appointments`, `diagnostic-orders`, `diagnostic-results`, `promotions`) con `scripts/corr-evidencia.sh 34 --auditoria` en copia aislada. Resultado dirigido actual: 20 celdas, cero rojos; evidencia bajo el directorio ID-único. `/my-account/loyalty` redirige y no se cuenta como pantalla.
- [x] Correr auditor global actual de 58 rutas regeneradas en navegación × cuatro celdas con actor `medica`: 232 imágenes, 22 rojas a 375 px sólo por overflow. Informe [GLOBAL-BASELINE-REPORT.md](../../../../MetaPrompts/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/evidence-corr34-full-baseline-20260924/GLOBAL-BASELINE-REPORT.md).
- [ ] Auditar las rutas actuales de Paciente que no estén cubiertas con actor `paciente`, inventariar/capturar altas públicas y revisar visualmente las 232 fotos. No contar redirecciones a otra pantalla como evidencia de la ruta esperada.
- [ ] Resolver la corrección común del overflow con un escritor único después del PR #604, que modifica `shell-layout`; no duplicar CSS ni pruebas mientras siga abierto.
- [x] Abrir las 37 fotos propias del recorrido Paciente–Laboratorio y documentar sus mediciones en el reporte único.
- [ ] Abrir individualmente las 232 capturas de la línea base y las fotos finales después de corregir; completar `docs/progress/evidence/lane-34/REPORT.md` sólo después de coordinar su escritor. La medición automatizada no sustituye revisión visual.
- [x] Ejecutado `corepack yarn test --watch=false`: 7.322 PASS, 1 FAIL/7.323 en `insurance-analytics.handlers.spec.ts`, fuera del diff; no se debilitó.
- [x] `corepack yarn typecheck`, `corepack yarn build` y ESLint dirigido de `playwright/mock-banner-responsive.spec.ts`: PASS. `corepack yarn lint`: FAIL con 246 errores del estado base.
- [x] Specs dirigidas de los tres rojos históricos de `AGENTS.md`: `aviso-de-demora` 55/55, `identity-verification` 20/20 y `shell-layout` 55/55 PASS.
- [x] Ejecutado `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1`; falla en `beforeAll` porque `localhost:3005/health` no responde. No se levantó ni modificó la API.
- [ ] Kill-test funcional de H6 sólo en entorno/alcance autorizado. De lo contrario, NO EJECUTADO. Datos sintéticos, trazas sanitizadas; sin interceptor del sistema para afirmar integración real.
- [x] Matriz y reporte del plan: SHA real, archivos modificados, comandos/salidas, fotos, defectos, bloqueos y próxima microtarea. Separar presentación, integración local, integración entre módulos y certificación externa.
- [x] PR [#607](https://github.com/mdavila-2001/mantra-core-health/pull/607) abierto contra `mockup`, sin merge. Al 2026-09-24 04:03 UTC, los checks `dependencias`, `e2e` y `verificar` seguían en cola.

## Retomar con poco contexto

Una sesión por hito; leer únicamente fuente/archivos pertinentes. `HANDOFF.md` conserva ID, rama/SHA, árbol sucio, propietario del archivo compartido, último criterio, comandos, evidencia y siguiente microtarea. No releer los demás planes ni repetir pruebas válidas del mismo diff sin motivo.

```text
Leé el plan del ID en `MetaPrompts/`, `REPORT.md`, `HANDOFF.md` y `AGENTS.md`. Retomá desde el handoff; no repitas F0 ni comandos ya registrados.
Fuente funcional exclusiva: `04_METAPROMPT_LABORATORIO.md`, copia y hash en ese paquete. No importes requisitos funcionales de otros planes.
Conservá los límites vigentes: cambios visuales en `mockup`; no tocar API/modelo/.env/proxy.conf.json. H1–H6 siguen sin certificación funcional dentro del alcance actual.
La auditoría global histórica de 54 rutas/216 celdas corresponde a `b7785e3`; la matriz de cinco rutas de Paciente/20 celdas corresponde a `a43ad2b`; la línea base nueva mide 58 rutas/232 celdas con actor `medica`, pero no incluye pasada completa con actor paciente ni altas públicas. Ninguna de esas mediciones cierra el carril global. No reemplaces la matriz INVALIDADA ni escribas el `REPORT.md` compartido sin resolver quién es su escritor.
No repitas el intento de `--antes` en el destino compartido: los PNG/matriz previos se perdieron y el incidente está registrado. La evidencia nueva vive en el subdirectorio de ID único.
Antes de cualquier cambio en vistas/clientes compartidos, establecé escritor único; `wt-patient-run-2026-09-24` contiene una prueba funcional de órdenes en curso. PR #604 modifica la cabecera compartida, causa probable de los 22 rojos móviles; espera la liberación de ese cambio antes de tocar `shell-layout`.
No hagas merge ni despliegues. El diff actual es una regresión Playwright y evidencia; el ajuste del banner ya está en upstream. El PR #607 está abierto; revisá sus checks en cola antes de cerrar este tramo, sin presentar H1–H6 como terminados.
```
