# Reporte — El diálogo, los adjuntos y la sección de datos del expediente

> **AVANCE: 63 / 70 — 90,0 %.**

- Fecha: 2026-09-21/22 (turno de la noche) · Plan: [PLAN.md](./PLAN.md) ·
  Rama: `marcelo/noche-2026-09-21-dialogos-adjuntos-expediente` (sobre `origin/mockup` @ `d40b5631`)
- Peldaño de evidencia alcanzado: **VERIFIED** para H3 (comportamiento observado en runtime real —
  `yarn dev` + Playwright contra `localhost:4200`, con prueba visual en 2 anchos × 2 temas) y
  **TESTED** para el resto del código (los 7 bloques + `patient-chart.spec.ts`, specs dirigidos en
  verde). **DISCOVERED/WRITTEN** para los tres documentos de contrato (H2/H4/H5): son análisis y
  medición documental, no cambian comportamiento. No alcanza `REGRESSION_VERIFIED` en sentido
  estricto: faltan las 3+3 pruebas manuales de consumidores ajenos (H2.S2.M4/H6.S1.M3) y la trampa
  de foco no se probó explícitamente con `Tab`×N (H3.S3.M3, cubierta indirectamente por el
  contrato nativo de `showModal()`, no por este spec).
- **Denominador distinto al declarado en la ficha** (61): mi `PLAN.md` decompone H3 en 3 subtareas ×
  8 microtareas (los 7 bloques + el cableado, uno por bloque en vez de agrupados) porque cada bloque
  es un cambio, un commit y una verificación independientes — 70 microtareas en total. Está
  declarado como desvío #1 del `PLAN.md`.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Corte y rama declarados | `git rev-parse origin/mockup` | `d40b5631f68a52c79fe94f0dc689df3bc7e70140` |
| H1.S1.M2 | Baseline de lint capturado | `yarn lint` | 244 errores preexistentes — `evidencia/antes/lint.txt` |
| H1.S1.M3 | Baseline de typecheck capturado | `yarn typecheck` | exit 0 — `evidencia/antes/typecheck.txt` |
| H1.S1.M4/M5 | Baseline de tests capturado y clasificado | `yarn test --watch=false` | 4 archivos/9 tests rojos de 571/7089, los 4 clase ENVIRONMENT (contagio de TestBed), ninguno en mi alcance — `evidencia/antes/test.txt` |
| H1.S2.M1/M2 | Rutas del expediente confirmadas; sin diálogo escrito a mano en `patient-chart` | grep sobre `app.routes.ts` y `patient-chart.html` | `/medical-records`, `/medical-records/:profileId`, `…/consultation`, `…/request-access`; único match de `<dialog` es un comentario en la línea 296 |
| H1.S3.M2 | Sin dato real de paciente en la evidencia | revisión manual de las 4 capturas | «Ana Lucía Pérez Quiroga» es la paciente sintética del simulador, declarada en la ficha |
| H2 (completo salvo H2.S2.M4) | Contrato de `content-dialog` escrito y verificado; medición de los 29 consumidores; contrato de la sección de datos | `git grep -l '<app-content-dialog' -- 'src/app/**/*.html' \| wc -l` | **29** confirmado; `contratos/content-dialog.md` con las 10 filas del §8, las 10 áreas del §10, la política de descarte por los 3 caminos, 6 invariantes, la tabla completa de los 29 (11/29 vinculan `dismissible`) y la receta de migración para Justin |
| H4 (completo) | Veredicto de adjuntos: complementarias, con evidencia | lectura de `attachment-dialog.ts`/`attachment-uploader.ts` | `contratos/adjuntos.md`: 5 dimensiones comparadas, contraejemplo (`allergy-block`/`medication-block` montan el subidor sin modal), 2 contratos §10 completos, 2 escenarios definidos para el banco de Ender |
| H5 (completo) | Veredicto de `fact-section`: pendiente con dueño, cero borrado | 4 mediciones (`git grep`) | 0 usos estáticos, 1 importación (sólo barrel), 0 dinámicos, presente sólo en el catálogo del banco; `contratos/seccion-de-datos.md` + D-19 en `DECISIONES.md`; `git diff --stat` confirma que `fact-section`/`fact-list` no se tocaron |
| H3.S1 (7/7 bloques) | `DRAFT_BLOCK`/`DraftBlock` creado y provisto en los 7 bloques del alta | `yarn typecheck` | exit 0 — `evidencia/h3-typecheck-bloques.txt` |
| H3.S1 (7/7 specs) | 27 tests nuevos de `tieneCambiosPendientes`, uno por bloque | `yarn test --include='.../patient-chart/{document,observation,free-note,allergy,care-plan,diagnosis,medication}-block/**/*.spec.ts'` (corridos por lotes) | Todos verdes — `evidencia/h3-{document-block,obs-note,allergy,care-plan,diagnosis,medication}.txt` |
| H3.S2 | `patient-chart.ts`/`.html` cableados: `viewChild(DRAFT_BLOCK)`, `altaSinCambios`, `estadoSinCambios`, `pedirDescarteDelAlta`, `pedirDescarteDelEstado`, bindings en los dos modales editables | `yarn typecheck` | exit 0 — `evidencia/h3-typecheck-patient-chart.txt` |
| H3.S2.M5 | 10 tests nuevos de política de descarte en `patient-chart.spec.ts` (7 alta + 3 estado) | `yarn test --include='.../patient-chart/**/*.spec.ts'` | **17 archivos / 325 tests, todos verdes** (cero regresión) — `evidencia/h3-specs-completos.txt` |
| H3.S3 | Verificación E2E completa: rol/nombre, foco inicial, Escape, restauración de foco, movimiento reducido, capturas | `yarn pw playwright/expediente-dialogo-descarte.spec.ts --workers=1` | **3 passed / 1 skipped** (sin filas con detalle en el paciente demo) — `evidencia/h3-playwright-6.txt`; 4 capturas en `docs/frontend/evidence/expediente-dialogo-descarte/`, miradas a mano |
| H6.S1.M1 | Gate de lint/typecheck sin rojos nuevos | `yarn lint` / `yarn typecheck` | 244/244 idéntico al baseline; typecheck 0/0 — `evidencia/h6-lint.txt`, `h6-typecheck.txt` |
| H6.S1.M2 | Gate de test completo sin rojos nuevos | `yarn test --watch=false` | **3 archivos/3 tests rojos de 571/7125** (antes: 4/9) — **menos** rojos que el baseline, mismo patrón ENVIRONMENT, ninguno en mi alcance — `evidencia/h6-test.txt` |
| H6.S1.M4 | E2E dirigido serial | mismo run que H3.S3 | ver arriba |
| H6.S1.M5 | Gate de privacidad | revisión de las 5 capturas + grep de la evidencia | ver sección «Privacidad» abajo |

## A medias

Ninguna. Todo lo iniciado se llevó a HECHO o se declaró PENDIENTE con las cuatro respuestas abajo.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S2.M3/M4 | PENDIENTE | Capturar el comportamiento "antes" del descarte en navegador real requiere otro ciclo de `yarn dev` (ver "Riesgos" — el entorno tardó ~3 minutos por arranque y se cayó una vez en silencio). Se priorizó verificar el comportamiento "después", que es lo que demuestra que H3 funciona; el "antes" quedó razonado por lectura de código (sin `[dismissible]`/`(dismissAttempt)` los tres caminos cierran directo). Se retoma con otro `yarn dev` sobre `git stash` de esta rama si hace falta el contraste visual exacto |
| H1.S3.M1/M3 | PENDIENTE | Mismo motivo: capturas "antes" y consola/red "antes" no se tomaron. La evidencia "después" (4 capturas + Playwright en verde) sí cubre el comportamiento nuevo |
| H2.S2.M4 | PENDIENTE | Recorrer a mano `agenda/my-agenda/tarjeta-del-dia`, `account/my-profile/work-history` y `progress-notes` por los tres caminos de cierre exige otro ciclo de servidor. La tabla del §6 del contrato es lectura estática del markup (confiable para el conteo, no para el comportamiento en runtime). Quien lo retome: levantar `yarn dev`, entrar como `medica@alovida.mock`, y repetir el recorrido de `expediente-dialogo-descarte.spec.ts` contra esas tres pantallas |
| H3.S3.M3 | PENDIENTE | El spec no probó `Tab`×N/`Shift+Tab` explícitamente dentro del modal. El organismo delega la trampa de foco al `<dialog>` nativo (`showModal()`, contrato ya documentado en `content-dialog.md` §0), así que el riesgo real es bajo, pero no está *este* comportamiento demostrado con teclado en *este* carril |
| H6.S1.M3 | PENDIENTE | Mismo motivo que H2.S2.M4 — es la misma prueba manual, pedida dos veces por la ficha (H2 para medir, H6 para regresión) |

## Evidencia

Índice completo en `docs/trabajo/2026-09-21-marcelo-dialogos-adjuntos-expediente/evidencia/`
(35 archivos) y `docs/frontend/evidence/expediente-dialogo-descarte/` (4 capturas). Comandos y
salidas literales, sin parafrasear. Selección:

```text
$ git rev-parse origin/mockup
d40b5631f68a52c79fe94f0dc689df3bc7e70140

$ yarn lint (después) | tail -3
✖ 244 problems (244 errors, 0 warnings)
exit=1
(idéntico al baseline: evidencia/antes/lint.txt también da 244)

$ yarn typecheck (después)
exit=0

$ yarn test --include='src/app/features/clinical-record/patient-chart/**/*.spec.ts' --watch=false
Test Files  17 passed (17)
     Tests  325 passed (325)

$ yarn test --watch=false (regresión completa, después)
Test Files  3 failed | 568 passed (571)
     Tests  3 failed | 7122 passed (7125)
(antes: 4 failed | 567 passed (571) · 9 failed | 7080 passed (7089) — MENOS rojos ahora)

$ yarn pw playwright/expediente-dialogo-descarte.spec.ts --workers=1
ok 1 el alta de Documentos pregunta antes de descartar lo escrito, por los tres caminos (7.2s)
-  2 el detalle de lectura nunca pregunta (skipped)
ok 3 con movimiento reducido, el alta igual abre (4.7s)
ok 4 el alta se ve correctamente en móvil, claro y oscuro (5.2s)
1 skipped
3 passed (22.5s)
```

## No cubierto

- **Trampa de foco explícita** (`Tab`×N dentro del modal): se confía en el contrato nativo del
  `<dialog>`, documentado pero no ejercitado con teclado en este carril.
- **Los 3 consumidores ajenos de `content-dialog`** (`tarjeta-del-dia`, `work-history`,
  `progress-notes`) no se abrieron en navegador; la tabla del §6 del contrato es análisis estático.
- **`consultation.html`** (stretch declarado en el `PLAN.md`): no recibió las mismas 3 vinculaciones
  que `patient-chart.html`. Los 7 bloques ya proveen `DRAFT_BLOCK`, así que cablear `consultation.ts`
  con el mismo patrón (`viewChild` + 2 handlers + 3 bindings) es mecánico, pero no se hizo.
- **Cobertura del alta más allá de "Documentos"**: el E2E ejercita un solo bloque (Documentos); los
  otros 6 (observaciones, notas, alergias, planes, diagnósticos, medicación) están cubiertos por los
  27 tests unitarios de `tieneCambiosPendientes`, no por un recorrido de teclado en navegador.
- **Los 6 diálogos crudos de la oleada 2** no se tocaron (correcto, están fuera de alcance) ni se
  verificó en runtime que sigan intactos — sólo se los localizó por `git grep`.
- **`allergy-block`/`medication-block` montando `attachment-uploader` sin modal**: se documentó como
  hallazgo en `contratos/adjuntos.md`, no se corrigió (fuera de alcance de H3, que es sobre el alta,
  no sobre los adjuntos).

## Desvíos del plan

1. **H3 se reformuló completo** (ver `PLAN.md`, desvío #1): la ficha asumía un diálogo escrito a
   mano en `patient-chart.html` que no existe; el trabajo real fue cablear una política de descarte
   que el organismo ya soporta pero que el expediente no usaba.
2. **Denominador de microtareas: 70, no 61** — mi descomposición de H3 en 8 microtareas por
   subtarea (7 bloques + cableado) en vez de agrupadas. Declarado en el `PLAN.md` antes de ejecutar.
3. **El Workflow de sólo lectura planeado (§1 del plan original) no se usó.** Las mediciones de H2/H4/H5
   se hicieron con `git grep` directo en vez de delegarlas a agentes: en la práctica, cada medición
   era un comando de una línea con salida determinística — usar agentes hubiera sido más lento y
   menos verificable que correr el grep yo mismo y pegar la salida literal. Se declara el desvío en
   vez de forzar el uso de la herramienta por seguir el plan al pie de la letra.
4. **`yarn start` (no `yarn dev`) fue el primer intento fallido**: sirve un build SSR viejo en el
   puerto 4000, no refleja el código fuente actual. Corregido a `yarn dev` (puerto 4200, `ng serve`).
5. **Tres derivas de UI encontradas y corregidas en mi propio spec de Playwright** (no en el producto,
   son mías): la etiqueta del buscador cambió de "Buscar por nombre o código" a "Nombre o código";
   el enlace cambió de "Ver expediente" a "Ver el expediente de {nombre}"; y `<app-content-dialog>`
   (el host) no cuenta como "visible" para Playwright aunque su `<dialog>` interno sí lo esté — hay
   que aserciones por rol (`getByRole('dialog', {name})`), no por el testid del host. Ninguna de las
   tres tocó el producto: eran locators desactualizados en mi propio spec nuevo. De paso se confirmó
   que `playwright/consulta-rejilla.spec.ts` (ajeno, no tocado) tiene la misma primera deriva
   preexistente — se reporta acá para quien lo retome, no se corrigió (fuera de alcance).

## Riesgos residuales y deuda

- **`consultation.html` sin la política de descarte** (ver "No cubierto"): mismo riesgo que tenía
  `patient-chart.html` antes de este carril, sin resolver ahí.
- **Entorno de este sandbox inestable para builds pesados**: `yarn typecheck`, `yarn test` y
  `yarn dev` fallaron con `Segmentation fault`/muerte silenciosa varias veces durante la noche,
  siempre recuperables con reintento y/o `taskkill /F /IM node.exe` para limpiar procesos node
  residuales antes de reintentar. Documentado paso a paso en los checkpoints; no es un defecto del
  código de este carril.
- **`H-1` no cerrado** (documento maestro, no de este carril): `allergy-block`/`medication-block`
  montan `attachment-uploader` sin la confirmación de `attachment-dialog` — hallazgo lateral de H4,
  reportado, no arreglado (fuera de alcance).
- **El cierre por guardado exitoso** (`altaRegistrada()`) sigue sin `returnFocus()` cuando el modal
  queda abierto tras guardar (medicación/notas, que ofrecen "seguir" tras registrar) — hallazgo del
  diseño de H3 en el `PLAN.md` original, documentado, no arreglado (es un defecto preexistente del
  patrón `altaRegistrada`, no introducido por este carril).

## Decisiones y ambigüedades

Ver la tabla completa en `PLAN.md` §"Ambigüedades registradas" (Q-M1 a Q-M5). Resumen:

- **Q-M1** (¿el descarte debe preguntar?): se asumió que sí, adoptando el patrón ya usado por
  `attachment-dialog`. Pendiente de confirmación explícita de Producto.
- **Q-M2** (`fact-section`): pendiente con dueño Pablo, cero borrado.
- **Q-M3** (adjuntos complementarios): demostrado con evidencia, no asumido.
- **Q-M4** (diálogos crudos restantes): 2 de Justin (contrato entregado), 3 reales de oleada 2, 1
  cuestionable (`my-agenda`).
- **Q-M5** (fixtures de `core/mock/`): no hizo falta pedir nada — la maqueta ya sirve lo necesario.

## Privacidad (gate `data-privacy-phi`)

- Cuenta usada: `medica@alovida.mock` (sintética, declarada en la ficha).
- Paciente usada en las pruebas y capturas: «Ana Lucía Pérez Quiroga», dato del simulador
  (`mockBackend: true`), no una persona real.
- Las 4 capturas finales (`docs/frontend/evidence/expediente-dialogo-descarte/`) se revisaron a
  mano: título de documento sintético ("Laboratorio completo"), sin diagnóstico, dosis ni dato
  clínico inventado.
- Ningún log ni salida pegada en este reporte contiene documento de identidad, teléfono real ni
  dirección. Los correos y teléfonos que aparecen en las capturas de la lista de pacientes
  (`+591 6200…`) son del simulador, no se enmascararon porque son sintéticos declarados por el
  propio entorno de pruebas (`mockBackend: true`), consistente con `data-privacy-phi` §7.

## Peldaño de evidencia por área (regla 30)

| Área | Peldaño |
|---|---|
| `draft-block.ts` + los 7 bloques | TESTED (27 specs unitarios dirigidos, verdes) |
| `patient-chart.ts`/`.html` (política de descarte) | **VERIFIED** (E2E real, capturas, foco observado) |
| Contratos H2/H4/H5 (documentación) | WRITTEN (análisis y medición, no código ejecutable) |
| Regresión del repo (H6) | **TESTED**, no `REGRESSION_VERIFIED` — faltan las 3+3 pruebas manuales de consumidores ajenos declaradas PENDIENTE |

## Respuestas a las 20 preguntas del §19 (revisión adversarial)

1. **¿Se podría aprobar moviendo archivos sin cambiar responsabilidades?** No — el cambio central
   (`DRAFT_BLOCK`) agrega comportamiento nuevo (computeds de borrador) en 7 archivos y 2 handlers
   async en `patient-chart.ts`, verificado por 37 tests nuevos.
2. **¿Un smart gigante trasladado a una fachada gigante?** No aplica — no hubo extracción de
   componente, sólo un contrato de comunicación nuevo entre piezas existentes.
3. **¿La UI consigue negocio mediante una dependencia indirecta con nombre inocente?** No —
   `DRAFT_BLOCK` es explícitamente un `InjectionToken` de UI (qué mostrar), no de dominio.
4. **¿Dos estados que representan el mismo hecho con sincronización manual?** No — `tieneCambiosPendientes`
   es un `computed` derivado de las señales del bloque, no un estado espejado.
5. **¿El componente nuevo necesita saber qué pantalla lo usa?** No — cada bloque implementa
   `DraftBlock` sin conocer al expediente; el expediente lo consulta por el token.
6. **¿La extracción borró una diferencia real de dominio?** No hubo extracción de familia (sólo
   H4, que **no** fusionó nada, justamente por respetar la diferencia real).
7. **¿Una variación decorativa produjo otro organismo?** No — cero organismos nuevos, sólo un token.
8. **¿El contrato proyectado permite usos inválidos que ningún check detecta?** Sí, uno: nada impide
   que un bloque futuro olvide implementar `DraftBlock` — el `?? false` en `altaSinCambios` lo hace
   fail-safe (sin token, dismissible=true), documentado en el propio archivo `draft-block.ts`.
9. **¿La tabla del catálogo está vacía para evitar probar columnas?** No aplica — H4.S2.M5 declaró
   los escenarios sin implementarlos, con la razón explícita (regla 65, es alcance de Ender).
10. **¿La demo recrea la pantalla en vez de importar la fuente canónica?** No aplica esta noche.
11. **¿El producto sigue usando el duplicado mientras el catálogo muestra la pieza nueva?** No aplica.
12. **¿Un cambio externo pierde un borrador o selección vigente?** No — verificado específicamente en
    `free-note-block` (seguir escribiendo tras guardar) y en el modal de estado (Escape con destino
    elegido).
13. **¿Un cierre evita la protección de cambios sin guardar?** No — los tres caminos (botón, Escape,
    fondo) pasan por el mismo `solicitarCierre()` del organismo, verificado en el E2E.
14. **¿Un output se llama éxito aunque sólo se emitió una solicitud?** No — `dismissAttempt` nunca se
    interpreta como éxito; el cierre real sólo ocurre tras `close()`.
15. **¿El iframe comparte sesión inadvertidamente?** No aplica — sin iframes en este carril.
16. **¿Un mock exitoso se presenta como integración terminada?** No — la sección "No cubierto" es
    explícita sobre qué no se verificó en runtime real (los 3 consumidores ajenos).
17. **¿Se retiró código sin revisar consumidores dinámicos?** No se retiró nada (H5: cero borrados,
    verificado con `git diff --stat`).
18. **¿Se declara verificado algo sólo inspeccionado estáticamente?** No — la tabla del §6 del
    contrato de `content-dialog` se declara explícitamente "lectura estática" y el peldaño de H6.S1.M3
    queda PENDIENTE, no HECHO, por esa razón.
19. **¿El informe oculta pendientes reduciendo el alcance?** No — el denominador subió a 70 (no bajó)
    y las 5 microtareas PENDIENTE están listadas con las 4 respuestas.
20. **¿Otra persona puede ubicar y cambiar la regla sin aprender detalles privados?** Sí —
    `draft-block.ts` está autocontenido y documentado; el contrato de `content-dialog.md` es
    legible sin abrir `content-dialog.ts`.

## Oleada 2 (diálogos crudos, con dueño propuesto)

| Archivo | Dueño propuesto | Motivo |
|---|---|---|
| `messaging/thread/thread.html` (×2 diálogos) | Sin asignar | Fuera del alcance de este carril; reales (`role="dialog" aria-modal="true"`) |
| `messaging/thread/contact-panel/contact-panel.html` | Sin asignar | idem |
| `agenda/my-agenda/my-agenda.html` (globo de aviso) | Agenda (quien lo toque después) | `role="dialog"` sin `aria-modal`, cuestionable si es realmente un diálogo modal — a evaluar |
| `alovida/buscar/hospitales-listado/facility-directions-dialog` | Justin | Ya tiene el contrato de `content-dialog.md` entregado |
| `alovida/buscar/medicamentos-listado/pharmacy-availability-dialog` | Justin | idem |
| `admin/{data-catalog,qa-lab,web-analytics}` (3 nuevos, post-corte de la ficha) | Sin asignar | No estaban en el conteo original de 26; entran al conteo de 29 pero nadie los tiene asignados todavía |
