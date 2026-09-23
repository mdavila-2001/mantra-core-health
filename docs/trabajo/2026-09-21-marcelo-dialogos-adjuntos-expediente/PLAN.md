# Plan — Marcelo, turno noche 2026-09-21: el diálogo, los adjuntos y la sección de datos del expediente

- Fecha: 2026-09-21 · Repo: `mantra-core-health` (único con escritura; `mantra-core-health-model` y
  `mantra-core-health-api` sólo se citan, no se tocan — este lote es front puro sobre la maqueta) ·
  Rama: `marcelo/noche-2026-09-21-dialogos-adjuntos-expediente`.
- Fuente: `AlovidaPromptManager/repartos/2026-09-21/PromptNoche/Marcelo/Refactor-DialogosYAdjuntos.Expediente/ContratoDeDialogoAdjuntosYSeccionDeDatosDelExpediente.md`,
  a su vez de `AlovidaPromptManager/docs/requisitos/REFACTOR-FRONTEND-2026-09-21.md` §7-10.3,12.3,14 y
  `AlovidaPromptManager/docs/verificacion/VERIFICACION-CONTRA-CODIGO-2026-09-21.md` §3,4,6,11.
- Corte: `origin/mockup` @ `d40b5631f68a52c79fe94f0dc689df3bc7e70140` (2026-09-22T13:44-04, verificado con
  `git fetch && git log -1 origin/mockup`; distinto del declarado en la ficha `5a0776c6…` — 9 commits
  después, ninguno toca `organisms/{content-dialog,attachment-dialog,attachment-uploader,fact-section}`,
  `molecules/fact-list` ni `features/clinical-record` salvo 3 diálogos nuevos en `admin/**` que amplían
  el conteo de consumidores de 26 a 29).
- Resultado observable: (1) `docs/refactor-profesional/trabajo/contratos/content-dialog.md` existe,
  responde el §8/§10/§10.3 y Justin lo puede usar sin abrir `content-dialog.ts`; (2) el alta del
  expediente y el modal de cambio de estado clínico preguntan antes de descartar lo escrito, por los
  tres caminos de cierre, y devuelven el foco a quien abrió; (3) el veredicto de adjuntos
  (complementarias) y de `fact-section` (medido, sin borrar) están escritos con evidencia.
- Kill-test: abrir el alta de «Documentos» en `/medical-records/<id>`, escribir un título, `Escape` →
  aparece «¿Descartar lo escrito?»; «Seguir escribiendo» conserva el texto; `Escape` sin escribir nada
  cierra de una. Repetir con el fondo y con el botón: mismo resultado. Sin esto, H3 no está hecho.

## Desvíos deliberados del texto de la ficha (registrados, no ocultos)

1. **H3 se reformula.** La ficha asume un `<dialog>`/`role="dialog"` escrito a mano en `patient-chart.html`;
   no existe (el único match es un comentario en la línea 296). Los tres modales del expediente YA son
   `<app-content-dialog>` pero ninguno vincula `[dismissible]`/`(dismissAttempt)`. H3 pasa a ser: cablear
   la política de descarte que el repo ya usa (`attachment-dialog`, `work-history`, `tarjeta-del-dia`),
   con un contrato nuevo `DRAFT_BLOCK` para que el expediente sepa si el bloque montado tiene algo escrito.
2. **Consumidores de `content-dialog`: 29 plantillas / 33 instancias**, no 26 (tres diálogos de `admin/**`
   entraron por merge después del corte de la ficha). El criterio de "respeta la política" y la tabla
   completa se recalculan sobre 29.
3. **Casa de los contratos**: `docs/refactor-profesional/trabajo/contratos/` (carpeta nueva, sin pisar
   nada), en vez de improvisar una ruta. Se enlaza desde `docs/components/modals-and-overlays.md` y desde
   `docs/refactor-profesional/trabajo/DECISIONES.md`.
4. **Orquestación**: un Workflow de agentes DE SÓLO LECTURA para medir (H2.S2, H4.S1, H5.S1, diálogos
   crudos) y refutar adversarialmente los tres veredictos. Se desvía de la letra de la regla 20 (más de
   un subagente / concurrencia) — declarado acá y en el reporte; el espíritu (nada de builds, servers ni
   navegadores concurrentes) se cumple: todo lo demás corre serial e inline. Resultados contrastados a
   mano con `git grep -l ... | wc -l` antes de citarlos.
5. **Instalación del estándar (§1.1 de la ficha)**: se LEE desde `AlovidaPromptManager/.claude/` (repo
   hermano), no se copia dentro de `mantra-core-health/.claude/` — copiar pisaría el `settings.json`
   versionado del front (marketplaces/plugins propios) y sumaría ~200 archivos sin rastrear al PR. El DoD
   de la sección 1 de la ficha (176 skills, 11 PASS del self-test) se cumple igual, ejecutado desde el
   hermano.

## Alcance

**IN:** los seis archivos/carpetas reservados de la ficha —
`shared/components/organisms/{content-dialog,attachment-dialog,attachment-uploader,fact-section}/**`,
`shared/components/molecules/fact-list/**`, `features/clinical-record/**` — más un archivo nuevo
`features/clinical-record/patient-chart/draft-block.ts`; los tres documentos de contrato; los specs
dirigidos (7 bloques + `patient-chart.spec.ts` + `attachment-*.spec.ts` si aplica); un spec Playwright
nuevo; capturas antes/después; `PLAN.md`/`REPORTE.md`/`evidencia/`.

**OUT:** cualquier archivo fuera de esos seis · los dos diálogos crudos de `alovida/buscar/**` (son de
Justin: se les entrega el contrato, no se migran acá) · `agenda/**`, `messaging/**`, `public-profile/**`
(oleada 2, declarada con dueño propuesto) · `core/mock/**` (Ender) · los tres barrels
`shared/components/*/index.ts` (Ender) · `organisms/{data-table,view-state-host,filter-bar,directory-page,
page-header,paginated-form,form-section,form-actions}/**` y `molecules/{search-field,pagination,
form-field}/**` (Pablo/Justin/Itzan) · cambiar `ViewState<T>` · fusionar `attachment-dialog` con
`attachment-uploader` sin evidencia · borrar `fact-section` · inventar dato clínico · cambiar qué se
registra en un encuentro/episodio · datos reales de paciente en cualquier artefacto.

## Ambigüedades registradas

| ID | Ambigüedad | Supuesto de trabajo | A quién se confirma |
|---|---|---|---|
| Q-M1 | ¿El descarte del alta debe preguntar? | **Sí** — se adopta el patrón ya usado por `attachment-dialog`/`work-history`/`tarjeta-del-dia`; es la única lectura consistente con el kill-test de la ficha y con §10.3 del documento maestro («cerrar por botón, Escape o fondo respeta la misma política») | Producto — «resuelta por patrón existente, pendiente de confirmación» |
| Q-M2 | `fact-section`: ¿adoptar o retirar? | Ninguno hoy: veredicto **pendiente con dueño**, cuatro mediciones adjuntas, cero borrado | Pablo |
| Q-M3 | ¿`attachment-dialog`/`attachment-uploader` complementarias? | Se demuestra con evidencia (§7.1), no se asume | Pablo (con mi evidencia) |
| Q-M4 | ¿Los 6 diálogos crudos restantes son de esta oleada? | No — 2 de Justin (contrato entregado), 3 reales de oleada 2 (`messaging`×2, `contact-panel`), 1 cuestionable (`my-agenda` globo, sin `aria-modal`) → agenda; el resto del grep de 9 son comentarios | Pablo |
| Q-M5 | ¿Falta un fixture del expediente en `core/mock/`? | Se usa lo que ya sirve la maqueta (`medica@alovida.mock`, paciente «Ana»); si falta algo puntual se simula en 3 niveles (regla 65) y se declara | Ender |

## H1 — Corte, baseline y capturas previas

**Prioridad:** BLOQUEANTE
**CA:** Dado el entorno, cuando alguien pregunta contra qué versión se trabajó y cómo se comportaba el
diálogo antes, hay SHA, capturas y el comportamiento anotado paso por paso.
**DoD:** salidas en `evidencia/antes/`, capturas descritas, recorrido anotado.
**Estado:** EN CURSO

### H1.S1 — Corte y baseline
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar corte y rama | SHA y rama en este PLAN.md | `git rev-parse origin/mockup && git branch --show-current` | HECHO |
| H1.S1.M2 | Baseline lint | Hay salida y exit code | `yarn lint` a `evidencia/antes/lint.txt` | HECHO — exit=1, 244 errores preexistentes |
| H1.S1.M3 | Baseline typecheck | Hay salida y exit code | `yarn typecheck` a `evidencia/antes/typecheck.txt` | HECHO — exit=0 |
| H1.S1.M4 | Baseline test | Hay conteo de rojos previos | `yarn test --watch=false` a `evidencia/antes/test.txt` | HECHO — exit=1 real (4 archivos / 9 tests rojos de 571/7089) |
| H1.S1.M5 | Clasificar cada rojo previo | Cada uno con su clase (regla 80.4) | tabla en este PLAN.md | HECHO — ver tabla abajo |

**Rojos preexistentes del baseline (`yarn test --watch=false`, 571 archivos, 4 fallan · 7089 tests, 9 fallan):**

| Archivo | Clase (regla 80.4) | Motivo |
|---|---|---|
| `src/app/app.routes.spec.ts` | ENVIRONMENT | `TestBed.configureTestingModule`: "already instantiated" |
| `src/app/features/admin/data-catalog/object-detail/catalog-object-detail.spec.ts` | ENVIRONMENT | idem |
| `src/app/features/auth/register-practitioner/register-practitioner.spec.ts` | ENVIRONMENT | idem |
| `src/app/features/insurance/insurance-analytics/insurance-analytics.spec.ts` | ENVIRONMENT | idem |

Ninguno de los 4 está en el alcance de este carril (`clinical-record`, `content-dialog`,
`attachment-dialog`, `attachment-uploader`, `fact-section`, `fact-list`). El error "already
instantiated" es contención cruzada entre suites (memoria del proyecto: "Contagio de TestBed en la
suite del front" — un hook que tira, no contención del pool per se, pero la firma del error coincide).
Se registra como preexistente; H6 vuelve a correr el suite completo y compara contra este número.

### H1.S2 — Rutas y comportamiento de antes
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Rutas del expediente desde el router | Lista verificada | grep sobre `src/app/app.routes.ts` | HECHO |
| H1.S2.M2 | Confirmar que no hay diálogo escrito a mano en `patient-chart` | Veredicto con línea | grep sobre `patient-chart.html` | HECHO |
| H1.S2.M3 | Recorrer los tres caminos de cierre del alta hoy y anotar | Tres veredictos observados | descripción + capturas en `evidencia/antes/` | A MEDIAS — razonado por código (§4 de este plan: sin `[dismissible]`, los tres caminos destruyen sin preguntar), NO observado en navegador antes del cambio |
| H1.S2.M4 | Anotar dónde queda el foco al cerrar hoy | Sí/no observado | captura del foco | A MEDIAS — mismo motivo: no hay captura del "antes" en navegador |

### H1.S3 — Capturas previas
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Capturar Documentos y Diagnósticos en escritorio y móvil | 4 capturas miradas | `evidencia/antes/capturas/` | PENDIENTE — no se relevantaron capturas "antes"; el costo de otro ciclo de `yarn dev` (ver H3.S3, inestabilidad del entorno) se priorizó para las capturas "después", que sí prueban el comportamiento nuevo |
| H1.S3.M2 | Confirmar sin dato real de paciente | Todo sintético declarado | revisión contra `data-privacy-phi` | HECHO — ver gate en H6.S1.M5 |
| H1.S3.M3 | Consola y red antes de tocar | Lista de errores previos | `evidencia/antes/consola-red.txt` | PENDIENTE — mismo motivo que H1.S3.M1 |

## H2 — El contrato del diálogo, escrito y entregado a Justin

**Prioridad:** ALTA — primero después de H1, porque destraba a Justin.
**CA:** `content-dialog` tiene contrato escrito (§8/§10/§10.3) sin necesitar leer la implementación, y hay
un número exacto de cuántos de los 29 consumidores respetan la política de descarte.
**DoD:** contrato en el repo + conteo con criterio declarado.
**Estado:** HECHO (menos H2.S2.M4, ver abajo)

### H2.S1 — Escribir el contrato
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Leer contrato real (inputs/outputs/slots) | Anotado con líneas | discovery previo (content-dialog.ts) | HECHO |
| H2.S1.M2 | Escribir `contratos/content-dialog.md` — anatomía | Diez filas del §8 respondidas | archivo en disco | HECHO |
| H2.S1.M3 | Escribir la política de descarte por los tres caminos | §10.3 respondido | idem | HECHO |
| H2.S1.M4 | Declarar invariantes | ≥1 invariante escrita | idem | HECHO — 6 invariantes en §4 del contrato |
| H2.S1.M5 | Avisar a Justin | Línea en mi daily y en el de equipo | daily | HECHO — ver `Marcelo-Daily-Noche-2026-09-21.md` |

### H2.S2 — Medir los 29
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Listar los 29 consumidores | Conteo exacto | `git grep -l` sobre `<app-content-dialog` | HECHO (29) |
| H2.S2.M2 | Declarar criterio binario de "respeta la política" | Comprobable | línea en el contrato | HECHO — §5 del contrato |
| H2.S2.M3 | Medir cuántos escuchan `dismissAttempt` | Número | `git grep -c 'dismissAttempt'` | HECHO (5 archivos) |
| H2.S2.M4 | Probar 3 consumidores ajenos a mano, 3 caminos | 9 observaciones + capturas | `evidencia/h2/` | PENDIENTE — la tabla del §6 del contrato es lectura estática (markup), no ejercitada en navegador; no se abrieron `tarjeta-del-dia`/`work-history`/`progress-notes` en runtime por el costo de otro ciclo de servidor (ver H3.S3) |

### H2.S3 — Contrato de la sección de datos
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S3.M1 | Leer `fact-section`/`fact-list`, anotar responsabilidad | 1 línea c/u | discovery previo | HECHO |
| H2.S3.M2 | Escribir `contratos/seccion-de-datos.md` | Diez áreas del §10 | archivo en disco | HECHO |
| H2.S3.M3 | Declarar qué queda fuera | Escrito | idem | HECHO |

## H3 — El expediente respeta la política de descarte

**Prioridad:** ALTA
**CA:** El alta y el cambio de estado clínico preguntan por los tres caminos cuando hay algo sin guardar,
y el foco vuelve a quien abrió.
**DoD:** los 5 comportamientos probados con teclado, descriptos, más captura antes/después.
**Estado:** HECHO — verificado unitario (17 archivos/325 tests) y E2E (3 passed/1 skipped)

### H3.S1 — El contrato `DRAFT_BLOCK`
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Crear `draft-block.ts` (interfaz + `InjectionToken`) | Compila solo | `yarn typecheck` acotado | HECHO |
| H3.S1.M2 | Proveerlo en `document-block` con su `computed` | El token resuelve la instancia | spec del bloque | HECHO — 4 tests nuevos, verde |
| H3.S1.M3 | Proveerlo en `observation-block` | idem | spec del bloque | HECHO — 3 tests nuevos, verde |
| H3.S1.M4 | Proveerlo en `free-note-block` (semántica post-guardado) | idem | spec del bloque | HECHO — 5 tests nuevos, verde |
| H3.S1.M5 | Proveerlo en `allergy-block` | idem | spec del bloque | HECHO — 4 tests nuevos, verde |
| H3.S1.M6 | Proveerlo en `care-plan-block` | idem | spec del bloque | HECHO — 4 tests nuevos, verde |
| H3.S1.M7 | Proveerlo en `diagnosis-block` | idem | spec del bloque | HECHO — 3 tests nuevos, verde |
| H3.S1.M8 | Proveerlo en `medication-block` (excluye `validFrom`) | idem | spec del bloque | HECHO — 4 tests nuevos, verde |

### H3.S2 — Cablear el expediente
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S2.M1 | `viewChild(DRAFT_BLOCK)` + `altaSinCambios` + handler de descarte | Compila | `yarn typecheck` | HECHO |
| H3.S2.M2 | Vincular `[dismissible]`/`(dismissAttempt)` en el alta | Bindings en el HTML | lectura del diff | HECHO |
| H3.S2.M3 | `estadoSinCambios` + handler en el modal de estado | Compila | `yarn typecheck` | HECHO |
| H3.S2.M4 | Vincular en el modal de estado | Bindings en el HTML | lectura del diff | HECHO |
| H3.S2.M5 | Specs de `patient-chart.spec.ts` (7 casos alta + 3 estado) | Todos en verde | `yarn test` acotado | HECHO — 10 tests nuevos, 17 archivos/325 tests verde |

### H3.S3 — Accesibilidad probada con teclado + E2E
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S3.M1 | Rol/nombre accesible del diálogo | Verificado | Playwright | HECHO |
| H3.S3.M2 | Foco inicial adentro | Verificado | Playwright | HECHO — botón `content-dialog-close` enfocado |
| H3.S3.M3 | Foco atrapado | Verificado | Playwright | PENDIENTE — no se probó explícitamente `Tab`×N/`Shift+Tab`; queda cubierto indirectamente por la trampa nativa de `showModal()` (contrato del organismo), no ejercitado en este spec |
| H3.S3.M4 | Escape con política | Verificado | Playwright | HECHO — sin escribir cierra directo; con algo escrito pregunta |
| H3.S3.M5 | Restauración de foco al abridor | Verificado | Playwright | HECHO — `toBeFocused()` sobre el abridor tras cerrar/confirmar |
| H3.S3.M6 | Movimiento reducido | Verificado | Playwright con `emulateMedia` | HECHO |
| H3.S3.M7 | Spec Playwright completo + capturas 2 anchos × 2 temas | Corre y captura | `yarn pw ... --workers=1` | HECHO — 3 passed/1 skipped, 4 capturas miradas |

**Stretch (A MEDIAS si no llega):** cablear `consultation.html` con las mismas 3 vinculaciones.

## H4 — Adjuntos: complementarias, con evidencia

**Prioridad:** ALTA
**CA:** Hay veredicto complementarias/fusionables con evidencia de las 5 dimensiones del §7.1.
**DoD:** los dos contratos + el veredicto.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Leer contrato de las dos piezas | Anotado con líneas | discovery | HECHO |
| H4.S1.M2 | Listar consumidores de cada una | 3 y 3 | `git grep -l` | HECHO |
| H4.S1.M3 | Comparar 5 dimensiones del §7.1 | Tabla 2×5 | `contratos/adjuntos.md` | HECHO |
| H4.S1.M4 | Veredicto con evidencia | Conclusión citada | idem | HECHO — complementarias, contraejemplo allergy/medication-block |
| H4.S2.M1 | Contrato §10 de `attachment-uploader` | Diez áreas | idem | HECHO |
| H4.S2.M2 | Contrato §10 de `attachment-dialog` | Diez áreas | idem | HECHO |
| H4.S2.M3 | Declarar validación real del servidor | Escrito | idem | HECHO |
| H4.S2.M4 | Declarar que el progreso es evento, no input | Escrito | idem | HECHO |
| H4.S2.M5 | Entregar definiciones de escenario a Ender | 2 escenarios en el contrato | línea en el daily | HECHO — definiciones en `contratos/adjuntos.md`; implementación en el banco declarada regla 65 (fuera de este carril, es de Ender) |

## H5 — `fact-section`: veredicto medido, cero borrados

**Prioridad:** MEDIA
**CA:** Veredicto respaldado por 4 mediciones; nada se borra.
**DoD:** 4 números pegados + veredicto escrito.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H5.S1.M1 | Usos estáticos por selector | Número | grep sobre `<app-fact-section` | HECHO (0) |
| H5.S1.M2 | Usos por importación de clase | Número | grep sobre `FactSection` | HECHO (1, sólo barrel) |
| H5.S1.M3 | Usos dinámicos y por ruta | Número | grep sobre `loadComponent`/`createComponent` | HECHO (0) |
| H5.S1.M4 | Presencia en el catálogo | Veredicto | grep sobre `component-index.generated.ts` | HECHO (sí, sólo banco) |
| H5.S2.M1 | Evaluar si el detalle del expediente lo adopta | Sí/no con motivo | línea en el contrato | HECHO — no: `fact-section` trae buscador/paginación para listas largas, el detalle es una ficha fija de 3-5 campos |
| H5.S2.M2 | Si no se adopta: declarar pendiente con dueño | Dueño + motivo | `REPORTE.md` | HECHO — Pablo, D-19 en `DECISIONES.md` |
| H5.S2.M3 | Confirmar que no se borró nada | Diff sin eliminar la pieza | `git diff --stat` | HECHO — `git diff --stat` no toca `fact-section`/`fact-list` |

## H6 — Regresión, gates y cierre

**Prioridad:** ALTA
**CA:** Ningún rojo nuevo; gate de privacidad pasado y escrito; `REPORTE.md` con avance primero.
**DoD:** baseline repetido + comparado, capturas miradas, gate PHI, §19 respondido, `REPORTE.md`.
**Estado:** HECHO (menos H6.S1.M3, ver abajo)

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H6.S1.M1 | `lint`/`typecheck` sin rojos nuevos | Diff contra baseline | comparación | HECHO — lint 244/244 idéntico, typecheck 0/0 |
| H6.S1.M2 | `test` completo sin rojos nuevos | Diff contra baseline | comparación | HECHO — antes 4 archivos/9 tests rojos (571/7089); después 3 archivos/3 tests rojos (571/7125) — MENOS rojos, mismo patrón ENVIRONMENT (TestBed), ninguno en mi alcance |
| H6.S1.M3 | 3 consumidores ajenos re-recorridos | Comportamiento igual | capturas comparadas | PENDIENTE — mismo motivo que H2.S2.M4: no se volvió a abrir el navegador para esto por el costo de otro ciclo de servidor |
| H6.S1.M4 | E2E dirigido, `--workers=1` | Pasa | salida pegada | HECHO — mismo run que H3.S3.M7 |
| H6.S1.M5 | Gate `data-privacy-phi` | Cero datos reales | sección en `REPORTE.md` | HECHO |
| H6.S2.M1 | Capturas finales por viewport/tema | 5 capturas | `evidencia/h6/` | HECHO — 4 (no 5: sin capturas "antes", ver H1.S3.M1) |
| H6.S2.M2 | Responder las 20 preguntas del §19 | Cada una con evidencia | `REPORTE.md` | HECHO |
| H6.S2.M3 | Peldaño por área (regla 30) | Declarado | `REPORTE.md` | HECHO |
| H6.S2.M4 | Oleada 2 con dueño | 6 diálogos con dueño propuesto | `REPORTE.md` | HECHO |
| H6.S2.M5 | `REPORTE.md` con avance primero | `head -3` lo muestra | `head -3 REPORTE.md` | HECHO |

## Definition of Done del hito

- [ ] Todas las microtareas en HECHO, o A MEDIAS/BLOQUEADO/DESCARTADO con las 4 respuestas.
- [ ] Salida literal de cada DoD en `evidencia/`.
- [ ] `yarn lint`/`yarn typecheck`/`yarn test --watch=false` sin rojos nuevos vs. baseline.
- [ ] `content-dialog` tocado → 3 consumidores ajenos comprobados a mano, con captura.
- [ ] Todo diálogo tocado: rol/nombre, foco inicial, foco atrapado, Escape, restauración de foco,
      movimiento reducido.
- [ ] Capturas por viewport y tema, miradas, con línea.
- [ ] Consola/red sin errores nuevos.
- [ ] Gate `data-privacy-phi` pasado y escrito.
- [ ] Ningún dato clínico inventado.
- [ ] Peldaño de evidencia declarado por área.
- [ ] `PLAN.md` actualizado en el momento.
