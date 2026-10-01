# Hito 2 — Integración del frontend sobre dev

Fecha: 2026-09-30. Repositorio: mantra-core-health. Predecesor: Hito 1 API, PR #520 (abierto).
Rama: `marcelo/feat-sincronizacion-mockup-dev-test`. Base obligatoria: origin/dev.

## Resultado y alcance

**CA H2:** Dadas dev, mockup y test, cuando se integren sobre dev, entonces se conservan funcionalidades, infraestructura y accesibilidad, con evidencia diferenciada demo/API real.
**DoD H2:** ancestros preservados, matriz funcional comprobada, gates aprobados, reporte versionado y PR revisable hacia dev con jsaldias39 y PabloArauzCaballero.
**Estado H2:** EN CURSO.
Kill-test: con mockBackend=false una petición mantiene respuesta/error HTTP del backend y ningún handler simulado la intercepta.

IN: todos los cambios entrantes de las tres referencias; resolución semántica de conflictos; configuración demo y real; scripts/gates y pruebas afectados; documentación de integración. Reparaciones demostradas se agregan como microtareas antes del cambio.
OUT: implementación de endpoints faltantes del backend, cambios de esquema, upgrades/refactors ajenos, despliegue, merge humano del PR, promoción a test/mockup.
Decisiones del usuario: API real predeterminada; demo explícita; presupuesto initial maximumError 1.5MB, restantes umbrales conservados; entrega por PR, no auto-merge.

## H2.S1 — Preparación y trazabilidad

**CA:** Dado el trabajo existente, cuando comience la integración, entonces la rama original queda intacta y cada cambio tiene origen y aceptación registrados.
**DoD:** worktree separado, referencias fijadas y plan versionado antes del código.
**Estado:** EN CURSO.

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Actualizar referencias | Dadas las ramas remotas, cuando se consulten, entonces quedan identificadas sus entradas. | `git fetch --all --prune` y SHA registrados en evidencia | HECHO |
| H2.S1.M2 | Crear worktree desde dev | Dada dev, cuando se crea el worktree, entonces HEAD coincide con la base. | `git rev-parse HEAD` = c8d229b3e6a8d870766aaa13aaebf2bd40f22a33 | HECHO |
| H2.S1.M3 | Plan y matriz | Dada la tarea, cuando se edite código, entonces ya existe plan versionado. | `git log -1 -- docs/trabajo/2026-09-30-sincronizacion-frontend-dev-test/PLAN.md` | HECHO |
| H2.S1.M4 | Disponibilidad de contratos | Dados consumidores frontend, cuando se comparen con H1, entonces se identifican implementaciones y pendientes. | Inspección de MATRIZ.md con evidencia de fuentes | HECHO |

## H2.S2 — Reconciliación y modos

**CA:** Dadas implementaciones divergentes, cuando se resuelvan colisiones, entonces permanecen capacidades de las tres ramas y cada entorno usa su backend previsto.
**DoD:** ambos merges registrados, contratos preservados, pruebas de configuración/interceptor aprobadas.
**Estado:** TODO.

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Merge mockup | Dadas dev/mockup, cuando se integren, entonces se preservan sus capacidades y ancestry. | `git merge-base --is-ancestor d0d240ed876f1e01d22ffe5cbdcfe68798b8fb1f HEAD` → 0 | HECHO |
| H2.S2.M2 | Merge test | Dada test, cuando se integre, entonces se preservan a11y, QA y production-api SSR. | `git merge-base --is-ancestor b0e864f5c0dac052ede570c5cccb0e1a7793a971 HEAD` → 0 | HECHO |
| H2.S2.M3 | Demo explícita | Dados entornos reales, cuando se compilen, entonces mocks/demos están apagados; demo los activa explícitamente. | Suites de entornos/interceptor → verde | HECHO |
| H2.S2.M4 | Verificador de entornos | Dada la configuración elegida, cuando se inspeccione automáticamente, entonces el gate asegura ambos modos. | `node scripts/check-real-api-config.mjs` → 0 | HECHO |
| H2.S2.M5 | Artefactos/dependencias | Dados manifiesto y lockfile fusionados, cuando se instalen, entonces se conserva instalación reproducible PnP. | `corepack yarn install --immutable` → 0 | A MEDIAS |

Resolver por comportamiento, nunca elegir globalmente ours/theirs. Preservar /pharmacies/, CSV, rutas, formularios, navegación, nuevos portales, campañas, a11y y determinismo de pruebas. Documentación histórica conserva procedencia; no inventar evidencia retrospectiva.
Demo: environment.demo.ts; serve development,demo; build production,demo; start:demo. Conservar real-api/e2e-real/production-api; los modos reales apagan todos los flags que fabrican datos. Presupuesto 1.5MB en production y production-api.

## H2.S3 — Verificación y regresión

**CA:** Dado el árbol integrado, cuando se ejerciten configuraciones/flujos, entonces se conserva el comportamiento sin resultados simulados presentados como reales.
**DoD:** comandos seriales, evidencia literal vinculada a SHA, escenarios sintéticos, revisión visual independiente.
**Estado:** TODO.

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S3.M1 | Tipos | Dado el árbol, cuando se comprueben tipos, entonces no hay errores. | `corepack yarn typecheck` → 0 | HECHO |
| H2.S3.M2 | Lint | Dado el árbol, cuando se analice, entonces no hay errores de lint. | `corepack yarn lint` → 0 | HECHO |
| H2.S3.M3 | Producción | Dada production, cuando se construya, entonces genera artefacto válido. | `corepack yarn build --configuration=production` → 0 | HECHO |
| H2.S3.M4 | Bundle | Dado el artefacto nuevo, cuando se mida, entonces respeta presupuestos. | `node scripts/check-bundle-budget.mjs` → aprobación; sin artefacto no cuenta | HECHO |
| H2.S3.M5 | SSR real | Dada production-api, cuando se construya/arranque, entonces sirve rutas reales. | `corepack yarn build --configuration=production-api` → 0; observación SSR documentada | HECHO |
| H2.S3.M6 | Demo compilada | Dada demo, cuando se construya, entonces conserva pantallas simuladas. | `corepack yarn build --configuration=production,demo` → 0 | HECHO |
| H2.S3.M7 | Unitarias dirigidas | Dados componentes afectados, cuando se prueben, entonces pasan sus contratos. | `corepack yarn test --include='**/patient-chart.spec.ts' --include='**/menu.spec.ts' --include='**/mock-backend.spec.ts' --watch=false` → 0; ampliar afectados | EN CURSO |
| H2.S3.M8 | Regresión unitaria | Dado el árbol final, cuando se ejecute cobertura, entonces pasan pruebas y umbrales. | `corepack yarn test:coverage` → 0 | TODO |
| H2.S3.M9 | Gates locales | Dados contratos arquitectónicos, cuando se validen, entonces pasan arquitectura/prefijos/rutas/formularios/tokens/contraste. | Cada `node scripts/check-*.mjs` aplicable → 0, individual | TODO |
| H2.S3.M10 | Navegador | Dados roles sintéticos, cuando recorran matriz, entonces se conservan flujos demo/reales disponibles. | Playwright Chromium `--workers=1 --retries=0`, capturas 390/1440 y revisión independiente | TODO |

Matriz: laboratorio; C3; dictamen/anulación/refacturación; notificación→acción; búsqueda de dependientes; glosario; contabilidad; farmacia/CSV; drawer teclado/Escape/foco/inert; regiones vivas/badges. Reales: UI→request→response→persistencia→recarga. Nunca PHI en evidencia. No skip/only, reducción de aserciones/cobertura ni retries/timeouts para ocultar fallos.

## H2.S4 — Evidencia y publicación

**CA:** Dada la integración comprobada, cuando se publique, entonces revisores identifican validación, dependencias y estado mergeable.
**DoD:** reporte versionado, árbol limpio, PR no draft, reviewers pedidos, MERGEABLE y checks comprobados tras último push.
**Estado:** TODO.

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S4.M1 | Reporte | Dado el trabajo, cuando se reporte, entonces cada CA enlaza evidencia o pendiente. | Inspección REPORTE.md: completado/a medias/pendiente/evidencia/no cubierto/desvíos | TODO |
| H2.S4.M2 | Integridad Git | Dados commits finales, cuando se inspeccionen, entonces tres ancestros presentes y árbol limpio. | `git status --porcelain` vacío; ancestry individual → 0 | TODO |
| H2.S4.M3 | Publicar PR | Dada rama verificada, cuando se publique, entonces PR a dev con reviewers solicitados. | `gh pr view --json url,baseRefName,headRefName,reviewRequests` | TODO |
| H2.S4.M4 | Gate final PR | Dado último push, cuando GitHub recalcule, entonces estado y checks están documentados. | `gh pr view --json number,url,isDraft,mergeable,mergeStateStatus,reviewRequests,statusCheckRollup` | TODO |

## Riesgos y límites

- H1 existe en e76f92dd, PR #520 abierto, CI docs rojo; DDL/runtime no comprobados. Contratos ausentes no amplían alcance al backend.
- Funciones solo simuladas se prueban como demo; casos reales sin contrato quedan BLOQUEADO y no certifican cierre completo.
- 113 conflictos textuales reales (112 preliminares) en primera integración: lista real se registra después de merge.
- CI propio con última ejecución fallida; nunca sustituir un check remoto fallido por una afirmación de verde local.
- Los conflictos semánticos se contrastan con requisitos, fuentes de contratos y pruebas; hallazgos externos se documentan.

Estados: TODO · EN CURSO · HECHO · A MEDIAS · BLOQUEADO · DESCARTADO. Un solo cambio pesado/test/build a la vez.

## Microtareas descubiertas durante integracion

Pertenecen a H2.S2. Se agregan antes de reparar.

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S2.M6 | Duplicados de automerge | Dados TS2300/TS2451 del primer typecheck, cuando se consoliden miembros identicos, entonces queda una definicion por simbolo. | corepack yarn typecheck -> 0 | HECHO |
| H2.S2.M7 | Compatibilidad notas reales | Dado P39 pendiente, cuando se escriban filas en API real, entonces se serializan como objectiveText sin claves rechazadas; demo conserva entries. | Suite ChartNotesClient alta/enmienda, texto+filas y modo demo en verde | HECHO |
| H2.S2.M8 | Rutas y evidencia farmacia | Dados catalogo real y portal demo, cuando se navegue al catalogo, entonces cada modo usa su contrato y se conservan ambos recorridos. | Prueba del destino por configuracion en verde | HECHO |

Correccion factual: progress-notes fue retirado por C1 (26698990) y absorbido por la nota de consulta; no recrear pantalla obsoleta ni importar modulo eliminado. Conservar capacidad en expediente conforme a navegacion vigente.

| H2.S2.M9 | Contrato de errores fusionado | Dado ValidationIssue de test con message, cuando los handlers entrantes reporten errores, entonces usan la misma envoltura sin perder detalles. | typecheck y suites billing/received-claims en verde | EN CURSO |

Corte de verificacion parcial: merge mockup b11d57f7, segundo merge test MERGE_HEAD b0e864f5, typecheck integrado exit 0 (evidencia/11-typecheck-integrated.txt). Matriz contractual en MATRIZ.md. Las ramas remotas avanzaron luego del corte: dev 1b1bcaaf agrega unicamente cache de lint (#796); se revisara mergeabilidad al publicar, sin cambiar retrospectivamente SHA de entrada.

| H2.S2.M10 | Altas demo y contrato CL43 | Dados formularios posteriores D2/Farmacia y altas CL43, cuando el mock valide su forma, entonces conserva documentos opcionales del portal y validaciones territoriales/legales de CL43. | Suites auth.handlers.laboratory, auth.handlers.pharmacy y profiles-propios.handlers en verde | HECHO |

## Correccion del diagnostico de instalacion

Los tres SHA de entrada declaran `nodeLinker: node-modules` en `.yarnrc.yml`; no habia PnP que conservar. Se consulto preferencia al usuario mediante pregunta asincrona. Hasta recibir respuesta se mantiene la instalacion existente sin migrarla ni cambiar dependencias. M5 no certifica PnP; debe registrar este desvio factual o el cambio expresamente solicitado.

Correccion H2.S2.M4/M7: el builder Angular instalado rechaza `vi.mock` con rutas relativas. La prueba HTTP usa TestBed y un proveedor de carga diferida, resuelto solamente despues del guard mockBackend; los entornos se restauran tras cada caso. El fallo reproducido queda en evidencia/13-directed-integrated.txt.

| H2.S2.M11 | Medios reales en proxy de desarrollo | Dado mockBackend=false, cuando se pida public/media, entonces proxy reenvia a API y no devuelve SVG sintetico; demo conserva su recurso. | check-real-api-config y observacion de red real/demo | EN CURSO |

| H2.S2.M12 | Limite de workers Vitest instalado | Dado Vitest4 sin poolOptions en sus tipos, cuando se configure maxWorkers=4, entonces se conserva el limite previsto para evitar agotamiento en regresion. | test:coverage ejecutado con configuracion soportada, sin bajar umbrales | EN CURSO |

| H2.S2.M13 | Actualizacion externa dev #796 | Dado dev actualizado durante ejecucion, cuando se incorpore 1b1bcaaf, entonces se conserva cache lint aprobada y PR comparable con dev actual sin reemplazar entradas originales. | Merge ancestry 1b1bcaaf y lint en verde | HECHO |

| H2.S2.M14 | Cinco fallos de lint integrado | Dado lint con cinco errores, cuando se restaure la serie solo demo, se quite import muerto, se ubique la prueba de dominio en features y el evento en el control, entonces lint y pruebas afectadas pasan sin desactivar reglas. | yarn lint -> 0; suites perfiles/dependientes/campana en verde | EN CURSO |

| H2.S2.M15 | Evidencia nueva aislada | Dados recorridos que escriben en carpetas historicas, cuando H2 defina E2E_EVIDENCE_DIR, entonces las capturas nuevas se guardan alli sin sobrescribir resultados anteriores. | Chromium serial y git diff de historicos sin cambios de evidencia | EN CURSO |

| H2.S3.M11 | Glosario seed disponible | Dado que el corpus completo CIMA no esta en disco y el seed trae 5998 terminos, cuando se navegue en demo, entonces manifiesto/shards se cargan bajo demanda y busqueda/detalle/recarga/casos vacio e invalido responden al contrato disponible. | Nueva suite hito2-glossary-seed.spec.ts Chromium serial 390/1440 con red y capturas; script CIMA original intacto, corpus completo pendiente explicito | EN CURSO |

Alcance ampliado: playwright/hito2-glossary-seed.spec.ts y su evidencia. No cambiar el corpus ni presentar seed como corpus CIMA completo.

| H2.S2.M16 | Aislamiento de pruebas demo en pedidos | Dados fallos de new-order, checkout y order-detail al apagar demo por defecto, cuando cada escenario declare su modo real o demo, entonces se conserva la misma asercion funcional sin depender del entorno global anterior. | Suites afectadas completas en verde y casos reales conservados | EN CURSO |
| H2.S2.M17 | Errores HTTP de farmacia y facturacion | Dados fallos observados de pharmacy.handlers y billing-simulated.handlers, cuando se reconcilie la envoltura ValidationIssue de las ramas, entonces estados, campos y mensajes se preservan. | Ambas suites completas en verde sin omitir casos invalidos | EN CURSO |
| H2.S2.M18 | Perfiles y foco tras merge | Dados fallos observados de practitioner-profile-edit, practitioner-profile-view y work-history, cuando se reconcilien capacidad/contrato/selectores, entonces filtros, seguros y retorno de foco conservan sus requisitos. | Tres suites completas en verde, sin reducir aserciones | EN CURSO |
| H2.S2.M19 | Contratos clinicos y navegacion tras merge | Dados fallos de registro profesional, specialty-form-block, navigation, shell-layout y app.routes, cuando se corrija la divergencia demostrada, entonces se preservan catalogos, notas y rutas de las entradas. | Suites afectadas completas en verde y regresion completa | EN CURSO |

Reproduccion de M16-M19: evidencia/31-coverage.txt sobre 4247bb0a. Antes de reparar se inspecciona cada asercion frente al requisito/codigo; no se cambian contratos por conveniencia ni se desactivan pruebas. Alcance: implementaciones y pruebas de los modulos citados, ya entrantes de las ramas.

| H2.S2.M20 | Configuracion explicita en suites demo restantes | Dados fallos observados en perfiles/campanas/promociones/facturacion y pago/factura de pedidos, cuando los fixtures declaren sus tokens demo, entonces mantienen escenarios reales apagados y simulados encendidos de forma aislada. | Suites completas afectadas y regresion en verde sin tocar umbrales | EN CURSO |
| H2.S2.M21 | Reconciliacion restantes contratos de regresion | Dados fallos observados en handlers entrantes, subgrupos/rutas, notas adicionales, notificaciones, calendarios y fixtures, cuando se contraste cada fallo con fuente/contrato, entonces se repara su causa conservando capacidades. | Casos fallidos reproducidos y suites afectadas completas en verde; toda limitacion externa explicita | EN CURSO |

M20 amplifica M16 a order-payment, order-invoice, pharmacy-profile, pharmacy-campaigns cliente/vista, promotions, campaign-detail y billing. M21 incluye brechas-h1, insurance-portability/analytics, insurer-received-claims, simple-accounting, lab-portal, patient-spending, additional-fields, medical-note-block, insurance-claims, department-map, appointment-calendar, fichas-estandar, mock-backend-latencia, aviso-de-hueco-libre, corpus y representacion-grafica, mas suites de navegacion. Fuente: fallos literales de 31-coverage.txt; diagnostico antes de cada reparacion.

| H2.S2.M22 | Gate de arquitectura integrado | Dados cuatro ciclos, un import contra capas y tres fetch fuera de data-access, cuando se elimine cada dependencia indebida conservando contratos, entonces el gate aprueba sin exclusiones nuevas. | node scripts/check-architecture.mjs -> 0; suites afectadas en verde | EN CURSO |
| H2.S2.M23 | Formularios integrados paginados | Dados seis formularios detectados sin paginar, cuando usen el patron nativo de paginas de hasta cuatro campos, entonces conservan validacion y alta. | node scripts/check-form-pages.mjs -> 0 y suites/recorridos afectados | TODO |
| H2.S2.M24 | Tokens CSS validos | Dados seis tokens sin declarar, cuando se use el token existente o fallback documentado para variables dinamicas, entonces estilos tienen valor valido. | node scripts/check-css-tokens.mjs -> 0 y capturas afectadas | TODO |
| H2.S2.M25 | Gates documentales y diff amplio | Dados gates documentales desactualizados y diff que no pudo evaluarse, cuando se regenere solo lo derivado y se diagnostique el fallo real del lector, entonces cada gate informa resultado efectivo sin omision silenciosa. | generate-doc-report y check-english-identifiers sobre SHA base real; registrar bloqueos preexistentes si los hubiera | TODO |

M22-M25: fuente evidencia/32-*.txt; alcance archivos enumerados por los gates, utilidades minimas necesarias para eliminar ciclos/red indebida, artefactos derivados y scripts de verificacion. No reducir reglas ni agregar excepciones para lograr verde.

| H2.S2.M26 | Paginacion de campos compuestos sin form anidado | Dado CamposDeNombre proyectado dentro de otro formulario, cuando se pagine, entonces usa contenedor embebido sin form/submit adicional y el padre conserva validacion/envio. | Spec del modo embebido verifica ausencia de form anidado, botones de navegacion type=button y submit del padre; gate formularios | EN CURSO |

M26 amplia M23 a PaginatedForm TS/html/spec y CamposDeNombre; no cambia modo standalone existente. Evita introducir formulario HTML invalido para cumplir el gate.

| H2.S2.M27 | Prefijos de consumidores entrantes | Dados 39 endpoints consumidos sin proxy, cuando se agreguen sus seis prefijos especificos en desarrollo/Docker/nginx, entonces respuestas reales y errores del backend llegan al consumidor en vez de HTML del frontend. | check-client-prefixes, check-api-prefixes y check-route-prefixes -> 0; disponibilidad real sigue en MATRIZ | EN CURSO |

M27 alcanza proxy.conf.json, proxy.conf.docker.json y deploy/api-locations.conf. Rutar un consumidor no inventa su implementacion backend; los contratos ausentes permanecen pendientes.

| H2.S3.M12 | HTTP de modo real contra doble declarado | Dado artefacto production-api con mockBackend apagado y API local controlada de prueba, cuando el navegador envie login y reciba errores 400/409/500, entonces la peticion sale por HTTP y conserva estado/cuerpo sin respuesta del simulador interno. | Chromium serial sobre servidor construido, respuestas observadas exactas y capturas390/1440; evidencia etiquetada doble HTTP, no API H1 ni persistencia real | TODO |

M12 agrega playwright/hito2-real-http-isolation.spec.ts. El doble escucha solo loopback, usa datos sinteticos, sirve el artefacto real ya construido y no modifica backend, BD ni esquemas. El cierre real de H2.S3.M10 sigue bloqueado por runtime/contratos H1 ausentes.

| H2.S3.M13 | Aislar refresh token de pruebas | Dado que la regresion deja un token rotado en localStorage, cuando authInterceptor pruebe un 401, entonces usa el token declarado por su caso sin heredar otra suite. | auth.interceptor.spec.ts completa y test:coverage -> 0 | A MEDIAS |
| H2.S3.M14 | Aislar reservas persistidas entre suites | Dado que las pruebas de agenda comparten reservas mutables y fechas simuladas, cuando scheduling comprueba la seed, entonces carga un fixture fresco del reloj actual y la suite de IDs no deja reservas en sessionStorage. | agenda-ids-estables.spec.ts, scheduling.handlers.spec.ts, reconsulta-idempotente.spec.ts y test:coverage -> 0 | A MEDIAS |

M13 alcanza auth.interceptor.spec.ts y su almacenamiento de prueba. M14 alcanza las specs de agenda/seed y la clave `mock.agenda.reservas` de sessionStorage; no cambia el contrato ni el sembrado de producto.

| H2.S3.M15 | Cubrir ramas core descubiertas por la regresion verde | Dado que 9507 pruebas pasan pero core queda en 76,11 % de ramas, cuando se agreguen pruebas funcionales de los handlers poco ejercitados, entonces core alcanza el umbral existente de 80 % sin exclusiones ni rebajas. | `corepack yarn test:coverage` -> 0; cobertura core branches >= 80 % | A MEDIAS |

M15 se descubrio al obtener por primera vez la suite completa sin pruebas fallidas (evidencia/63-coverage-fresh-seed.txt). El informe `coverage/mantra-core-health/coverage-summary.json` registra 9842/12930 ramas core cubiertas; faltan al menos 502 ramas para 80 %. Son pruebas nuevas de flujos reales del simulador, no ajustes del umbral.

| H2.S3.M16 | Quitar import no usado tras aislamiento clinico | Dado el lint final, cuando se revise la prueba clinica reparada, entonces no conserva el import `Coleccion` sin uso. | `corepack yarn lint` -> 0 | HECHO |

| H2.S3.M17 | Corregir inventario mock-cliente | Dado que el scanner confunde `GET` con un `PATCH` posterior al atravesar genericos multilinea, cuando inspecciona PharmacyClient, entonces solo registra las llamadas HTTP reales y retira brechas ya cubiertas. | `node scripts/check-mock-vs-client.mjs --json` sin GET inventado; gate -> 0 tras M18 | HECHO |
| H2.S3.M18 | Completar dictamen y EOB demo | Dado un reclamo enviado, cuando la aseguradora adjudica sus lineas y publica la EOB, entonces el detalle refleja importes, decisiones, clausulas y publicacion; entradas invalidas no mutan el reclamo. | Suite dirigida del handler de seguros con correcto/limite/invalido y `check-mock-vs-client` -> 0 | HECHO |
| H2.S3.M19 | Quitar desborde móvil observado | Dadas las vistas demo a 390 px, cuando se abran drawer, glosario y portal de laboratorio, entonces el documento no desborda horizontalmente y los controles siguen accesibles. | Playwright Chromium a 390 px, capturas e inspeccion de elementos desbordados -> 0 | HECHO |
| H2.S3.M20 | Corregir selectores E2E de campos y dialogo nativos | Dado que los componentes SearchField y ContentDialog contienen un host y un control interno, cuando el navegador los pruebe, entonces selecciona el textbox/dialog real sin ambiguedad y conserva todas las aserciones. | Suites hito2-accessibility y hito2-laboratory-insurance a 390/1440 -> 0 | HECHO |
| H2.S3.M21 | Mantener panel de notificaciones visible en móvil | Dado el encabezado de dos filas a 390 px, cuando se abra la campana, entonces su panel cabe en el viewport sin tapar controles ni quedar debajo del aviso demo. | Playwright hito2-accessibility a 390 px -> 0 y captura visual | HECHO |
| H2.S3.M22 | Conservar unicidad de factura demo tras recarga | Dado un dictamen aprobado persistido, cuando se anule y refacture después de recargar, entonces la nueva factura recibe un número distinto y conserva la anulada en el historial. | Suite de handler con recarga simulada y Playwright aseguradora 390/1440 -> 0 | HECHO |
| H2.S3.M23 | Evitar gasto simulado futuro dentro de hoy | Dado que los movimientos se generan con hora determinista, cuando el rango incluye hoy antes de la hora de un movimiento, entonces ese gasto aun no aparece. | patient-spending.handlers.spec.ts con reloj fijado antes/despues de la hora y regresion -> 0 | EN CURSO |
| H2.S3.M24 | Probar seis ventanas contables en fecha no coincidente | Dado que en el primer dia del mes las ventanas hoy/semana/mes pueden coincidir legalmente, cuando se comprueben seis rangos distintos, entonces el test usa una fecha fija de mitad de mes y conserva la asercion de seis peticiones. | resumen.spec.ts -> 0 y ventanas.spec.ts -> 0 | EN CURSO |
| H2.S3.M25 | Resolver esperas indefinidas de tests de rutas y formularios | Dado que cuatro archivos agotan el timeout tambien en corrida dirigida, cuando se ejercitan rutas y formularios, entonces los dobles de resolver y las esperas se acotan a la condicion funcional requerida. | Cuatro suites completas -> 0 sin subir timeouts ni quitar aserciones | EN CURSO |
